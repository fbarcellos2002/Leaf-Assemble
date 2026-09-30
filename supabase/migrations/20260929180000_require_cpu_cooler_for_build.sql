create or replace function public.refresh_build_status(p_build_id uuid)
returns public.build_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_status public.build_status;
begin
  if exists (
    select 1 from public.build_components bc
    where bc.build_id = p_build_id and bc.is_active
      and bc.compatibility_status = 'incompatible'
  ) then
    next_status := 'INCOMPLETE';
  elsif exists (
    select 1 from public.build_components bc
    where bc.build_id = p_build_id and bc.is_active and not bc.compatibility_confirmed
  ) then
    next_status := 'INCOMPLETE';
  elsif exists (
    select 1 from public.build_components bc join public.components c on c.id = bc.component_id
    where bc.build_id = p_build_id and bc.is_active and c.category = 'CPU'
  ) and exists (
    select 1 from public.build_components bc join public.components c on c.id = bc.component_id
    where bc.build_id = p_build_id and bc.is_active and c.category = 'MOTHERBOARD'
  ) and exists (
    select 1 from public.build_components bc join public.components c on c.id = bc.component_id
    where bc.build_id = p_build_id and bc.is_active and c.category = 'CPU_COOLER'
  ) and exists (
    select 1 from public.build_components bc join public.components c on c.id = bc.component_id
    where bc.build_id = p_build_id and bc.is_active and c.category = 'RAM'
  ) and exists (
    select 1 from public.build_components bc join public.components c on c.id = bc.component_id
    where bc.build_id = p_build_id and bc.is_active and c.category = 'STORAGE'
  ) and exists (
    select 1 from public.build_components bc join public.components c on c.id = bc.component_id
    where bc.build_id = p_build_id and bc.is_active and c.category = 'PSU'
  ) and exists (
    select 1 from public.build_components bc join public.components c on c.id = bc.component_id
    where bc.build_id = p_build_id and bc.is_active and c.category = 'CASE'
  ) and (
    exists (
      select 1 from public.build_components bc join public.components c on c.id = bc.component_id
      where bc.build_id = p_build_id and bc.is_active
        and c.category = 'CPU' and c.specs ->> 'integratedGraphics' = 'true'
    ) or exists (
      select 1 from public.build_components bc join public.components c on c.id = bc.component_id
      where bc.build_id = p_build_id and bc.is_active and c.category = 'GPU'
    )
  ) then
    next_status := 'READY';
  elsif exists (select 1 from public.build_components bc where bc.build_id = p_build_id and bc.is_active) then
    next_status := 'INCOMPLETE';
  else
    next_status := 'DRAFT';
  end if;

  update public.builds set status = next_status where id = p_build_id;
  return next_status;
end;
$$;

do $$
declare
  active_build_id uuid;
begin
  for active_build_id in
    select id from public.builds where status in ('DRAFT', 'INCOMPLETE', 'READY')
  loop
    perform public.refresh_build_status(active_build_id);
  end loop;
end;
$$;
