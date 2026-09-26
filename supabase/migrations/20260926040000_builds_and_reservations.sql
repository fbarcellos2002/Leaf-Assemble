create type public.build_status as enum (
  'DRAFT',
  'INCOMPLETE',
  'READY',
  'COMPLETED',
  'CANCELLED'
);

create type public.reservation_status as enum ('ACTIVE', 'RELEASED', 'ALLOCATED');

alter table public.component_lots
  add constraint component_lots_id_component_unique unique (id, component_id);

create table public.builds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status public.build_status not null default 'DRAFT',
  created_by uuid not null references public.profiles (id) on delete restrict,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint builds_name_not_blank check (length(trim(name)) > 0)
);

create index builds_owner_status_idx on public.builds (created_by, status, created_at desc);
create trigger builds_set_updated_at
before update on public.builds
for each row execute function public.set_profile_updated_at();

create table public.build_components (
  id uuid primary key default gen_random_uuid(),
  build_id uuid not null references public.builds (id) on delete restrict,
  component_id uuid not null references public.components (id) on delete restrict,
  lot_id uuid not null,
  slot_key text not null,
  quantity integer not null check (quantity > 0),
  is_active boolean not null default true,
  compatibility_status text not null default 'unknown'
    check (compatibility_status in ('compatible', 'warning', 'incompatible', 'unknown')),
  compatibility_confirmed boolean not null default false,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  constraint build_components_lot_matches_component
    foreign key (lot_id, component_id)
    references public.component_lots (id, component_id)
    on delete restrict
);

create unique index build_components_one_active_per_slot_idx
  on public.build_components (build_id, slot_key)
  where is_active;
create index build_components_build_idx on public.build_components (build_id, is_active);

create table public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  build_component_id uuid not null unique references public.build_components (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  status public.reservation_status not null default 'ACTIVE',
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  allocated_at timestamptz
);

create index inventory_reservations_status_idx on public.inventory_reservations (status, created_at);

create or replace function public.can_access_build(p_build_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.builds b
    join public.profiles p on p.id = b.created_by
    where b.id = p_build_id
      and (
        (p.auth_user_id = (select auth.uid()) and p.is_active)
        or (select public.is_active_admin())
      )
  );
$$;

create or replace function public.can_manage_build(p_build_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.builds b
    join public.profiles p on p.id = b.created_by
    join public.profiles actor on actor.auth_user_id = (select auth.uid())
    where b.id = p_build_id
      and actor.is_active
      and (
        (b.created_by = actor.id and p.is_active)
        or (select public.is_active_admin())
      )
  );
$$;

