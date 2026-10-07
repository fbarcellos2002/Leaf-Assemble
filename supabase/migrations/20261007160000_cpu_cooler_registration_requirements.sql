create or replace function public.cpu_cooler_component_specs_are_valid(p_specs jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  base_socket text;
  has_adapter boolean;
  allowed_sockets text[] := array[
    'LGA 1851','LGA 1700','LGA 2066','LGA 2011-v3','LGA 2011','LGA 1366',
    'LGA 1200','LGA 1156','LGA 1155','LGA 1151','LGA 1150','LGA 775',
    'AM5','AM4','sTR5','sTRX4','TR4','sWRX8','AM3+','AM3','AM2+','AM2','AM1','FM2+','FM2','FM1'
  ];
begin
  if not p_specs ? 'socketBase' then
    return public.component_specs_are_valid('CPU_COOLER', p_specs);
  end if;

  if not public.component_specs_are_valid('CPU_COOLER', p_specs - 'socketBase' - 'adapterSockets' - 'coolerType') then return false; end if;
  if jsonb_typeof(p_specs -> 'socketBase') is distinct from 'string'
    or jsonb_typeof(p_specs -> 'coolerType') is distinct from 'string' then
    return false;
  end if;

  base_socket := p_specs ->> 'socketBase';
  if base_socket <> 'Genérico' and not base_socket = any(allowed_sockets) then return false; end if;
  if p_specs ->> 'coolerType' not in ('Air cooler','AIO liquid cooler','Custom liquid cooling') then return false; end if;

  if base_socket = 'Genérico' then
    if p_specs -> 'socketAdapter' = 'true'::jsonb
      or (p_specs ? 'adapterSockets' and jsonb_array_length(p_specs -> 'adapterSockets') > 0) then
      return false;
    end if;
    return true;
  end if;

  if jsonb_typeof(p_specs -> 'socketAdapter') is distinct from 'boolean' then return false; end if;
  has_adapter := (p_specs ->> 'socketAdapter')::boolean;
  if has_adapter then
    if jsonb_typeof(p_specs -> 'adapterSockets') is distinct from 'array'
      or jsonb_array_length(p_specs -> 'adapterSockets') = 0 then return false; end if;
    if exists (
      select 1 from jsonb_array_elements_text(p_specs -> 'adapterSockets') as selected(value)
      where not (selected.value = any(allowed_sockets)) or selected.value = base_socket
    ) then return false; end if;
  elsif p_specs ? 'adapterSockets' and jsonb_array_length(p_specs -> 'adapterSockets') > 0 then
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
      when category = 'CPU' then public.cpu_component_specs_are_valid(specs)
      when category = 'PSU' then public.psu_component_specs_are_valid(specs)
      when category = 'CASE' then public.case_component_specs_are_valid(specs)
      when category = 'CPU_COOLER' then public.cpu_cooler_component_specs_are_valid(specs)
      else public.component_specs_are_valid(category, specs)
    end
  ) not valid;
