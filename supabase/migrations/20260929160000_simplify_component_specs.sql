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
    when 'CPU_COOLER' then array['supportedSockets','formFactor','heightMm','tdpRatingW']
  end;

  for key_name in select jsonb_object_keys(p_specs) loop
    if not key_name = any(allowed_keys) then return false; end if;
    value := p_specs -> key_name;
    if key_name in ('socket','pcieVersion','chipset','formFactor','memoryType','interface','type','efficiencyRating','microarchitecture','generation','integratedGraphicsModel') then
      if jsonb_typeof(value) <> 'string' or length(trim(value #>> '{}')) = 0 then return false; end if;
    elsif key_name in ('integratedGraphics','ecc','eccSupport','registered') then
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