create or replace function public.component_power_connector_type(p_connector text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when regexp_replace(lower(p_connector), '\s', '', 'g') ~ '12v-?2x6|12v2x6' then '12v2x6'
    when regexp_replace(lower(p_connector), '\s', '', 'g') ~ '12vhpwr|12\+4' then '12vhpwr'
    when regexp_replace(lower(p_connector), '\s', '', 'g') ~ '6\+2-?pin|8-?pin' then '8pin'
    when regexp_replace(lower(p_connector), '\s', '', 'g') ~ '6-?pin' then '6pin'
    else null
  end;
$$;

create or replace function public.power_connector_conflict(p_gpu_specs jsonb, p_psu_specs jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  requested text;
  requested_type text;
  requested_count integer;
  supplied_count integer;
begin
  if jsonb_typeof(p_gpu_specs -> 'powerConnectors') <> 'array'
    or jsonb_typeof(p_psu_specs -> 'connectors') <> 'array' then
    return false;
  end if;

  for requested in select value from jsonb_array_elements_text(p_gpu_specs -> 'powerConnectors') as needs(value) loop
    requested_type := public.component_power_connector_type(requested);
    if requested_type is null then continue; end if;
    requested_count := coalesce(nullif(substring(requested from '^[[:space:]]*([0-9]+)[[:space:]]*[x×]'), '')::integer, 1);

    select coalesce(sum(coalesce(nullif(substring(supply from '^[[:space:]]*([0-9]+)[[:space:]]*[x×]'), '')::integer, 1)), 0)
    into supplied_count
    from jsonb_array_elements_text(p_psu_specs -> 'connectors') as supplies(supply)
    where public.component_power_connector_type(supply) = requested_type;

    if supplied_count < requested_count then return true; end if;
  end loop;
  return false;
end;
$$;

create or replace function public.build_selection_conflict(
  p_build_id uuid,
  p_component_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  candidate public.components;
  conflict_found boolean;
  cpu_socket text;
  board_socket text;
  board_type text;
  case_gpu_limit numeric;
  gpu_length numeric;
  slots integer;
  selected_gpus integer;
  selected_ram_modules integer;
  selected_ram_capacity numeric;
  max_memory numeric;
  tdp_sum numeric;
  psu_requirement numeric;
  psu_wattage numeric;
begin
  select * into candidate from public.components where id = p_component_id;
  if not found then return 'Componente não encontrado.'; end if;

  if candidate.category = 'CPU' then
    select c.specs ->> 'socket' into board_socket
    from public.build_components bc join public.components c on c.id = bc.component_id
    where bc.build_id = p_build_id and bc.is_active and c.category = 'MOTHERBOARD' limit 1;
    cpu_socket := candidate.specs ->> 'socket';
    if cpu_socket is not null and board_socket is not null and lower(cpu_socket) <> lower(board_socket) then
      return 'Socket da CPU incompatível com a placa-mãe.';
    end if;
    select c.specs ->> 'memoryType' into board_type
    from public.build_components bc join public.components c on c.id = bc.component_id
    where bc.build_id = p_build_id and bc.is_active and c.category = 'MOTHERBOARD' limit 1;
    if board_type is not null and candidate.specs ? 'memoryTypes'
      and not exists (select 1 from jsonb_array_elements_text(candidate.specs -> 'memoryTypes') as types(value) where lower(types.value) = lower(board_type)) then
      return 'A CPU não suporta o tipo de memória da placa-mãe.';
    end if;
  elsif candidate.category = 'MOTHERBOARD' then
    select c.specs ->> 'socket' into cpu_socket
    from public.build_components bc join public.components c on c.id = bc.component_id
    where bc.build_id = p_build_id and bc.is_active and c.category = 'CPU' limit 1;
    board_socket := candidate.specs ->> 'socket';
    if cpu_socket is not null and board_socket is not null and lower(cpu_socket) <> lower(board_socket) then
      return 'Socket da placa-mãe incompatível com a CPU.';
    end if;
    board_type := candidate.specs ->> 'memoryType';
    if board_type is not null and exists (
      select 1 from public.build_components bc join public.components c on c.id = bc.component_id
      where bc.build_id = p_build_id and bc.is_active and c.category = 'RAM'
        and c.specs ->> 'memoryType' is not null
        and lower(c.specs ->> 'memoryType') <> lower(board_type)
    ) then return 'Tipo de RAM incompatível com a placa-mãe.'; end if;
    if candidate.specs ->> 'memorySlots' is not null then
      select coalesce(sum(coalesce((c.specs ->> 'moduleCount')::integer, 1) * bc.quantity), 0)
        into selected_ram_modules
      from public.build_components bc join public.components c on c.id = bc.component_id
      where bc.build_id = p_build_id and bc.is_active and c.category = 'RAM';
      if selected_ram_modules > (candidate.specs ->> 'memorySlots')::integer then
        return 'A quantidade de módulos de RAM excede os slots da placa-mãe.';
      end if;
    end if;
    if candidate.specs ->> 'maxMemoryGb' is not null then
      select coalesce(sum((c.specs ->> 'capacityGb')::numeric * bc.quantity), 0)
        into selected_ram_capacity
      from public.build_components bc join public.components c on c.id = bc.component_id
      where bc.build_id = p_build_id and bc.is_active and c.category = 'RAM'
        and c.specs ->> 'capacityGb' is not null;
      if selected_ram_capacity > (candidate.specs ->> 'maxMemoryGb')::numeric then
        return 'A capacidade de RAM excede o limite da placa-mãe.';
      end if;
    end if;
  elsif candidate.category = 'RAM' then
    select c.specs ->> 'memoryType', (c.specs ->> 'maxMemoryGb')::numeric, (c.specs ->> 'memorySlots')::integer
      into board_type, max_memory, slots
    from public.build_components bc join public.components c on c.id = bc.component_id
    where bc.build_id = p_build_id and bc.is_active and c.category = 'MOTHERBOARD' limit 1;
    if board_type is not null and candidate.specs ->> 'memoryType' is not null
      and lower(board_type) <> lower(candidate.specs ->> 'memoryType') then
      return 'Tipo de RAM incompatível com a placa-mãe.';
    end if;
    if max_memory is not null and candidate.specs ->> 'capacityGb' is not null then
      select coalesce(sum((c.specs ->> 'capacityGb')::numeric * bc.quantity), 0)
        into selected_ram_capacity
      from public.build_components bc join public.components c on c.id = bc.component_id
      where bc.build_id = p_build_id and bc.is_active and c.category = 'RAM'
        and c.specs ->> 'capacityGb' is not null;
      if selected_ram_capacity + (candidate.specs ->> 'capacityGb')::numeric > max_memory then
        return 'A capacidade de RAM excede o limite da placa-mãe.';
      end if;
    end if;
    if slots is not null then
      select coalesce(sum(coalesce((c.specs ->> 'moduleCount')::integer, 1) * bc.quantity), 0)
        into selected_ram_modules
      from public.build_components bc join public.components c on c.id = bc.component_id
      where bc.build_id = p_build_id and bc.is_active and c.category = 'RAM';
      if selected_ram_modules + coalesce((candidate.specs ->> 'moduleCount')::integer, 1) > slots then
        return 'A quantidade de módulos de RAM excede os slots da placa-mãe.';
      end if;
    end if;
  elsif candidate.category = 'GPU' then
    select (c.specs ->> 'gpuMaxLengthMm')::numeric into case_gpu_limit
    from public.build_components bc join public.components c on c.id = bc.component_id
    where bc.build_id = p_build_id and bc.is_active and c.category = 'CASE' limit 1;
    gpu_length := (candidate.specs ->> 'lengthMm')::numeric;
    if case_gpu_limit is not null and gpu_length is not null and gpu_length > case_gpu_limit then
      return 'A GPU é maior que o espaço disponível no gabinete.';
    end if;
    select (c.specs ->> 'pcieSlots')::integer into slots
    from public.build_components bc join public.components c on c.id = bc.component_id
    where bc.build_id = p_build_id and bc.is_active and c.category = 'MOTHERBOARD' limit 1;
    if slots is not null then
      select count(*)::integer into selected_gpus
      from public.build_components bc join public.components c on c.id = bc.component_id
      where bc.build_id = p_build_id and bc.is_active and c.category = 'GPU';
      if selected_gpus + 1 > slots then return 'A quantidade de GPUs excede os slots PCIe.'; end if;
    end if;
  elsif candidate.category = 'CASE' then
    if candidate.specs ? 'gpuMaxLengthMm' and exists (
      select 1 from public.build_components bc join public.components c on c.id = bc.component_id
      where bc.build_id = p_build_id and bc.is_active and c.category = 'GPU'
        and c.specs ->> 'lengthMm' is not null
        and (c.specs ->> 'lengthMm')::numeric > (candidate.specs ->> 'gpuMaxLengthMm')::numeric
    ) then return 'A GPU é maior que o espaço disponível no gabinete.'; end if;
    if candidate.specs ? 'cpuCoolerMaxHeightMm' and exists (
      select 1 from public.build_components bc join public.components c on c.id = bc.component_id
      where bc.build_id = p_build_id and bc.is_active and c.category = 'CPU_COOLER'
        and c.specs ->> 'heightMm' is not null
        and (c.specs ->> 'heightMm')::numeric > (candidate.specs ->> 'cpuCoolerMaxHeightMm')::numeric
    ) then return 'O cooler é mais alto que o limite do gabinete.'; end if;
    if candidate.specs ? 'formFactorSupport' and exists (
      select 1 from public.build_components bc join public.components c on c.id = bc.component_id
      where bc.build_id = p_build_id and bc.is_active and c.category = 'MOTHERBOARD'
        and c.specs ->> 'formFactor' is not null
        and not exists (select 1 from jsonb_array_elements_text(candidate.specs -> 'formFactorSupport') as formats(value) where lower(formats.value) = lower(c.specs ->> 'formFactor'))
    ) then return 'O gabinete não suporta o formato da placa-mãe.'; end if;
  elsif candidate.category = 'CPU_COOLER' then
    if candidate.specs ? 'supportedSockets' and exists (
      select 1 from public.build_components bc join public.components c on c.id = bc.component_id
      where bc.build_id = p_build_id and bc.is_active and c.category in ('CPU','MOTHERBOARD')
        and c.specs ->> 'socket' is not null
        and not exists (select 1 from jsonb_array_elements_text(candidate.specs -> 'supportedSockets') as sockets(value) where lower(sockets.value) = lower(c.specs ->> 'socket'))
    ) then return 'O cooler não suporta o socket selecionado.'; end if;
    if candidate.specs ->> 'heightMm' is not null and exists (
      select 1 from public.build_components bc join public.components c on c.id = bc.component_id
      where bc.build_id = p_build_id and bc.is_active and c.category = 'CASE'
        and c.specs ->> 'cpuCoolerMaxHeightMm' is not null
        and (candidate.specs ->> 'heightMm')::numeric > (c.specs ->> 'cpuCoolerMaxHeightMm')::numeric
    ) then return 'O cooler é mais alto que o limite do gabinete.'; end if;
  elsif candidate.category = 'STORAGE' then
    if candidate.specs ->> 'interface' is not null and exists (
      select 1 from public.build_components bc join public.components c on c.id = bc.component_id
      where bc.build_id = p_build_id and bc.is_active and c.category = 'MOTHERBOARD'
        and c.specs ? 'storageInterfaces'
        and not exists (select 1 from jsonb_array_elements_text(c.specs -> 'storageInterfaces') as interfaces(value) where lower(interfaces.value) = lower(candidate.specs ->> 'interface'))
    ) then return 'A placa-mãe não suporta a interface de armazenamento.'; end if;
  end if;

  if candidate.category = 'GPU' and exists (
    select 1 from public.build_components bc join public.components c on c.id = bc.component_id
    where bc.build_id = p_build_id and bc.is_active and c.category = 'PSU'
      and public.power_connector_conflict(candidate.specs, c.specs)
  ) then return 'A fonte não informa os conectores necessários para a GPU.'; end if;
  if candidate.category = 'PSU' and exists (
    select 1 from public.build_components bc join public.components c on c.id = bc.component_id
    where bc.build_id = p_build_id and bc.is_active and c.category = 'GPU'
      and public.power_connector_conflict(c.specs, candidate.specs)
  ) then return 'A fonte não informa os conectores necessários para a GPU.'; end if;

  if candidate.category in ('PSU','CPU','GPU') then
    select max((c.specs ->> 'wattageW')::numeric) into psu_wattage
    from public.build_components bc join public.components c on c.id = bc.component_id
    where bc.build_id = p_build_id and bc.is_active and c.category = 'PSU';
    if candidate.category = 'PSU' then psu_wattage := (candidate.specs ->> 'wattageW')::numeric; end if;
    if psu_wattage is not null then
      select coalesce(sum((c.specs ->> 'tdpW')::numeric * bc.quantity), 0)
        into tdp_sum
      from public.build_components bc join public.components c on c.id = bc.component_id
      where bc.build_id = p_build_id and bc.is_active and c.category in ('CPU','GPU')
        and c.specs ->> 'tdpW' is not null;
      if candidate.category in ('CPU','GPU') and candidate.specs ->> 'tdpW' is not null then
        tdp_sum := tdp_sum + (candidate.specs ->> 'tdpW')::numeric;
      end if;
      select coalesce(max((c.specs ->> 'recommendedPsuW')::numeric), 0)
        into psu_requirement
      from public.build_components bc join public.components c on c.id = bc.component_id
      where bc.build_id = p_build_id and bc.is_active and c.category = 'GPU'
        and c.specs ->> 'recommendedPsuW' is not null;
      if candidate.category = 'GPU' and candidate.specs ->> 'recommendedPsuW' is not null then
        psu_requirement := greatest(psu_requirement, (candidate.specs ->> 'recommendedPsuW')::numeric);
      end if;
      if greatest(tdp_sum + 100, psu_requirement) > psu_wattage then
        return 'A potência da fonte é inferior ao requisito estimado do sistema.';
      end if;
    end if;
  end if;

  return null;
end;
$$;

create or replace function public.refresh_build_status(p_build_id uuid)
returns public.build_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_status public.build_status;
begin
  if exists (
    select 1 from public.build_components bc
    where bc.build_id = p_build_id and bc.is_active
      and bc.compatibility_status = 'incompatible'
  ) then
    next_status := 'INCOMPLETE';
  elsif exists (
    select 1 from public.build_components bc
    where bc.build_id = p_build_id and bc.is_active and not bc.compatibility_confirmed
  ) then
    next_status := 'INCOMPLETE';
  elsif exists (
    select 1 from public.build_components bc join public.components c on c.id = bc.component_id
    where bc.build_id = p_build_id and bc.is_active and c.category = 'CPU'
  ) and exists (
    select 1 from public.build_components bc join public.components c on c.id = bc.component_id
    where bc.build_id = p_build_id and bc.is_active and c.category = 'MOTHERBOARD'
  ) and exists (
    select 1 from public.build_components bc join public.components c on c.id = bc.component_id
    where bc.build_id = p_build_id and bc.is_active and c.category = 'RAM'
  ) and exists (
    select 1 from public.build_components bc join public.components c on c.id = bc.component_id
    where bc.build_id = p_build_id and bc.is_active and c.category = 'STORAGE'
  ) and exists (
    select 1 from public.build_components bc join public.components c on c.id = bc.component_id
    where bc.build_id = p_build_id and bc.is_active and c.category = 'PSU'
  ) and exists (
    select 1 from public.build_components bc join public.components c on c.id = bc.component_id
    where bc.build_id = p_build_id and bc.is_active and c.category = 'CASE'
  ) then
    next_status := 'READY';
  elsif exists (select 1 from public.build_components bc where bc.build_id = p_build_id and bc.is_active) then
    next_status := 'INCOMPLETE';
  else
    next_status := 'DRAFT';
  end if;

  update public.builds set status = next_status where id = p_build_id;
  return next_status;
end;
$$;

alter table public.builds enable row level security;
alter table public.build_components enable row level security;
alter table public.inventory_reservations enable row level security;

grant select on public.builds, public.build_components, public.inventory_reservations to authenticated;

create policy "Users can read accessible builds"
on public.builds for select to authenticated
using ((select public.can_access_build(id)));

create policy "Users can read components in accessible builds"
on public.build_components for select to authenticated
using ((select public.can_access_build(build_id)));

create policy "Users can read reservations in accessible builds"
on public.inventory_reservations for select to authenticated
using (
  exists (
    select 1 from public.build_components bc
    where bc.id = build_component_id and (select public.can_access_build(bc.build_id))
  )
);

create or replace function public.create_build(p_name text, p_notes text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles;
  new_build public.builds;
begin
  select * into actor from public.profiles where auth_user_id = (select auth.uid()) and is_active;
  if actor.id is null then raise exception 'Sessão ativa necessária.' using errcode = '42501'; end if;
  if p_name is null or length(trim(p_name)) = 0 then raise exception 'Informe o nome do build.' using errcode = '22023'; end if;

  insert into public.builds (name, created_by, notes)
  values (trim(p_name), actor.id, nullif(trim(p_notes), ''))
  returning * into new_build;

  insert into public.audit_logs (user_id, action, entity_type, entity_id, new_data)
  values (actor.id, 'build.created', 'build', new_build.id, to_jsonb(new_build));
  return new_build.id;
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

  conflict_message := public.build_selection_conflict(p_build_id, p_component_id);
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

create or replace function public.release_build_component(p_build_component_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_profile_id uuid;
  item public.build_components;
  build_row public.builds;
  reservation public.inventory_reservations;
begin
  select * into item from public.build_components where id = p_build_component_id;
  if item.id is null then raise exception 'Peça do build não encontrada.' using errcode = 'P0002'; end if;
  select * into build_row from public.builds where id = item.build_id for update;
  if not public.can_manage_build(item.build_id) then raise exception 'Sem permissão para alterar este build.' using errcode = '42501'; end if;
  select * into item from public.build_components where id = p_build_component_id for update;
  if not item.is_active then return; end if;
  if build_row.status in ('COMPLETED','CANCELLED') then raise exception 'Este build já foi encerrado.' using errcode = '55000'; end if;

  select * into reservation from public.inventory_reservations where build_component_id = item.id and status = 'ACTIVE' for update;
  if reservation.id is not null then
    update public.component_lots set reserved_quantity = reserved_quantity - reservation.quantity where id = item.lot_id and reserved_quantity >= reservation.quantity;
    if not found then raise exception 'Saldo de reserva inconsistente.' using errcode = '23514'; end if;
    update public.inventory_reservations set status = 'RELEASED', released_at = now() where id = reservation.id;
  end if;
  update public.build_components set is_active = false, released_at = now() where id = item.id;
  perform public.refresh_build_status(item.build_id);
  update public.builds set updated_at = now() where id = item.build_id;
  select id into actor_profile_id from public.profiles where auth_user_id = actor_id;
  insert into public.audit_logs (user_id, action, entity_type, entity_id, old_data)
  values (actor_profile_id, 'inventory.released', 'build_component', item.id, to_jsonb(item));
end;
$$;

create or replace function public.cancel_build(p_build_id uuid)
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
  if build_row.id is null or not public.can_manage_build(p_build_id) then raise exception 'Build não encontrado ou sem permissão.' using errcode = '42501'; end if;
  if build_row.status = 'COMPLETED' then raise exception 'Um build concluído não pode ser cancelado.' using errcode = '55000'; end if;
  if build_row.status = 'CANCELLED' then return; end if;

  for item in
    select bc.id, bc.lot_id, r.id as reservation_id, r.quantity
    from public.build_components bc
    join public.inventory_reservations r on r.build_component_id = bc.id and r.status = 'ACTIVE'
    where bc.build_id = p_build_id and bc.is_active
    for update of bc, r
  loop
    update public.component_lots set reserved_quantity = reserved_quantity - item.quantity
      where id = item.lot_id and reserved_quantity >= item.quantity;
    if not found then raise exception 'Saldo de reserva inconsistente.' using errcode = '23514'; end if;
    update public.inventory_reservations set status = 'RELEASED', released_at = now() where id = item.reservation_id;
    update public.build_components set is_active = false, released_at = now() where id = item.id;
  end loop;

  update public.builds set status = 'CANCELLED', updated_at = now() where id = p_build_id;
  select id into actor_profile_id from public.profiles where auth_user_id = actor_id;
  insert into public.audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
  values (actor_profile_id, 'build.cancelled', 'build', p_build_id, to_jsonb(build_row), jsonb_build_object('status','CANCELLED'));
end;
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
  next_status public.build_status;
begin
  select * into build_row from public.builds where id = p_build_id for update;
  if build_row.id is null or not public.can_manage_build(p_build_id) then raise exception 'Build não encontrado ou sem permissão.' using errcode = '42501'; end if;
  if build_row.status in ('COMPLETED','CANCELLED') then raise exception 'Este build já foi encerrado.' using errcode = '55000'; end if;

  next_status := public.refresh_build_status(p_build_id);
  if next_status <> 'READY' then raise exception 'O build ainda está incompleto ou possui avisos não confirmados.' using errcode = '23514'; end if;

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
    update public.inventory_reservations set status = 'ALLOCATED', allocated_at = now() where id = item.reservation_id;
  end loop;

  update public.builds set status = 'COMPLETED', completed_at = now(), updated_at = now() where id = p_build_id;
  select id into actor_profile_id from public.profiles where auth_user_id = actor_id;
  insert into public.audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
  values (actor_profile_id, 'build.completed', 'build', p_build_id, to_jsonb(build_row), jsonb_build_object('status','COMPLETED'));
end;
$$;

revoke all on function public.can_access_build(uuid) from public;
revoke all on function public.can_manage_build(uuid) from public;
revoke all on function public.build_selection_conflict(uuid, uuid) from public;
revoke all on function public.refresh_build_status(uuid) from public;
revoke all on function public.create_build(text, text) from public;
revoke all on function public.reserve_build_component(uuid, uuid, uuid, text, integer, text, boolean) from public;
revoke all on function public.release_build_component(uuid) from public;
revoke all on function public.cancel_build(uuid) from public;
revoke all on function public.complete_build(uuid) from public;

grant execute on function public.can_access_build(uuid) to authenticated;
grant execute on function public.can_manage_build(uuid) to authenticated;
grant execute on function public.create_build(text, text) to authenticated;
grant execute on function public.reserve_build_component(uuid, uuid, uuid, text, integer, text, boolean) to authenticated;
grant execute on function public.release_build_component(uuid) to authenticated;
grant execute on function public.cancel_build(uuid) to authenticated;
grant execute on function public.complete_build(uuid) to authenticated;
