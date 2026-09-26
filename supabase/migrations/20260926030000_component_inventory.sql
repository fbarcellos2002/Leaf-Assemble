create type public.component_category as enum (
  'CPU',
  'MOTHERBOARD',
  'RAM',
  'GPU',
  'STORAGE',
  'PSU',
  'CASE',
  'CPU_COOLER'
);

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
    when 'CPU' then array['socket','cores','threads','baseClockMhz','boostClockMhz','tdpW','integratedGraphics','memoryTypes']
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
      if exists (select 1 from jsonb_array_elements(value) as elements(item) where jsonb_typeof(elements.item) <> 'string' or length(trim(elements.item #>> '{}')) = 0) then return false; end if;
    elsif key_name = 'supportedMemoryFrequenciesMhz' then
      if jsonb_typeof(value) <> 'array' then return false; end if;
      if exists (select 1 from jsonb_array_elements(value) as elements(item) where jsonb_typeof(elements.item) <> 'number' or (elements.item #>> '{}')::numeric <= 0) then return false; end if;
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

create table public.components (
  id uuid primary key default gen_random_uuid(),
  category public.component_category not null,
  manufacturer text not null,
  model text not null,
  description text,
  specs jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint components_manufacturer_not_blank check (length(trim(manufacturer)) > 0),
  constraint components_model_not_blank check (length(trim(model)) > 0),
  constraint components_specs_match_category check (public.component_specs_are_valid(category, specs))
);

create index components_category_idx on public.components (category);
create index components_manufacturer_model_idx on public.components (manufacturer, model);

create trigger components_set_updated_at
before update on public.components
for each row execute function public.set_profile_updated_at();

create table public.component_lots (
  id uuid primary key default gen_random_uuid(),
  component_id uuid not null references public.components (id) on delete restrict,
  lot_code text not null,
  quantity_total integer not null check (quantity_total >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0),
  used_quantity integer not null default 0 check (used_quantity >= 0),
  available_quantity integer generated always as
    (quantity_total - reserved_quantity - used_quantity) stored,
  purchase_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint component_lots_quantities_fit check (
    reserved_quantity + used_quantity <= quantity_total
  ),
  constraint component_lots_code_not_blank check (length(trim(lot_code)) > 0),
  constraint component_lots_component_code_unique unique (component_id, lot_code)
);

create index component_lots_component_idx on public.component_lots (component_id);

create trigger component_lots_set_updated_at
before update on public.component_lots
for each row execute function public.set_profile_updated_at();

create table public.component_images (
  id uuid primary key default gen_random_uuid(),
  component_id uuid not null references public.components (id) on delete cascade,
  storage_path text not null unique,
  alt_text text not null default '',
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index component_images_one_primary_idx
  on public.component_images (component_id)
  where is_primary;

alter table public.components enable row level security;
alter table public.component_lots enable row level security;
alter table public.component_images enable row level security;

grant select on public.components, public.component_lots, public.component_images to authenticated;

create policy "Active users can read components"
on public.components for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.auth_user_id = (select auth.uid()) and p.is_active
  )
);

create policy "Active users can read component lots"
on public.component_lots for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.auth_user_id = (select auth.uid()) and p.is_active
  )
);

create policy "Active users can read component images"
on public.component_images for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.auth_user_id = (select auth.uid()) and p.is_active
  )
);

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
  if p_quantity is null or p_quantity < 0 then
    raise exception 'A quantidade inicial não pode ser negativa.' using errcode = '22023';
  end if;

  select id into actor_profile_id from public.profiles where auth_user_id = actor_id;
  insert into public.components (
    category, manufacturer, model, description, specs, created_by
  ) values (
    p_category, trim(p_manufacturer), trim(p_model), nullif(trim(p_description), ''),
    coalesce(p_specs, '{}'::jsonb), actor_profile_id
  ) returning * into new_component;

  if p_quantity > 0 then
    if p_lot_code is null or length(trim(p_lot_code)) = 0 then
      raise exception 'Informe o código do lote quando houver estoque inicial.' using errcode = '22023';
    end if;
    insert into public.component_lots (
      component_id, lot_code, quantity_total, purchase_date, notes
    ) values (
      new_component.id, trim(p_lot_code), p_quantity, p_purchase_date, nullif(trim(p_notes), '')
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

revoke all on function public.admin_create_component(
  public.component_category, text, text, text, jsonb, text, integer, date, text
) from public;
grant execute on function public.admin_create_component(
  public.component_category, text, text, text, jsonb, text, integer, date, text
) to authenticated;

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
  previous_lot public.component_lots;
  updated_lot public.component_lots;
begin
  if not public.is_active_admin() then
    raise exception 'Apenas administradores ativos podem alterar o estoque.'
      using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity <= 0 or p_lot_code is null or length(trim(p_lot_code)) = 0 then
    raise exception 'Informe uma quantidade positiva e um código de lote.' using errcode = '22023';
  end if;

  perform 1 from public.components where id = p_component_id for update;
  if not found then
    raise exception 'Componente não encontrado.' using errcode = 'P0002';
  end if;
  select id into actor_profile_id from public.profiles where auth_user_id = actor_id;

  select * into previous_lot
  from public.component_lots
  where component_id = p_component_id and lot_code = trim(p_lot_code)
  for update;

  insert into public.component_lots (
    component_id, lot_code, quantity_total, purchase_date, notes
  ) values (
    p_component_id, trim(p_lot_code), p_quantity, p_purchase_date, nullif(trim(p_notes), '')
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

revoke all on function public.admin_receive_stock(uuid, text, integer, date, text) from public;
grant execute on function public.admin_receive_stock(uuid, text, integer, date, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'component-images',
  'component-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "Authenticated users can read component images from storage"
on storage.objects for select to authenticated
using (
  bucket_id = 'component-images'
  and exists (
    select 1 from public.profiles p
    where p.auth_user_id = (select auth.uid()) and p.is_active
  )
);

create policy "Active admins can upload component images"
on storage.objects for insert to authenticated
with check (bucket_id = 'component-images' and (select public.is_active_admin()));

create policy "Active admins can update component images"
on storage.objects for update to authenticated
using (bucket_id = 'component-images' and (select public.is_active_admin()))
with check (bucket_id = 'component-images' and (select public.is_active_admin()));

create policy "Active admins can delete component images"
on storage.objects for delete to authenticated
using (bucket_id = 'component-images' and (select public.is_active_admin()));
