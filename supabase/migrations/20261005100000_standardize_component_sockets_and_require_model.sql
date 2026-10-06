create table public.socket_catalog (
  manufacturer text not null check (manufacturer in ('Intel', 'AMD')),
  socket text primary key,
  sort_order integer not null,
  constraint socket_catalog_manufacturer_socket_unique unique (manufacturer, socket)
);

insert into public.socket_catalog (manufacturer, socket, sort_order) values
  ('Intel', 'LGA 1851', 1),
  ('Intel', 'LGA 1700', 2),
  ('Intel', 'LGA 2066', 3),
  ('Intel', 'LGA 2011-v3', 4),
  ('Intel', 'LGA 2011', 5),
  ('Intel', 'LGA 1366', 6),
  ('Intel', 'LGA 1200', 7),
  ('Intel', 'LGA 1156', 8),
  ('Intel', 'LGA 1155', 9),
  ('Intel', 'LGA 1151', 10),
  ('Intel', 'LGA 1150', 11),
  ('Intel', 'LGA 775', 12),
  ('AMD', 'AM5', 1),
  ('AMD', 'AM4', 2),
  ('AMD', 'sTR5', 3),
  ('AMD', 'sTRX4', 4),
  ('AMD', 'TR4', 5),
  ('AMD', 'sWRX8', 6),
  ('AMD', 'AM3+', 7),
  ('AMD', 'AM3', 8),
  ('AMD', 'AM2+', 9),
  ('AMD', 'AM2', 10),
  ('AMD', 'AM1', 11),
  ('AMD', 'FM2+', 12),
  ('AMD', 'FM2', 13),
  ('AMD', 'FM1', 14)
on conflict (socket) do update
set manufacturer = excluded.manufacturer, sort_order = excluded.sort_order;

alter table public.socket_catalog enable row level security;
grant select on public.socket_catalog to authenticated;
create policy socket_catalog_read_authenticated
on public.socket_catalog for select to authenticated using (true);

create or replace function public.normalize_socket_label(p_socket text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
    case
      when upper(trim(coalesce(p_socket, ''))) like 'FCLGA%' then substr(upper(trim(p_socket)), 3)
      else regexp_replace(upper(trim(coalesce(p_socket, ''))), '^SOCKET[[:space:]-]*', '')
    end,
    '[[:space:]_-]', '', 'g'
  )
