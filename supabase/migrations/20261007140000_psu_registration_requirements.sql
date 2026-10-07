create or replace function public.gpu_component_specs_are_valid(p_specs jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  vram numeric;
  psu numeric;
begin
  if not public.component_specs_are_valid('GPU', p_specs - 'chipBrand' - 'pcieVersion') then
    return false;
  end if;

  if jsonb_typeof(p_specs -> 'chipBrand') is distinct from 'string'
    or not (p_specs ->> 'chipBrand') = any(array['Intel','NVIDIA','AMD']) then
    return false;
  end if;
  if jsonb_typeof(p_specs -> 'vramGb') is distinct from 'number' then return false; end if;
  vram := (p_specs ->> 'vramGb')::numeric;
  if vram not in (1,2,3,4,6,8,10,11,12,16,20,24,32,48,64,96) then return false; end if;

  if jsonb_typeof(p_specs -> 'recommendedPsuW') is distinct from 'number' then return false; end if;
  psu := (p_specs ->> 'recommendedPsuW')::numeric;
  if psu not in (300,350,400,450,500,550,600,650,700,750,800,850,900,1000,1200,1300,1500,1600) then return false; end if;

  if p_specs ? 'pcieVersion' and (
    jsonb_typeof(p_specs -> 'pcieVersion') is distinct from 'string'
    or not (p_specs ->> 'pcieVersion') = any(array['PCIe 1.0','PCIe 2.0','PCIe 3.0','PCIe 4.0','PCIe 5.0'])
  ) then return false; end if;

  return true;
exception when others then
  return false;
end;
$$;

create or replace function public.cpu_component_specs_are_valid(p_specs jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  return public.component_specs_are_valid('CPU', p_specs)
    and jsonb_typeof(p_specs -> 'integratedGraphics') = 'boolean';
exception when others then
  return false;
end;
$$;

create or replace function public.psu_component_specs_are_valid(p_specs jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  wattage numeric;
begin
  if not public.component_specs_are_valid('PSU', p_specs - 'activePfc') then return false; end if;
  if jsonb_typeof(p_specs -> 'wattageW') is distinct from 'number'
    or jsonb_typeof(p_specs -> 'efficiencyRating') is distinct from 'string'
    or jsonb_typeof(p_specs -> 'formFactor') is distinct from 'string'
    or jsonb_typeof(p_specs -> 'activePfc') is distinct from 'boolean' then
    return false;
  end if;

  wattage := (p_specs ->> 'wattageW')::numeric;
  if wattage not in (300,350,400,450,500,550,600,650,700,750,800,850,900,1000,1050,1100,1200,1300,1500,1600,1800,2000) then return false; end if;
  if not (p_specs ->> 'efficiencyRating') = any(array[
    '80 Plus','80 Plus White','80 Plus Bronze','80 Plus Silver','80 Plus Gold','80 Plus Platinum','80 Plus Titanium'
  ]) then return false; end if;
  if not (p_specs ->> 'formFactor') = any(array['ATX','SFX','SFX-L','TFX']) then return false; end if;
  return true;
exception when others then
  return false;
end;
$$;

alter table public.components
  drop constraint if exists components_specs_match_category;

alter table public.components
  add constraint components_specs_match_category
  check (
    case
      when category = 'GPU' then public.gpu_component_specs_are_valid(specs)
      when category = 'CPU' then public.cpu_component_specs_are_valid(specs)
      when category = 'PSU' then public.psu_component_specs_are_valid(specs)
      else public.component_specs_are_valid(category, specs)
    end
  ) not valid;
