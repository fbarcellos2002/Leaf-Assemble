-- Use apenas em um Supabase local/de desenvolvimento.
-- Cria estoque explicitamente marcado como [TESTE], dois PCs prontos e dois incompletos.
-- Reexecutar este arquivo substitui somente os registros com os UUIDs fixos abaixo.
begin;

do $$
declare
  actor_profile_id uuid;
begin
  select id into actor_profile_id
  from public.profiles
  where role = 'ADMIN'::public.app_role and is_active
  order by created_at
  limit 1;

  if actor_profile_id is null then
    raise exception 'Crie/promova um perfil ADMIN antes de carregar os fixtures de teste.';
  end if;

  -- Limpa uma execução anterior deste fixture sem tocar em outros registros.
  delete from public.audit_logs
  where entity_id in (
    'c0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000002',
    'c0000000-0000-4000-8000-000000000003',
    'c0000000-0000-4000-8000-000000000004'
  ) or (
    entity_type = 'build_component'
    and entity_id in (
      select id from public.build_components
      where build_id in (
        'c0000000-0000-4000-8000-000000000001',
        'c0000000-0000-4000-8000-000000000002',
        'c0000000-0000-4000-8000-000000000003',
        'c0000000-0000-4000-8000-000000000004'
      )
    )
  );
  delete from public.inventory_reservations
  where build_component_id in (
    select id from public.build_components
    where build_id in (
      'c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000002',
      'c0000000-0000-4000-8000-000000000003',
      'c0000000-0000-4000-8000-000000000004'
    )
  );
  delete from public.build_components
  where build_id in (
    'c0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000002',
    'c0000000-0000-4000-8000-000000000003',
    'c0000000-0000-4000-8000-000000000004'
  );
  delete from public.builds
  where id in (
    'c0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000002',
    'c0000000-0000-4000-8000-000000000003',
    'c0000000-0000-4000-8000-000000000004'
  );
  delete from public.component_lots
  where id in (
    'b0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000002',
    'b0000000-0000-4000-8000-000000000003',
    'b0000000-0000-4000-8000-000000000004',
    'b0000000-0000-4000-8000-000000000005',
    'b0000000-0000-4000-8000-000000000006',
    'b0000000-0000-4000-8000-000000000007',
    'b0000000-0000-4000-8000-000000000008',
    'b0000000-0000-4000-8000-000000000009',
    'b0000000-0000-4000-8000-000000000010'
  );
  delete from public.components
  where id in (
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000003',
    'a0000000-0000-4000-8000-000000000004',
    'a0000000-0000-4000-8000-000000000005',
    'a0000000-0000-4000-8000-000000000006',
    'a0000000-0000-4000-8000-000000000007',
    'a0000000-0000-4000-8000-000000000008',
    'a0000000-0000-4000-8000-000000000009',
    'a0000000-0000-4000-8000-000000000010'
  );

  insert into public.components (id, category, manufacturer, name, model, description, specs, created_by)
  values
    ('a0000000-0000-4000-8000-000000000001', 'CPU', 'Intel', '[TESTE] CPU Intel LGA1700', 'CPU-TEST-I', '[TESTE] Processador Intel de demonstração', '{"socket":"LGA 1700","cores":8,"threads":16,"tdpW":125,"integratedGraphics":true,"memoryTypes":["DDR5"],"maxMemoryFrequencyMhz":5200}'::jsonb, actor_profile_id),
    ('a0000000-0000-4000-8000-000000000002', 'CPU', 'AMD', '[TESTE] CPU AMD AM5', 'CPU-TEST-A', '[TESTE] Processador AMD de demonstração', '{"socket":"AM5","cores":8,"threads":16,"tdpW":105,"integratedGraphics":true,"memoryTypes":["DDR5"],"maxMemoryFrequencyMhz":5200}'::jsonb, actor_profile_id),
    ('a0000000-0000-4000-8000-000000000003', 'MOTHERBOARD', 'Leaf Assemble', '[TESTE] Placa-mãe LGA1700 DDR5', 'MB-TEST-I', '[TESTE] Placa-mãe Intel de demonstração', '{"socket":"LGA 1700","chipset":"TESTE-I","formFactor":"ATX","memoryType":"DDR5","memorySlots":4,"maxMemoryGb":128,"supportedMemoryFrequenciesMhz":[5200,5600],"storageInterfaces":["SATA","M.2 NVMe"],"pcieSlots":2}'::jsonb, actor_profile_id),
    ('a0000000-0000-4000-8000-000000000004', 'MOTHERBOARD', 'Leaf Assemble', '[TESTE] Placa-mãe AM5 DDR5', 'MB-TEST-A', '[TESTE] Placa-mãe AMD de demonstração', '{"socket":"AM5","chipset":"TESTE-A","formFactor":"ATX","memoryType":"DDR5","memorySlots":4,"maxMemoryGb":128,"supportedMemoryFrequenciesMhz":[5200,5600],"storageInterfaces":["SATA","M.2 NVMe"],"pcieSlots":2}'::jsonb, actor_profile_id),
    ('a0000000-0000-4000-8000-000000000005', 'RAM', 'Leaf Assemble', '[TESTE] Kit RAM DDR5 32 GB', 'RAM-TEST-32', '[TESTE] Kit de memória de demonstração', '{"memoryType":"DDR5","capacityGb":32,"frequencyMhz":5200,"formFactor":"DIMM","ecc":false,"moduleCount":2}'::jsonb, actor_profile_id),
    ('a0000000-0000-4000-8000-000000000006', 'CPU_COOLER', 'Leaf Assemble', '[TESTE] Cooler universal', 'COOLER-TEST', '[TESTE] Cooler de demonstração compatível com Intel e AMD', '{"supportedSockets":["LGA1700","AM5"],"socketAdapter":true,"formFactor":"Air cooler","heightMm":155,"tdpRatingW":180}'::jsonb, actor_profile_id),
    ('a0000000-0000-4000-8000-000000000007', 'STORAGE', 'Leaf Assemble', '[TESTE] SSD M.2 NVMe 1 TB', 'SSD-TEST-NVME', '[TESTE] SSD NVMe de demonstração', '{"type":"SSD","capacityGb":1000,"interface":"M.2 NVMe","formFactor":"M.2 2280","readSpeedMbS":5000,"writeSpeedMbS":4000}'::jsonb, actor_profile_id),
    ('a0000000-0000-4000-8000-000000000008', 'STORAGE', 'Leaf Assemble', '[TESTE] SSD SATA 1 TB', 'SSD-TEST-SATA', '[TESTE] SSD SATA de demonstração', '{"type":"SSD","capacityGb":1000,"interface":"SATA III","formFactor":"2.5 inch","readSpeedMbS":550,"writeSpeedMbS":500}'::jsonb, actor_profile_id),
    ('a0000000-0000-4000-8000-000000000009', 'PSU', 'Leaf Assemble', '[TESTE] Fonte ATX 750 W', 'PSU-TEST-750', '[TESTE] Fonte de demonstração', '{"wattageW":750,"efficiencyRating":"80 Plus Gold","formFactor":"ATX"}'::jsonb, actor_profile_id),
    ('a0000000-0000-4000-8000-000000000010', 'CASE', 'Leaf Assemble', '[TESTE] Gabinete ATX', 'CASE-TEST-ATX', '[TESTE] Gabinete de demonstração', '{"formFactorSupport":["ATX","Micro-ATX"],"gpuMaxLengthMm":350,"cpuCoolerMaxHeightMm":160,"psuFormFactors":["ATX"]}'::jsonb, actor_profile_id);

  insert into public.component_lots (id, component_id, lot_code, quantity_total)
  values
    ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '[TESTE] Lote CPU Intel', 2),
    ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', '[TESTE] Lote CPU AMD', 2),
    ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003', '[TESTE] Lote placa Intel', 2),
    ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000004', '[TESTE] Lote placa AMD', 2),
    ('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000005', '[TESTE] Lote RAM', 4),
    ('b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000006', '[TESTE] Lote cooler', 2),
    ('b0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000007', '[TESTE] Lote SSD NVMe', 1),
    ('b0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000008', '[TESTE] Lote SSD SATA', 1),
    ('b0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000009', '[TESTE] Lote fonte', 2),
    ('b0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000010', '[TESTE] Lote gabinete', 2);

  insert into public.builds (id, name, created_by, notes)
  values
    ('c0000000-0000-4000-8000-000000000001', '[TESTE] PC pronto Intel', actor_profile_id, 'Fixture de demonstração com CPU Intel.'),
    ('c0000000-0000-4000-8000-000000000002', '[TESTE] PC pronto AMD', actor_profile_id, 'Fixture de demonstração com CPU AMD.'),
    ('c0000000-0000-4000-8000-000000000003', '[TESTE] PC incompleto Intel', actor_profile_id, 'Fixture incompleto para testar a montagem Intel.'),
    ('c0000000-0000-4000-8000-000000000004', '[TESTE] PC incompleto AMD', actor_profile_id, 'Fixture incompleto para testar a montagem AMD.');

  insert into public.build_components (
    id, build_id, component_id, lot_id, slot_key, quantity,
    compatibility_status, compatibility_confirmed, created_by
  ) values
    ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000003', 'motherboard', 1, 'compatible', true, actor_profile_id),
    ('d0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'cpu', 1, 'compatible', true, actor_profile_id),
    ('d0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000005', 'ram-1', 1, 'compatible', true, actor_profile_id),
    ('d0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000006', 'cpu_cooler', 1, 'compatible', true, actor_profile_id),
    ('d0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000007', 'storage-4', 1, 'compatible', true, actor_profile_id),
    ('d0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000009', 'psu', 1, 'compatible', true, actor_profile_id),
    ('d0000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000010', 'b0000000-0000-4000-8000-000000000010', 'case', 1, 'compatible', true, actor_profile_id),
    ('d0000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000004', 'motherboard', 1, 'compatible', true, actor_profile_id),
    ('d0000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'cpu', 1, 'compatible', true, actor_profile_id),
    ('d0000000-0000-4000-8000-000000000010', 'c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000005', 'ram-1', 1, 'compatible', true, actor_profile_id),
    ('d0000000-0000-4000-8000-000000000011', 'c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000006', 'cpu_cooler', 1, 'compatible', true, actor_profile_id),
    ('d0000000-0000-4000-8000-000000000012', 'c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000008', 'storage-1', 1, 'compatible', true, actor_profile_id),
    ('d0000000-0000-4000-8000-000000000013', 'c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000009', 'psu', 1, 'compatible', true, actor_profile_id),
    ('d0000000-0000-4000-8000-000000000014', 'c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000010', 'b0000000-0000-4000-8000-000000000010', 'case', 1, 'compatible', true, actor_profile_id),
    ('d0000000-0000-4000-8000-000000000015', 'c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000003', 'motherboard', 1, 'compatible', true, actor_profile_id),
    ('d0000000-0000-4000-8000-000000000016', 'c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'cpu', 1, 'compatible', true, actor_profile_id),
    ('d0000000-0000-4000-8000-000000000017', 'c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000004', 'motherboard', 1, 'compatible', true, actor_profile_id),
    ('d0000000-0000-4000-8000-000000000018', 'c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'cpu', 1, 'compatible', true, actor_profile_id),
    ('d0000000-0000-4000-8000-000000000019', 'c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000005', 'ram-1', 1, 'compatible', true, actor_profile_id);

  insert into public.inventory_reservations (build_component_id, quantity, status, created_by)
  select id, quantity, 'ACTIVE'::public.reservation_status, actor_profile_id
  from public.build_components
  where build_id in (
    'c0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000002',
    'c0000000-0000-4000-8000-000000000003',
    'c0000000-0000-4000-8000-000000000004'
  );

  update public.component_lots lot
  set reserved_quantity = reservations.reserved_total
  from (
    select build_component.lot_id, sum(reservation.quantity)::integer as reserved_total
    from public.inventory_reservations reservation
    join public.build_components build_component on build_component.id = reservation.build_component_id
    where reservation.status = 'ACTIVE'
      and build_component.build_id in (
        'c0000000-0000-4000-8000-000000000001',
        'c0000000-0000-4000-8000-000000000002',
        'c0000000-0000-4000-8000-000000000003',
        'c0000000-0000-4000-8000-000000000004'
      )
    group by build_component.lot_id
  ) reservations
  where lot.id = reservations.lot_id;

  perform public.refresh_build_status('c0000000-0000-4000-8000-000000000001');
  perform public.refresh_build_status('c0000000-0000-4000-8000-000000000002');
  perform public.refresh_build_status('c0000000-0000-4000-8000-000000000003');
  perform public.refresh_build_status('c0000000-0000-4000-8000-000000000004');

  insert into public.audit_logs (user_id, action, entity_type, entity_id, new_data)
  values
    (actor_profile_id, 'build.created', 'build', 'c0000000-0000-4000-8000-000000000001', '{"fixture":true,"processor":"Intel"}'::jsonb),
    (actor_profile_id, 'build.created', 'build', 'c0000000-0000-4000-8000-000000000002', '{"fixture":true,"processor":"AMD"}'::jsonb),
    (actor_profile_id, 'build.created', 'build', 'c0000000-0000-4000-8000-000000000003', '{"fixture":true,"processor":"Intel","incomplete":true}'::jsonb),
    (actor_profile_id, 'build.created', 'build', 'c0000000-0000-4000-8000-000000000004', '{"fixture":true,"processor":"AMD","incomplete":true}'::jsonb);
end;
$$;

commit;
