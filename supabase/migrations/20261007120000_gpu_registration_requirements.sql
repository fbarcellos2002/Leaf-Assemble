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

  if p_specs ? 'chipBrand' and (
    jsonb_typeof(p_specs -> 'chipBrand') is distinct from 'string'
    or not (p_specs ->> 'chipBrand') = any(array['Intel','NVIDIA','AMD'])
  ) then
    return false;
  end if;
  if p_specs ? 'vramGb' then
    if jsonb_typeof(p_specs -> 'vramGb') is distinct from 'number' then return false; end if;
    vram := (p_specs ->> 'vramGb')::numeric;
    if vram not in (1,2,3,4,6,8,10,11,12,16,20,24,32,48,64,96) then return false; end if;
  end if;
  if p_specs ? 'recommendedPsuW' then
    if jsonb_typeof(p_specs -> 'recommendedPsuW') is distinct from 'number' then return false; end if;
    psu := (p_specs ->> 'recommendedPsuW')::numeric;
    if psu < 1 then return false; end if;
  end if;
  if p_specs ? 'pcieVersion' and (
    jsonb_typeof(p_specs -> 'pcieVersion') is distinct from 'string'
    or not (p_specs ->> 'pcieVersion') = any(array['PCIe 1.0','PCIe 2.0','PCIe 3.0','PCIe 4.0','PCIe 5.0'])
  ) then
    return false;
  end if;

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
      else public.component_specs_are_valid(category, specs)
    end
  ) not valid;

create or replace function public.enforce_gpu_component_specs()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  vram numeric;
  psu numeric;
begin
  if new.category <> 'GPU' then return new; end if;

  if jsonb_typeof(new.specs -> 'chipBrand') is distinct from 'string'
    or not (new.specs ->> 'chipBrand') = any(array['Intel','NVIDIA','AMD']) then
    raise exception 'Selecione a marca do chip da placa de vídeo.' using errcode = '23514';
  end if;
  if jsonb_typeof(new.specs -> 'vramGb') is distinct from 'number' then
    raise exception 'Selecione a quantidade de VRAM da placa de vídeo.' using errcode = '23514';
  end if;
  vram := (new.specs ->> 'vramGb')::numeric;
  if vram not in (1,2,3,4,6,8,10,11,12,16,20,24,32,48,64,96) then
    raise exception 'A quantidade de VRAM selecionada é inválida.' using errcode = '23514';
  end if;
  if jsonb_typeof(new.specs -> 'recommendedPsuW') is distinct from 'number' then
    raise exception 'Informe a potência recomendada da fonte.' using errcode = '23514';
  end if;
  psu := (new.specs ->> 'recommendedPsuW')::numeric;
  if psu < 1 then
    raise exception 'A potência recomendada da fonte deve ser maior que zero.' using errcode = '23514';
  end if;
  if new.specs ? 'pcieVersion' and not (new.specs ->> 'pcieVersion') = any(array['PCIe 1.0','PCIe 2.0','PCIe 3.0','PCIe 4.0','PCIe 5.0']) then
    raise exception 'A versão PCIe selecionada é inválida.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists components_enforce_gpu_specs on public.components;

create trigger components_enforce_gpu_specs
before insert or update of category, specs on public.components
for each row execute function public.enforce_gpu_component_specs();
