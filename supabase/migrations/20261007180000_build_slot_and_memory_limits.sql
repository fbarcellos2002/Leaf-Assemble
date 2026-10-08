create or replace function public.case_supports_motherboard(p_case_support jsonb, p_board_form_factor text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce((
    select exists (
      select 1
      from jsonb_array_elements_text(coalesce(p_case_support, '[]'::jsonb)) as supported(value)
      where lower(trim(supported.value)) = lower(trim(p_board_form_factor))
        or case
          when replace(lower(trim(supported.value)), 'micro-atx', 'm-atx') like '%xl-atx%' then 5
          when replace(lower(trim(supported.value)), 'micro-atx', 'm-atx') like '%e-atx%' then 4
          when replace(lower(trim(supported.value)), 'micro-atx', 'm-atx') = 'atx' then 3
          when replace(lower(trim(supported.value)), 'micro-atx', 'm-atx') like '%m-atx%' then 2
          when replace(lower(trim(supported.value)), 'micro-atx', 'm-atx') like '%mini-itx%'
            or replace(lower(trim(supported.value)), 'micro-atx', 'm-atx') like '%mini-dtx%' then 1
          else 0
        end >= case
          when replace(lower(trim(p_board_form_factor)), 'micro-atx', 'm-atx') like '%xl-atx%' then 5
          when replace(lower(trim(p_board_form_factor)), 'micro-atx', 'm-atx') like '%e-atx%' then 4
          when replace(lower(trim(p_board_form_factor)), 'micro-atx', 'm-atx') = 'atx' then 3
          when replace(lower(trim(p_board_form_factor)), 'micro-atx', 'm-atx') like '%m-atx%' then 2
          when replace(lower(trim(p_board_form_factor)), 'micro-atx', 'm-atx') like '%mini-itx%'
            or replace(lower(trim(p_board_form_factor)), 'micro-atx', 'm-atx') like '%mini-dtx%' then 1
          else 0
        end
        and p_board_form_factor is not null
    )
  ), false);
$$;

create or replace function public.build_slot_conflict(
  p_build_id uuid,
  p_component_id uuid,
  p_slot_key text
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  candidate public.components;
  board public.components;
  cpu public.components;
  pc_case public.components;
  psu public.components;
  slot_number integer;
  memory_limit numeric;
  board_memory_limit numeric;
  cpu_memory_limit numeric;
  selected_memory numeric;
  storage_offset integer := 0;
  storage_count integer;
  storage_interface text;
  storage_entry record;
  candidate_interface text;
  psu_format text;
  supported_psu_formats jsonb;
begin
  select * into candidate from public.components where id = p_component_id;
  if candidate.id is null then return 'Componente não encontrado.'; end if;

  select c.* into board
  from public.build_components bc join public.components c on c.id = bc.component_id
  where bc.build_id = p_build_id and bc.is_active and c.category = 'MOTHERBOARD'
  limit 1;

  if candidate.category <> 'MOTHERBOARD' and board.id is null then
    return 'Selecione a placa-mãe antes das outras peças.';
  end if;

  if candidate.category = 'RAM' then
    slot_number := split_part(p_slot_key, '-', 2)::integer;
    if slot_number > coalesce((board.specs ->> 'memorySlots')::integer, 0) then
      return 'A placa-mãe não possui esse slot de memória.';
    end if;
    select c.* into cpu
    from public.build_components bc join public.components c on c.id = bc.component_id
    where bc.build_id = p_build_id and bc.is_active and c.category = 'CPU'
    limit 1;
    if cpu.id is null then return 'Selecione o processador antes da memória RAM.'; end if;
    board_memory_limit := (board.specs ->> 'maxMemoryGb')::numeric;
    cpu_memory_limit := nullif(cpu.specs ->> 'maxMemoryCapacityGb', '')::numeric;
    memory_limit := case
      when cpu_memory_limit is null then board_memory_limit
      else least(board_memory_limit, cpu_memory_limit)
    end;
    select coalesce(sum((c.specs ->> 'capacityGb')::numeric * bc.quantity), 0)
    into selected_memory
    from public.build_components bc join public.components c on c.id = bc.component_id
    where bc.build_id = p_build_id and bc.is_active and c.category = 'RAM';
    if selected_memory + coalesce((candidate.specs ->> 'capacityGb')::numeric, 0) > memory_limit then
      if cpu_memory_limit is not null and cpu_memory_limit < board_memory_limit then
        return format('O processador suporta até %s GB de RAM.', cpu_memory_limit);
      end if;
      return format('A placa-mãe suporta até %s GB de RAM.', board_memory_limit);
    end if;
  elsif candidate.category = 'GPU' then
    slot_number := split_part(p_slot_key, '-', 2)::integer;
    if slot_number > coalesce((board.specs ->> 'pcieSlots')::integer, 0) then
      return 'A placa-mãe não possui esse slot PCIe.';
    end if;
  elsif candidate.category = 'STORAGE' then
    slot_number := split_part(p_slot_key, '-', 2)::integer;
    for storage_entry in
      select value from jsonb_array_elements_text(board.specs -> 'storageInterfaces') with ordinality as interfaces(value, position)
      order by position
    loop
      storage_count := coalesce((board.specs -> 'storageInterfaceCounts' ->> storage_entry.value)::integer, 0);
      if slot_number > storage_offset and slot_number <= storage_offset + storage_count then
        storage_interface := storage_entry.value;
        exit;
      end if;
      storage_offset := storage_offset + storage_count;
    end loop;
    if storage_interface is null then return 'A placa-mãe não possui esse encaixe de armazenamento.'; end if;
    candidate_interface := coalesce(candidate.specs ->> 'interface', '');
    if lower(candidate_interface) <> lower(storage_interface)
      and not (candidate_interface ilike '%nvme%' and storage_interface ilike '%nvme%')
      and not (candidate_interface ilike '%pcie%' and storage_interface ilike '%pcie%')
      and not (
        candidate_interface ilike '%sata%'
        and storage_interface ilike '%sata%'
        and (candidate_interface ilike '%m.2%') = (storage_interface ilike '%m.2%')
      ) then
      return format('Este slot é %s e não aceita a interface %s.', storage_interface, candidate_interface);
    end if;
  elsif candidate.category = 'PSU' then
    select c.* into cpu
    from public.build_components bc join public.components c on c.id = bc.component_id
    where bc.build_id = p_build_id and bc.is_active and c.category = 'CPU'
    limit 1;
    if cpu.id is null then return 'Selecione o processador antes da fonte.'; end if;
    if cpu.specs ->> 'integratedGraphics' <> 'true' and not exists (
      select 1 from public.build_components bc join public.components c on c.id = bc.component_id
      where bc.build_id = p_build_id and bc.is_active and c.category = 'GPU'
    ) then
      return 'Selecione a placa de vídeo antes da fonte.';
    end if;
    select c.* into pc_case
    from public.build_components bc join public.components c on c.id = bc.component_id
    where bc.build_id = p_build_id and bc.is_active and c.category = 'CASE'
    limit 1;
    if pc_case.id is not null then
      psu_format := candidate.specs ->> 'formFactor';
      supported_psu_formats := pc_case.specs -> 'psuFormFactors';
      if psu_format is not null and supported_psu_formats is not null
        and not exists (
          select 1 from jsonb_array_elements_text(supported_psu_formats) as formats(value)
          where lower(formats.value) = lower(psu_format)
        ) then
        return 'O gabinete não suporta o formato da fonte selecionada.';
      end if;
    end if;
  elsif candidate.category = 'CASE' then
    if board.id is not null and not public.case_supports_motherboard(candidate.specs -> 'formFactorSupport', board.specs ->> 'formFactor') then
      return 'O gabinete não suporta o formato da placa-mãe.';
    end if;
    select c.* into psu
    from public.build_components bc join public.components c on c.id = bc.component_id
    where bc.build_id = p_build_id and bc.is_active and c.category = 'PSU'
    limit 1;
    if psu.id is not null then
      psu_format := psu.specs ->> 'formFactor';
      supported_psu_formats := candidate.specs -> 'psuFormFactors';
      if psu_format is not null and supported_psu_formats is not null
        and not exists (
          select 1 from jsonb_array_elements_text(supported_psu_formats) as formats(value)
          where lower(formats.value) = lower(psu_format)
        ) then
        return 'O gabinete não suporta o formato da fonte selecionada.';
      end if;
    end if;
  end if;

  return null;
end;
$$;

create or replace function public.reserve_build_component(
  p_build_id uuid,
  p_component_id uuid,
  p_lot_id uuid,
  p_slot_key text,
  p_quantity integer,
  p_compatibility_status text,
  p_compatibility_confirmed boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_profile_id uuid;
  build_row public.builds;
  candidate public.components;
  lot_row public.component_lots;
  new_build_component public.build_components;
  conflict_message text;
  slot_message text;
  category_slot_valid boolean;
begin
  select * into build_row from public.builds where id = p_build_id for update;
  if build_row.id is null or not public.can_manage_build(p_build_id) then
    raise exception 'Build não encontrado ou sem permissão.' using errcode = '42501';
  end if;
  if build_row.status in ('COMPLETED','CANCELLED') then
    raise exception 'Este build não aceita mais alterações.' using errcode = '55000';
  end if;
  if p_quantity is distinct from 1 or p_compatibility_status is null or p_compatibility_status not in ('compatible','warning','unknown') then
    raise exception 'Seleção inválida.' using errcode = '22023';
  end if;
  if not p_compatibility_confirmed then
    raise exception 'Confirme os avisos de compatibilidade antes de reservar.' using errcode = '22023';
  end if;

  select * into candidate from public.components where id = p_component_id;
  if candidate.id is null then raise exception 'Componente não encontrado.' using errcode = 'P0002'; end if;
  category_slot_valid := case candidate.category
    when 'CPU' then p_slot_key = 'cpu'
    when 'MOTHERBOARD' then p_slot_key = 'motherboard'
    when 'RAM' then p_slot_key ~ '^ram-[1-9][0-9]*$'
    when 'GPU' then p_slot_key ~ '^gpu-[1-9][0-9]*$'
    when 'STORAGE' then p_slot_key ~ '^storage-[1-9][0-9]*$'
    when 'PSU' then p_slot_key = 'psu'
    when 'CASE' then p_slot_key = 'case'
    when 'CPU_COOLER' then p_slot_key = 'cpu_cooler'
  end;
  if not coalesce(category_slot_valid, false) then
    raise exception 'O slot não corresponde à categoria da peça.' using errcode = '22023';
  end if;

  select * into lot_row from public.component_lots where id = p_lot_id and component_id = p_component_id for update;
  if lot_row.id is null then raise exception 'Lote não encontrado.' using errcode = 'P0002'; end if;
  if lot_row.available_quantity < p_quantity then raise exception 'Estoque disponível insuficiente.' using errcode = '23514'; end if;
  if exists (select 1 from public.build_components where build_id = p_build_id and slot_key = p_slot_key and is_active) then
    raise exception 'Este slot já possui uma peça. Libere-o antes de selecionar outra.' using errcode = '23505';
  end if;

  slot_message := public.build_slot_conflict(p_build_id, p_component_id, p_slot_key);
  if slot_message is not null then raise exception '%', slot_message using errcode = '23514'; end if;
  conflict_message := public.build_selection_conflict(p_build_id, p_component_id);
  if candidate.category = 'STORAGE' and conflict_message is not null then
    conflict_message := null;
  end if;
  if candidate.category = 'CASE' and conflict_message = 'O gabinete não suporta o formato da placa-mãe.'
    and public.build_slot_conflict(p_build_id, p_component_id, p_slot_key) is null then
    conflict_message := null;
  end if;
  if candidate.category = 'PSU' and conflict_message = 'A potência da fonte é inferior ao requisito estimado do sistema.'
    and exists (
      select 1 from public.build_components bc join public.components c on c.id = bc.component_id
      where bc.build_id = p_build_id and bc.is_active and c.category = 'CPU' and c.specs ->> 'integratedGraphics' = 'true'
    )
    and not exists (
      select 1 from public.build_components bc join public.components c on c.id = bc.component_id
      where bc.build_id = p_build_id and bc.is_active and c.category = 'GPU'
    ) then
    conflict_message := null;
  end if;
  if conflict_message is not null then raise exception '%', conflict_message using errcode = '23514'; end if;

  select id into actor_profile_id from public.profiles where auth_user_id = actor_id and is_active;
  update public.component_lots
  set reserved_quantity = reserved_quantity + p_quantity
  where id = p_lot_id and available_quantity >= p_quantity;
  if not found then raise exception 'Estoque disponível insuficiente.' using errcode = '23514'; end if;

  insert into public.build_components (
    build_id, component_id, lot_id, slot_key, quantity,
    compatibility_status, compatibility_confirmed, created_by
  ) values (
    p_build_id, p_component_id, p_lot_id, p_slot_key, p_quantity,
    p_compatibility_status, true, actor_profile_id
  ) returning * into new_build_component;

  insert into public.inventory_reservations (build_component_id, quantity, created_by)
  values (new_build_component.id, p_quantity, actor_profile_id);

  perform public.refresh_build_status(p_build_id);
  update public.builds set updated_at = now() where id = p_build_id;
  insert into public.audit_logs (user_id, action, entity_type, entity_id, new_data)
  values (actor_profile_id, 'inventory.reserved', 'build_component', new_build_component.id,
    jsonb_build_object('build_id', p_build_id, 'component_id', p_component_id, 'lot_id', p_lot_id, 'quantity', p_quantity, 'slot_key', p_slot_key));
  return new_build_component.id;
end;
$$;

revoke all on function public.build_slot_conflict(uuid, uuid, text) from public;
revoke all on function public.case_supports_motherboard(jsonb, text) from public;
revoke all on function public.reserve_build_component(uuid, uuid, uuid, text, integer, text, boolean) from public;
grant execute on function public.reserve_build_component(uuid, uuid, uuid, text, integer, text, boolean) to authenticated;
