alter table public.builds
  add column removed_at timestamptz,
  add column removal_reason text,
  add constraint builds_removal_reason_length
    check (removal_reason is null or length(trim(removal_reason)) between 3 and 500),
  add constraint builds_removal_fields_together
    check ((removed_at is null) = (removal_reason is null));

create index builds_active_updated_idx
  on public.builds (updated_at desc)
  where removed_at is null;

create or replace function public.update_build(p_build_id uuid, p_name text, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_profile_id uuid;
  previous_build public.builds;
  updated_build public.builds;
begin
  if p_name is null or length(trim(p_name)) = 0 or length(trim(p_name)) > 100 then
    raise exception 'Informe um nome válido para o computador.' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_notes, ''))) > 1000 then
    raise exception 'As observações excedem o limite permitido.' using errcode = '22023';
  end if;

  select * into previous_build from public.builds where id = p_build_id for update;
  if previous_build.id is null or previous_build.removed_at is not null
    or not public.can_manage_build(p_build_id) then
    raise exception 'Computador não encontrado ou sem permissão.' using errcode = '42501';
  end if;

  update public.builds
  set name = trim(p_name), notes = nullif(trim(coalesce(p_notes, '')), ''), updated_at = now()
  where id = p_build_id
  returning * into updated_build;

  select id into actor_profile_id from public.profiles where auth_user_id = actor_id and is_active;
  insert into public.audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
  values (actor_profile_id, 'build.updated', 'build', p_build_id, to_jsonb(previous_build), to_jsonb(updated_build));
end;
$$;

create or replace function public.remove_build(p_build_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_profile_id uuid;
  build_row public.builds;
  original_name text;
  original_status public.build_status;
  item record;
begin
  if p_reason is null or length(trim(p_reason)) < 3 or length(trim(p_reason)) > 500 then
    raise exception 'Informe um motivo de remoção entre 3 e 500 caracteres.' using errcode = '22023';
  end if;

  select * into build_row from public.builds where id = p_build_id for update;
  if build_row.id is null or build_row.removed_at is not null
    or not public.can_manage_build(p_build_id) then
    raise exception 'Computador não encontrado ou sem permissão.' using errcode = '42501';
  end if;
  original_name := build_row.name;
  original_status := build_row.status;

  if build_row.status not in ('COMPLETED', 'CANCELLED') then
    for item in
      select bc.id, bc.lot_id, r.id as reservation_id, r.quantity
      from public.build_components bc
      join public.inventory_reservations r on r.build_component_id = bc.id and r.status = 'ACTIVE'
      where bc.build_id = p_build_id and bc.is_active
      for update of bc, r
    loop
      update public.component_lots
      set reserved_quantity = reserved_quantity - item.quantity
      where id = item.lot_id and reserved_quantity >= item.quantity;
      if not found then raise exception 'Saldo de reserva inconsistente.' using errcode = '23514'; end if;
      update public.inventory_reservations
      set status = 'RELEASED', released_at = now()
      where id = item.reservation_id;
      update public.build_components
      set is_active = false, released_at = now()
      where id = item.id;
    end loop;
  end if;

  update public.builds
  set removed_at = now(), removal_reason = trim(p_reason), updated_at = now()
  where id = p_build_id
  returning * into build_row;

  select id into actor_profile_id from public.profiles where auth_user_id = actor_id and is_active;
  insert into public.audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
  values (
    actor_profile_id,
    'build.removed',
    'build',
    p_build_id,
    jsonb_build_object('name', original_name, 'status', original_status),
    jsonb_build_object('removed_at', build_row.removed_at, 'reason', build_row.removal_reason)
  );
end;
$$;

revoke all on function public.update_build(uuid, text, text) from public;
revoke all on function public.remove_build(uuid, text) from public;
grant execute on function public.update_build(uuid, text, text) to authenticated;
grant execute on function public.remove_build(uuid, text) to authenticated;
