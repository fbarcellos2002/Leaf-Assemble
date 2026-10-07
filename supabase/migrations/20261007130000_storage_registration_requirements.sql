create or replace function public.enforce_storage_component_specs()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  capacity numeric;
  force_ssd boolean;
begin
  if new.category <> 'STORAGE' then return new; end if;

  if jsonb_typeof(new.specs -> 'interface') is distinct from 'string'
    or not (new.specs ->> 'interface') = any(array[
      'SATA','SATA II','SATA III','M.2 SATA','M.2 NVMe','NVMe',
      'PCIe 3.0 x4','PCIe 4.0 x4','PCIe 5.0 x4','USB'
    ]) then
    raise exception 'Selecione uma interface de armazenamento válida.' using errcode = '23514';
  end if;

  force_ssd := new.specs ->> 'interface' like 'M.2%'
    or new.specs ->> 'interface' = 'NVMe'
    or new.specs ->> 'interface' like 'PCIe%';
  if jsonb_typeof(new.specs -> 'type') is distinct from 'string'
    or (force_ssd and new.specs ->> 'type' <> 'SSD')
    or (not force_ssd and not (new.specs ->> 'type') = any(array['HD','SSD','SSHD'])) then
    raise exception 'Selecione um tipo de armazenamento compatível com a interface.' using errcode = '23514';
  end if;

  if jsonb_typeof(new.specs -> 'capacityGb') is distinct from 'number' then
    raise exception 'Selecione a capacidade do armazenamento.' using errcode = '23514';
  end if;
  capacity := (new.specs ->> 'capacityGb')::numeric;
  if capacity not in (
    120,128,240,250,256,320,480,500,512,750,800,960,1000,1024,1500,2000,2048,
    3000,4000,4096,6000,8000,8192,12000,16000,20000,24000
  ) then
    raise exception 'A capacidade selecionada é inválida.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists components_enforce_storage_specs on public.components;

create trigger components_enforce_storage_specs
before insert or update of category, specs on public.components
for each row execute function public.enforce_storage_component_specs();
