-- TEST DATA ONLY: apply manually to a development/test database.
-- This adds one sample component per category with two units in a marked test lot.
-- It does not use the admin RPC because this is a privileged migration fixture;
-- created_by and audit user_id stay NULL to avoid attributing it to a real user.

begin;

with samples(category, manufacturer, name, model, description, specs, lot_code) as (
  values
    (
      'CPU'::public.component_category,
      'Intel',
      'TESTE - Intel Core i5-2500',
      'TESTE-CPU-I5-2500',
      'TESTE - Intel Core i5-2500 - 4 núcleos - 4 threads',
      '{"socket":"LGA 1155","cores":4,"threads":4,"baseClockMhz":3300,"boostClockMhz":3700,"tdpW":95,"integratedGraphics":true,"memoryTypes":["DDR3"],"maxMemoryFrequencyMhz":1333}'::jsonb,
      'TESTE-CPU-INTEL-001'
    ),
    (
      'MOTHERBOARD'::public.component_category,
      'ASUS',
      'TESTE - ASUS H61M',
      'TESTE-MB-ASUS-H61M',
      'TESTE - ASUS - LGA 1155',
      '{"socket":"LGA 1155","chipset":"H61","formFactor":"Micro-ATX","memoryType":"DDR3","memorySlots":2,"maxMemoryGb":16,"supportedMemoryFrequenciesMhz":[1066,1333,1600],"storageInterfaces":["SATA II","SATA III"],"pcieSlots":1}'::jsonb,
      'TESTE-MB-ASUS-001'
    ),
    (
      'RAM'::public.component_category,
      'Kingston',
      'TESTE - Kingston DDR3 4 GB 1333 MHz',
      'TESTE-RAM-DDR3-4GB-1333',
      'TESTE - Kingston - 4 GB - DDR3 - 1333 MHz',
      '{"memoryType":"DDR3","capacityGb":4,"frequencyMhz":1333,"formFactor":"DIMM","ecc":false}'::jsonb,
      'TESTE-RAM-DDR3-001'
    ),
    (
      'GPU'::public.component_category,
      'NVIDIA',
      'TESTE - GeForce GTX 1650',
      'TESTE-GPU-GTX1650',
      'TESTE - GeForce GTX 1650 - 4 GB VRAM',
      '{"vramGb":4,"recommendedPsuW":450}'::jsonb,
      'TESTE-GPU-NVIDIA-001'
    ),
    (
      'STORAGE'::public.component_category,
      'Kingston',
      'TESTE - SSD SATA 120 GB',
      'TESTE-STORAGE-SSD-120GB',
      'TESTE - Kingston - 120 GB - SATA III',
      '{"type":"SSD","capacityGb":120,"interface":"SATA III","readSpeedMbS":500,"writeSpeedMbS":350}'::jsonb,
      'TESTE-STORAGE-SSD-001'
    ),
    (
      'PSU'::public.component_category,
      'Corsair',
      'TESTE - Fonte ATX 450 W Bronze',
      'TESTE-PSU-450W-BRONZE',
      'TESTE - Corsair - 450 W - 80 Plus Bronze',
      '{"wattageW":450,"efficiencyRating":"80 Plus Bronze","formFactor":"ATX"}'::jsonb,
      'TESTE-PSU-CORSAIR-001'
    ),
    (
      'CASE'::public.component_category,
      'Bluecase',
      'TESTE - Gabinete Micro-ATX',
      'TESTE-CASE-MATX-01',
      'TESTE - Bluecase - Placa-mãe Micro-ATX - Fonte de alimentação ATX',
      '{"formFactorSupport":["Micro-ATX","Mini-ITX"],"gpuMaxLengthMm":300,"cpuCoolerMaxHeightMm":155,"psuFormFactors":["ATX"]}'::jsonb,
      'TESTE-CASE-BLUECASE-001'
    ),
    (
      'CPU_COOLER'::public.component_category,
      'Cooler Master',
      'TESTE - Cooler de ar LGA 1155',
      'TESTE-COOLER-LGA1155',
      'TESTE - Cooler Master - LGA 1155',
      '{"supportedSockets":["LGA 1155"],"formFactor":"Air cooler"}'::jsonb,
      'TESTE-COOLER-MASTER-001'
    )
), inserted_components as (
  insert into public.components (category, manufacturer, name, model, description, specs, created_by)
  select s.category, s.manufacturer, s.name, s.model, s.description, s.specs, null
  from samples s
  where not exists (
    select 1
    from public.components existing
    where existing.category = s.category
      and existing.model = s.model
  )
  returning id, category, manufacturer, name, model, description, specs
), inserted_lots as (
  insert into public.component_lots (component_id, lot_code, quantity_total, notes)
  select c.id, s.lot_code, 2, 'DADOS FICTÍCIOS DE TESTE — não representam estoque real.'
  from inserted_components c
  join samples s on s.category = c.category and s.model = c.model
  returning id, component_id, lot_code, quantity_total, available_quantity
)
insert into public.audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
select
  null,
  'component.test_seeded',
  'component',
  c.id,
  null,
  jsonb_build_object(
    'component', to_jsonb(c),
    'initial_lot', to_jsonb(l),
    'source', 'development test seed'
  )
from inserted_components c
join inserted_lots l on l.component_id = c.id;

commit;
