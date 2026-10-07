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
  interface_entry record;
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
      'supportedMemoryFrequenciesMhz','storageInterfaces','storageInterfaceCounts','pcieSlots','eccSupport'
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
    elsif key_name = 'storageInterfaceCounts' then
      if jsonb_typeof(value) <> 'object' then return false; end if;
      for interface_entry in select key, val from jsonb_each(value) as counts(key, val) loop
        if interface_entry.key not in ('SATA','SATA III','M.2 SATA','M.2 NVMe','PCIe 3.0 x4','PCIe 4.0 x4','PCIe 5.0 x4')
          or jsonb_typeof(interface_entry.val) <> 'number' then return false; end if;
        number_value := (interface_entry.val #>> '{}')::numeric;
        if number_value < 1 or trunc(number_value) <> number_value then return false; end if;
        if interface_entry.key like 'M.2%' or interface_entry.key like 'PCIe%' then
          if number_value > 7 then return false; end if;
        elsif number_value > 12 then return false;
        end if;
      end loop;
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

  if p_category = 'MOTHERBOARD' then
    if jsonb_typeof(p_specs -> 'socket') is distinct from 'string'
      or jsonb_typeof(p_specs -> 'formFactor') is distinct from 'string'
      or not (p_specs ->> 'formFactor') = any(array['ATX','m-ATX','Mini-ITX','E-ATX','Mini-DTX','XL-ATX'])
      or jsonb_typeof(p_specs -> 'memoryType') is distinct from 'string'
      or not (p_specs ->> 'memoryType') = any(array['DDR2','DDR3','DDR3L','DDR4','DDR5'])
      or jsonb_typeof(p_specs -> 'memorySlots') is distinct from 'number'
      or (p_specs ->> 'memorySlots')::numeric not in (2,4,8)
      or jsonb_typeof(p_specs -> 'maxMemoryGb') is distinct from 'number'
      or (p_specs ->> 'maxMemoryGb')::numeric < 1
      or trunc((p_specs ->> 'maxMemoryGb')::numeric) <> (p_specs ->> 'maxMemoryGb')::numeric
      or jsonb_typeof(p_specs -> 'supportedMemoryFrequenciesMhz') is distinct from 'array'
      or jsonb_array_length(p_specs -> 'supportedMemoryFrequenciesMhz') <> 1
      or (p_specs #>> '{supportedMemoryFrequenciesMhz,0}')::numeric not in (800,1066,1333,1600,1866,2133,2400,2666,2933,3000,3200,3600,4000,4266,4800,5200,5600,6000,6400,7200,7600,8000,8400)
      or jsonb_typeof(p_specs -> 'storageInterfaces') is distinct from 'array'
      or jsonb_array_length(p_specs -> 'storageInterfaces') < 1
      or jsonb_typeof(p_specs -> 'storageInterfaceCounts') is distinct from 'object'
      or jsonb_typeof(p_specs -> 'pcieSlots') is distinct from 'number'
      or jsonb_object_length(p_specs -> 'storageInterfaceCounts') <> jsonb_array_length(p_specs -> 'storageInterfaces')
      or (p_specs ->> 'pcieSlots')::numeric not between 1 and 7 then
      return false;
    end if;
    if exists (
      select 1 from jsonb_array_elements_text(p_specs -> 'storageInterfaces') as selected(interface_name)
      where not (p_specs -> 'storageInterfaceCounts' ? selected.interface_name)
        or selected.interface_name not in ('SATA','SATA III','M.2 SATA','M.2 NVMe','PCIe 3.0 x4','PCIe 4.0 x4','PCIe 5.0 x4')
    ) then return false; end if;
    if exists (
      select 1 from jsonb_object_keys(p_specs -> 'storageInterfaceCounts') as counts(interface_name)
      where not exists (
        select 1 from jsonb_array_elements_text(p_specs -> 'storageInterfaces') as selected(interface_name)
        where selected.interface_name = counts.interface_name
      )
    ) then return false; end if;
    if p_specs ? 'pcieVersion' and not (p_specs ->> 'pcieVersion') = any(array['PCIe 1.0','PCIe 2.0','PCIe 3.0','PCIe 4.0','PCIe 5.0','PCIe 6.0']) then
      return false;
    end if;
  end if;

  return true;
exception when others then
  return false;
end;
$$;
