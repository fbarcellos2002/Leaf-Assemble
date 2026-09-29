alter table public.component_lots
  alter column lot_code drop not null,
  drop constraint if exists component_lots_code_not_blank;

alter table public.component_lots
  add constraint component_lots_code_not_blank
  check (lot_code is null or length(trim(lot_code)) > 0);

create or replace function public.component_specs_are_valid(
  p_category public.component_category,
  p_specs jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  allowed_keys text[];
  key_name text;
  value jsonb;
  number_value numeric;
begin
  if p_specs is null or jsonb_typeof(p_specs) <> 'object' then return false; end if;

  allowed_keys := case p_category
    when 'CPU' then array['socket','cores','threads','baseClockMhz','boostClockMhz','tdpW','integratedGraphics','memoryTypes','maxMemoryFrequencyMhz']
    when 'MOTHERBOARD' then array['socket','chipset','formFactor','memoryType','memorySlots','maxMemoryGb','supportedMemoryFrequenciesMhz','eccSupport','storageInterfaces','pcieSlots']
    when 'RAM' then array['memoryType','capacityGb','frequencyMhz','casLatency','voltage','moduleCount','formFactor','ecc','registered']
    when 'GPU' then array['vramGb','interface','lengthMm','powerConnectors','recommendedPsuW','tdpW']
    when 'STORAGE' then array['type','capacityGb','interface','formFactor','readSpeedMbS','writeSpeedMbS']
    when 'PSU' then array['wattageW','efficiencyRating','formFactor','connectors']
    when 'CASE' then array['formFactorSupport','gpuMaxLengthMm','cpuCoolerMaxHeightMm','psuFormFactors','driveBays25','driveBays35']
    when 'CPU_COOLER' then array['supportedSockets','heightMm','tdpRatingW','formFactor']
  end;

  for key_name in select jsonb_object_keys(p_specs) loop
    if not key_name = any(allowed_keys) then return false; end if;
    value := p_specs -> key_name;
    if key_name in ('socket','chipset','formFactor','memoryType','interface','type','efficiencyRating') then
      if jsonb_typeof(value) <> 'string' or length(trim(value #>> '{}')) = 0 then return false; end if;
    elsif key_name in ('integratedGraphics','eccSupport','ecc','registered') then
      if jsonb_typeof(value) <> 'boolean' then return false; end if;
    elsif key_name in ('memoryTypes','storageInterfaces','powerConnectors','connectors','formFactorSupport','psuFormFactors','supportedSockets') then
      if jsonb_typeof(value) <> 'array' then return false; end if;
      if exists (
        select 1 from jsonb_array_elements(value) as elements(item)
        where jsonb_typeof(elements.item) <> 'string' or length(trim(elements.item #>> '{}')) = 0
      ) then return false; end if;
    elsif key_name = 'supportedMemoryFrequenciesMhz' then
      if jsonb_typeof(value) <> 'array' then return false; end if;
      if exists (
        select 1 from jsonb_array_elements(value) as elements(item)
        where jsonb_typeof(elements.item) <> 'number' or (elements.item #>> '{}')::numeric <= 0
      ) then return false; end if;
    else
      if jsonb_typeof(value) <> 'number' then return false; end if;
      number_value := (value #>> '{}')::numeric;
      if key_name in ('driveBays25','driveBays35') then
        if number_value < 0 or trunc(number_value) <> number_value then return false; end if;
      elsif number_value <= 0 then
        return false;
      elsif key_name in ('cores','threads','memorySlots','casLatency','moduleCount','pcieSlots') and trunc(number_value) <> number_value then
        return false;
      end if;
    end if;
  end loop;

  return true;
end;
$$;

create or replace function public.admin_create_component(
  p_category public.component_category,
  p_manufacturer text,
  p_model text,
  p_description text,
  p_specs jsonb,
  p_lot_code text,
  p_quantity integer,
  p_purchase_date date,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_profile_id uuid;
  new_component public.components;
  new_lot public.component_lots;
begin
  if not public.is_active_admin() then
    raise exception 'Apenas administradores ativos podem cadastrar componentes.'
      using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity < 0 or p_quantity > 100000 then
    raise exception 'A quantidade inicial deve estar entre zero e cem mil.' using errcode = '22023';
  end if;

  select id into actor_profile_id from public.profiles where auth_user_id = actor_id;
  insert into public.components (
    category, manufacturer, model, description, specs, created_by
  ) values (
    p_category, trim(p_manufacturer), trim(p_model), nullif(trim(p_description), ''),
    coalesce(p_specs, '{}'::jsonb), actor_profile_id
  ) returning * into new_component;

  if p_quantity > 0 then
    insert into public.component_lots (
      component_id, lot_code, quantity_total, purchase_date, notes
    ) values (
      new_component.id, nullif(trim(p_lot_code), ''), p_quantity, p_purchase_date, nullif(trim(p_notes), '')
    ) returning * into new_lot;
  end if;

  insert into public.audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
  values (
    actor_profile_id,
    'component.created',
    'component',
    new_component.id,
    null,
    jsonb_build_object(
      'component', to_jsonb(new_component),
      'initial_lot', case when p_quantity > 0 then to_jsonb(new_lot) else null end
    )
  );

  return new_component.id;
end;
$$;

create or replace function public.admin_receive_stock(
  p_component_id uuid,
  p_lot_code text,
  p_quantity integer,
  p_purchase_date date,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_profile_id uuid;
  clean_lot_code text := nullif(trim(p_lot_code), '');
  previous_lot public.component_lots;
  updated_lot public.component_lots;
begin
  if not public.is_active_admin() then
    raise exception 'Apenas administradores ativos podem alterar o estoque.'
      using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > 100000 then
    raise exception 'Informe uma quantidade positiva.' using errcode = '22023';
  end if;

  perform 1 from public.components where id = p_component_id for update;
  if not found then
    raise exception 'Componente não encontrado.' using errcode = 'P0002';
  end if;
  select id into actor_profile_id from public.profiles where auth_user_id = actor_id;

  if clean_lot_code is not null then
    select * into previous_lot
    from public.component_lots
    where component_id = p_component_id and lot_code = clean_lot_code
    for update;
  end if;

  insert into public.component_lots (
    component_id, lot_code, quantity_total, purchase_date, notes
  ) values (
    p_component_id, clean_lot_code, p_quantity, p_purchase_date, nullif(trim(p_notes), '')
  )
  on conflict (component_id, lot_code) do update
  set quantity_total = public.component_lots.quantity_total + excluded.quantity_total,
      purchase_date = coalesce(excluded.purchase_date, public.component_lots.purchase_date),
      notes = coalesce(excluded.notes, public.component_lots.notes)
  returning * into updated_lot;

  insert into public.audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
  values (
    actor_profile_id,
    'inventory.received',
    'component_lot',
    updated_lot.id,
    case when previous_lot.id is null then null else to_jsonb(previous_lot) end,
    to_jsonb(updated_lot)
  );

  return updated_lot.id;
end;
$$;

create or replace function public.admin_remove_stock(
  p_lot_id uuid,
  p_quantity integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_profile_id uuid;
  previous_lot public.component_lots;
  updated_lot public.component_lots;
begin
  if not public.is_active_admin() then
    raise exception 'Apenas administradores ativos podem alterar o estoque.'
      using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > 100000 then
    raise exception 'Informe uma quantidade positiva para remover.' using errcode = '22023';
  end if;

  select * into previous_lot
  from public.component_lots
  where id = p_lot_id
  for update;
  if not found then
    raise exception 'Lote não encontrado.' using errcode = 'P0002';
  end if;
  if p_quantity > previous_lot.available_quantity then
    raise exception 'A quantidade excede as unidades disponíveis neste lote.' using errcode = '22023';
  end if;

  select id into actor_profile_id from public.profiles where auth_user_id = actor_id;
  update public.component_lots
  set quantity_total = quantity_total - p_quantity
  where id = p_lot_id
  returning * into updated_lot;

  insert into public.audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
  values (
    actor_profile_id,
    'inventory.removed',
    'component_lot',
    updated_lot.id,
    to_jsonb(previous_lot),
    to_jsonb(updated_lot)
  );

  return updated_lot.id;
end;
$$;

revoke all on function public.admin_remove_stock(uuid, integer) from public;
grant execute on function public.admin_remove_stock(uuid, integer) to authenticated;

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
  ) and (
    exists (
      select 1 from public.build_components bc join public.components c on c.id = bc.component_id
      where bc.build_id = p_build_id and bc.is_active
        and c.category = 'CPU' and c.specs ->> 'integratedGraphics' = 'true'
    ) or exists (
      select 1 from public.build_components bc join public.components c on c.id = bc.component_id
      where bc.build_id = p_build_id and bc.is_active and c.category = 'GPU'
    )
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

do $$
declare
  active_build_id uuid;
begin
  for active_build_id in
    select id from public.builds where status in ('DRAFT', 'INCOMPLETE', 'READY')
  loop
    perform public.refresh_build_status(active_build_id);
  end loop;
end;
$$;
