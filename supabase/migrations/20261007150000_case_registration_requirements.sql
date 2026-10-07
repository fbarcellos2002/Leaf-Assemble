create or replace function public.case_component_specs_are_valid(p_specs jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if not public.component_specs_are_valid('CASE', p_specs) then return false; end if;
  if jsonb_typeof(p_specs -> 'formFactorSupport') is distinct from 'array'
    or jsonb_array_length(p_specs -> 'formFactorSupport') = 0
    or jsonb_typeof(p_specs -> 'psuFormFactors') is distinct from 'array'
    or jsonb_array_length(p_specs -> 'psuFormFactors') = 0 then
    return false;
  end if;

  if exists (
    select 1 from jsonb_array_elements_text(p_specs -> 'formFactorSupport') as selected(value)
    where selected.value not in ('XL-ATX','E-ATX','ATX','Micro-ATX','Mini-ITX','Mini-DTX')
  ) then return false; end if;
  if exists (
    select 1 from jsonb_array_elements_text(p_specs -> 'psuFormFactors') as selected(value)
    where selected.value not in ('ATX','SFX','SFX-L','TFX')
  ) then return false; end if;

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
      else public.component_specs_are_valid(category, specs)
    end
  ) not valid;
