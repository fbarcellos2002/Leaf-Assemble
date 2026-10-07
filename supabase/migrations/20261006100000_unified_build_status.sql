alter table public.builds
  alter column status set default 'INCOMPLETE';

update public.builds
set status = 'INCOMPLETE'
where status in ('DRAFT', 'READY');

alter table public.builds
  add constraint builds_status_no_legacy_states
  check (status not in ('DRAFT', 'READY'));

create or replace function public.refresh_build_status(p_build_id uuid)
returns public.build_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status public.build_status;
begin
  select status into current_status
  from public.builds
  where id = p_build_id;

  if current_status is null then return null; end if;
  if current_status in ('COMPLETED', 'CANCELLED') then return current_status; end if;

  update public.builds
  set status = 'INCOMPLETE'
  where id = p_build_id;

  return 'INCOMPLETE';
end;
$$;

create or replace function public.build_is_ready(p_build_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    not exists (
      select 1 from public.build_components bc
      where bc.build_id = p_build_id and bc.is_active
        and (bc.compatibility_status = 'incompatible' or not bc.compatibility_confirmed)
    )
    and exists (
      select 1 from public.build_components bc join public.components c on c.id = bc.component_id
      where bc.build_id = p_build_id and bc.is_active and c.category = 'CPU'
    )
    and exists (
      select 1 from public.build_components bc join public.components c on c.id = bc.component_id
      where bc.build_id = p_build_id and bc.is_active and c.category = 'MOTHERBOARD'
    )
    and exists (
      select 1 from public.build_components bc join public.components c on c.id = bc.component_id
      where bc.build_id = p_build_id and bc.is_active and c.category = 'CPU_COOLER'
    )
    and exists (
      select 1 from public.build_components bc join public.components c on c.id = bc.component_id
      where bc.build_id = p_build_id and bc.is_active and c.category = 'RAM'
    )
    and exists (
      select 1 from public.build_components bc join public.components c on c.id = bc.component_id
      where bc.build_id = p_build_id and bc.is_active and c.category = 'STORAGE'
    )
    and exists (
      select 1 from public.build_components bc join public.components c on c.id = bc.component_id
      where bc.build_id = p_build_id and bc.is_active and c.category = 'PSU'
    )
    and exists (
      select 1 from public.build_components bc join public.components c on c.id = bc.component_id
      where bc.build_id = p_build_id and bc.is_active and c.category = 'CASE'
    )
    and (
      exists (
        select 1 from public.build_components bc join public.components c on c.id = bc.component_id
        where bc.build_id = p_build_id and bc.is_active
          and c.category = 'CPU' and c.specs ->> 'integratedGraphics' = 'true'
      )
      or exists (
        select 1 from public.build_components bc join public.components c on c.id = bc.component_id
        where bc.build_id = p_build_id and bc.is_active and c.category = 'GPU'
      )
    );
$$;

create or replace function public.complete_build(p_build_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_profile_id uuid;
  build_row public.builds;
  item record;
begin
  select * into build_row from public.builds where id = p_build_id for update;
  if build_row.id is null or not public.can_manage_build(p_build_id) then
    raise exception 'Build não encontrado ou sem permissão.' using errcode = '42501';
  end if;
  if build_row.status in ('COMPLETED', 'CANCELLED') then
    raise exception 'Este build já foi encerrado.' using errcode = '55000';
  end if;
  if not public.build_is_ready(p_build_id) then
    raise exception 'O build ainda está incompleto ou possui avisos não confirmados.' using errcode = '23514';
  end if;

  for item in
    select bc.id, bc.lot_id, r.id as reservation_id, r.quantity
    from public.build_components bc
    join public.inventory_reservations r on r.build_component_id = bc.id and r.status = 'ACTIVE'
    where bc.build_id = p_build_id and bc.is_active
    for update of bc, r
  loop
    update public.component_lots
    set reserved_quantity = reserved_quantity - item.quantity,
        used_quantity = used_quantity + item.quantity
    where id = item.lot_id and reserved_quantity >= item.quantity;
    if not found then raise exception 'Saldo de reserva inconsistente.' using errcode = '23514'; end if;
    update public.inventory_reservations
    set status = 'ALLOCATED', allocated_at = now()
    where id = item.reservation_id;
  end loop;

  update public.builds
  set status = 'COMPLETED', completed_at = now(), updated_at = now()
  where id = p_build_id;

  select id into actor_profile_id
  from public.profiles
  where auth_user_id = actor_id;
  insert into public.audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
  values (
    actor_profile_id,
    'build.completed',
    'build',
    p_build_id,
    to_jsonb(build_row),
    jsonb_build_object('status', 'COMPLETED')
  );
end;
$$;

revoke all on function public.build_is_ready(uuid) from public;
revoke all on function public.refresh_build_status(uuid) from public;
revoke all on function public.complete_build(uuid) from public;
grant execute on function public.complete_build(uuid) to authenticated;
