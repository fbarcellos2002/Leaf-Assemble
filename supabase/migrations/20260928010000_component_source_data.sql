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
    value := p_specs -> key_name;
    if key_name = 'sourceData' then
      if jsonb_typeof(value) <> 'object' or pg_column_size(value) > 150000 then return false; end if;
      continue;
    end if;
    if not key_name = any(allowed_keys) then return false; end if;
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