$$;

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
    when 'CPU' then array[
      'socket','cores','threads','baseClockMhz','boostClockMhz','tdpW','integratedGraphics',
      'memoryTypes','maxMemoryFrequencyMhz','maxMemoryCapacityGb',
      'microarchitecture','generation','integratedGraphicsModel','memoryChannels','cacheL2Mb','cacheL3Mb',
      'pcieVersion','pcieLanes','instructionSets','virtualization'
    ]
    when 'MOTHERBOARD' then array[
      'socket','pcieVersion','chipset','formFactor','memoryType','memorySlots','maxMemoryGb',
      'supportedMemoryFrequenciesMhz','storageInterfaces','pcieSlots','eccSupport'
    ]
    when 'RAM' then array['memoryType','capacityGb','frequencyMhz','formFactor','ecc','casLatency','voltage','moduleCount','registered']
    when 'GPU' then array['vramGb','recommendedPsuW','interface','lengthMm','powerConnectors','tdpW']
    when 'STORAGE' then array['type','capacityGb','interface','readSpeedMbS','writeSpeedMbS','formFactor']
    when 'PSU' then array['wattageW','efficiencyRating','formFactor','connectors']
    when 'CASE' then array['formFactorSupport','gpuMaxLengthMm','cpuCoolerMaxHeightMm','psuFormFactors','driveBays25','driveBays35']
    when 'CPU_COOLER' then array['supportedSockets','socketAdapter','formFactor','heightMm','tdpRatingW']
  end;

  for key_name in select jsonb_object_keys(p_specs) loop
    if not key_name = any(allowed_keys) then return false; end if;
    value := p_specs -> key_name;
    if key_name in ('socket','pcieVersion','chipset','formFactor','memoryType','interface','type','efficiencyRating','microarchitecture','generation','integratedGraphicsModel') then
      if jsonb_typeof(value) <> 'string' or length(trim(value #>> '{}')) = 0 then return false; end if;
    elsif key_name in ('integratedGraphics','ecc','eccSupport','registered','socketAdapter') then
      if jsonb_typeof(value) <> 'boolean' then return false; end if;
    elsif key_name in ('memoryTypes','instructionSets','virtualization','storageInterfaces','formFactorSupport','psuFormFactors','supportedSockets','powerConnectors','connectors') then
      if jsonb_typeof(value) <> 'array' then return false; end if;
      if exists (
        select 1 from jsonb_array_elements(value) as elements(item)
        where jsonb_typeof(elements.item) <> 'string' or length(trim(elements.item #>> '{}')) = 0
      ) then return false; end if;
    elsif key_name = 'supportedMemoryFrequenciesMhz' then
      if jsonb_typeof(value) <> 'array' then return false; end if;
      if exists (
        select 1 from jsonb_array_elements(value) as elements(item)
        where jsonb_typeof(elements.item) <> 'number' or (elements.item #>> '{}')::numeric < 0
      ) then return false; end if;
    else
      if jsonb_typeof(value) <> 'number' then return false; end if;
      number_value := (value #>> '{}')::numeric;
      if number_value < 0 then return false; end if;
      if key_name in ('cores','threads','memorySlots','memoryChannels','pcieLanes','pcieSlots','casLatency','moduleCount','driveBays25','driveBays35') and trunc(number_value) <> number_value then
        return false;
      end if;
    end if;
  end loop;

  return true;
end;
$$;

-- Normalize existing processor and motherboard socket labels to the same values
-- used in the catalog and by the compatibility checks.
update public.components component
set specs = jsonb_set(component.specs, '{socket}', to_jsonb(catalog.socket), true)
from public.socket_catalog catalog
where component.category in ('CPU', 'MOTHERBOARD')
  and public.normalize_socket_label(case
    when component.category = 'CPU'
      and trim(component.specs ->> 'socket') ~ '^[0-9]+$'
      and component.manufacturer in ('Intel', 'AMD')
      then (case component.manufacturer when 'Intel' then 'LGA ' else 'AM ' end) || trim(component.specs ->> 'socket')
    else component.specs ->> 'socket'
  end) = public.normalize_socket_label(catalog.socket)
  and (component.category <> 'CPU' or catalog.manufacturer = component.manufacturer);

-- Normalize existing cooler socket lists and mark multi-socket coolers as having
-- an adapter, preserving their existing compatibility data.
with normalized as (
  select component.id,
    jsonb_agg(catalog.socket order by socket_entry.ordinality) as sockets
  from public.components component
  cross join lateral jsonb_array_elements_text(case
    when component.category = 'CPU_COOLER' and jsonb_typeof(component.specs -> 'supportedSockets') = 'array'
      then component.specs -> 'supportedSockets'
    else '[]'::jsonb
  end)
    with ordinality as socket_entry(value, ordinality)
  join public.socket_catalog catalog
    on public.normalize_socket_label(socket_entry.value) = public.normalize_socket_label(catalog.socket)
  where component.category = 'CPU_COOLER'
    and jsonb_typeof(component.specs -> 'supportedSockets') = 'array'
  group by component.id
  having count(catalog.socket) = jsonb_array_length(component.specs -> 'supportedSockets')
)
update public.components component
set specs = component.specs || jsonb_build_object(
  'supportedSockets', normalized.sockets,
  'socketAdapter', coalesce((component.specs ->> 'socketAdapter')::boolean, false)
    or jsonb_array_length(normalized.sockets) > 1
)
from normalized
where component.id = normalized.id;

create or replace function public.enforce_component_socket_catalog()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  normalized_socket text;
  canonical_socket text;
  socket_entry record;
  canonical_sockets jsonb := '[]'::jsonb;
  adapter_enabled boolean;
begin
  if tg_op = 'UPDATE' then
    if new.category = 'CPU'
      and new.category = old.category
      and new.manufacturer = old.manufacturer
      and new.specs -> 'socket' is not distinct from old.specs -> 'socket' then return new; end if;
    if new.category = 'MOTHERBOARD'
      and new.category = old.category
      and new.specs -> 'socket' is not distinct from old.specs -> 'socket' then return new; end if;
    if new.category = 'CPU_COOLER'
      and new.category = old.category
      and new.specs -> 'supportedSockets' is not distinct from old.specs -> 'supportedSockets'
      and new.specs -> 'socketAdapter' is not distinct from old.specs -> 'socketAdapter' then return new; end if;
    if new.category not in ('CPU', 'MOTHERBOARD', 'CPU_COOLER')
      and new.category = old.category then return new; end if;
  end if;

  if new.category = 'CPU' or new.category = 'MOTHERBOARD' then
    if jsonb_typeof(new.specs -> 'socket') is distinct from 'string'
      or length(trim(new.specs ->> 'socket')) = 0 then
      raise exception 'Selecione um socket válido para este componente.' using errcode = '23514';
    end if;

    normalized_socket := public.normalize_socket_label(new.specs ->> 'socket');
    select catalog.socket into canonical_socket
    from public.socket_catalog catalog
    where public.normalize_socket_label(catalog.socket) = normalized_socket
      and (new.category <> 'CPU' or catalog.manufacturer = trim(new.manufacturer));

    if canonical_socket is null then
      raise exception 'Socket inválido para o fabricante selecionado.' using errcode = '23514';
    end if;

    new.specs := jsonb_set(new.specs, '{socket}', to_jsonb(canonical_socket), true);
  elsif new.category = 'CPU_COOLER' then
    if jsonb_typeof(new.specs -> 'supportedSockets') is distinct from 'array'
      or jsonb_array_length(new.specs -> 'supportedSockets') = 0 then
      raise exception 'Selecione ao menos um socket compatível para o cooler.' using errcode = '23514';
    end if;
    if new.specs ? 'socketAdapter' and jsonb_typeof(new.specs -> 'socketAdapter') <> 'boolean' then
      raise exception 'A opção de adaptador precisa ser verdadeira ou falsa.' using errcode = '23514';
    end if;
    adapter_enabled := coalesce((new.specs ->> 'socketAdapter')::boolean, false);

    for socket_entry in
      select value from jsonb_array_elements_text(new.specs -> 'supportedSockets') as socket_values(value)
    loop
      select catalog.socket into canonical_socket
      from public.socket_catalog catalog
      where public.normalize_socket_label(catalog.socket) = public.normalize_socket_label(socket_entry.value);
      if canonical_socket is null then
        raise exception 'Socket de cooler inválido: %.', socket_entry.value using errcode = '23514';
      end if;
      if not canonical_sockets @> jsonb_build_array(canonical_socket) then
        canonical_sockets := canonical_sockets || jsonb_build_array(canonical_socket);
      end if;
    end loop;

    if jsonb_array_length(canonical_sockets) > 1 and not adapter_enabled then
      raise exception 'Ative a opção de adaptador para cadastrar mais de um socket.' using errcode = '23514';
    end if;
    new.specs := jsonb_set(new.specs, '{supportedSockets}', canonical_sockets, true);
    new.specs := jsonb_set(new.specs, '{socketAdapter}', to_jsonb(adapter_enabled), true);
  end if;

  return new;
end;
$$;

create trigger components_enforce_socket_catalog
before insert or update of category, manufacturer, specs on public.components
for each row execute function public.enforce_component_socket_catalog();

create or replace function public.admin_create_component(
  p_category public.component_category,
  p_manufacturer text,
  p_name text,
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
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Informe o nome do componente.' using errcode = '22023';
  end if;
  if p_model is null or length(trim(p_model)) = 0 then
    raise exception 'Informe o modelo do componente.' using errcode = '22023';
  end if;

  select id into actor_profile_id from public.profiles where auth_user_id = actor_id;
  insert into public.components (
    category, manufacturer, name, model, description, specs, created_by
  ) values (
    p_category,
    trim(p_manufacturer),
    trim(p_name),
    trim(p_model),
    nullif(trim(p_description), ''),
    coalesce(p_specs, '{}'::jsonb),
    actor_profile_id
  ) returning * into new_component;

  if p_quantity > 0 then
    insert into public.component_lots (
      component_id, lot_code, quantity_total, purchase_date, notes
    ) values (
      new_component.id,
      nullif(trim(p_lot_code), ''),
      p_quantity,
      p_purchase_date,
      nullif(trim(p_notes), '')
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
