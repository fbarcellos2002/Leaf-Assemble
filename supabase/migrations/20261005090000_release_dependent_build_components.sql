drop function public.release_build_component(uuid);

create function public.release_build_component(p_build_component_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_profile_id uuid;
  target record;
  build_row public.builds;
  item record;
  released_count integer := 0;
begin
  select bc.id, bc.build_id, bc.is_active, c.category
  into target
  from public.build_components bc
  join public.components c on c.id = bc.component_id
  where bc.id = p_build_component_id;

  if target.id is null then
    raise exception 'Peça do build não encontrada.' using errcode = 'P0002';
  end if;

  select * into build_row from public.builds where id = target.build_id for update;
  if not public.can_manage_build(target.build_id) then
    raise exception 'Sem permissão para alterar este build.' using errcode = '42501';
  end if;
  if not target.is_active then return 0; end if;
  if build_row.status in ('COMPLETED','CANCELLED') then
    raise exception 'Este build já foi encerrado.' using errcode = '55000';
  end if;

  select id into actor_profile_id
  from public.profiles
  where auth_user_id = actor_id and is_active;

  for item in
    select bc as build_component, bc.id, bc.lot_id, r.id as reservation_id, r.quantity
    from public.build_components bc
    left join public.inventory_reservations r
      on r.build_component_id = bc.id and r.status = 'ACTIVE'
    where bc.build_id = target.build_id
      and bc.is_active
      and (
        bc.id = target.id
        or (
          target.category = 'MOTHERBOARD'::public.component_category
          and (
            bc.slot_key = 'cpu'
            or bc.slot_key = 'cpu_cooler'
            or bc.slot_key ~ '^(ram|gpu)-[1-9][0-9]*$'
            or bc.slot_key ~ '^storage-[1-9][0-9]*$'
          )
        )
        or (
          target.category = 'CPU'::public.component_category
          and (
            bc.slot_key = 'cpu_cooler'
            or bc.slot_key ~ '^ram-[1-9][0-9]*$'
            or bc.slot_key ~ '^gpu-[1-9][0-9]*$'
          )
        )
      )
    order by bc.id
    for update of bc
  loop
    if item.reservation_id is not null then
      update public.component_lots
      set reserved_quantity = reserved_quantity - item.quantity
      where id = item.lot_id and reserved_quantity >= item.quantity;
      if not found then
        raise exception 'Saldo de reserva inconsistente.' using errcode = '23514';
      end if;

      update public.inventory_reservations
      set status = 'RELEASED', released_at = now()
      where id = item.reservation_id;
    end if;

    update public.build_components
    set is_active = false, released_at = now()
    where id = item.id;

    insert into public.audit_logs (user_id, action, entity_type, entity_id, old_data)
    values (actor_profile_id, 'inventory.released', 'build_component', item.id, to_jsonb(item.build_component));

    released_count := released_count + 1;
  end loop;

  perform public.refresh_build_status(target.build_id);
  update public.builds set updated_at = now() where id = target.build_id;
  return released_count;
end;
$$;

revoke all on function public.release_build_component(uuid) from public;
grant execute on function public.release_build_component(uuid) to authenticated;
