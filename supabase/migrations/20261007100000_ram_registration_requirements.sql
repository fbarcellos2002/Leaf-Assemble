create or replace function public.enforce_ram_component_specs()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  capacity numeric;
  frequency numeric;
begin
  if new.category <> 'RAM' then return new; end if;

  if jsonb_typeof(new.specs -> 'memoryType') is distinct from 'string'
    or not (new.specs ->> 'memoryType') = any(array['DDR2','DDR3','DDR3L','DDR4','DDR5','LPDDR4','LPDDR4X','LPDDR5','LPDDR5X']) then
    raise exception 'Selecione um slot de memória válido.' using errcode = '23514';
  end if;
  if jsonb_typeof(new.specs -> 'capacityGb') is distinct from 'number' then
    raise exception 'Informe a capacidade da memória em GB.' using errcode = '23514';
  end if;
  capacity := (new.specs ->> 'capacityGb')::numeric;
  if capacity < 1 then
    raise exception 'A capacidade da memória deve ser maior que zero.' using errcode = '23514';
  end if;
  if jsonb_typeof(new.specs -> 'frequencyMhz') is distinct from 'number' then
    raise exception 'Selecione uma frequência de memória válida.' using errcode = '23514';
  end if;
  frequency := (new.specs ->> 'frequencyMhz')::numeric;
  if frequency not in (800,1066,1333,1600,1866,2133,2400,2666,2933,3000,3200,3600,4000,4266,4800,5200,5600,6000,6400,7200,7600,8000,8400) then
    raise exception 'A frequência de memória selecionada é inválida.' using errcode = '23514';
  end if;
  if jsonb_typeof(new.specs -> 'formFactor') is distinct from 'string'
    or not (new.specs ->> 'formFactor') = any(array['DIMM','SO-DIMM','CAMM2']) then
    raise exception 'Selecione um formato de memória válido.' using errcode = '23514';
  end if;
  if new.specs ? 'ecc' and jsonb_typeof(new.specs -> 'ecc') <> 'boolean' then
    raise exception 'ECC deve ser verdadeiro ou falso.' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger components_enforce_ram_specs
before insert or update of category, specs on public.components
for each row execute function public.enforce_ram_component_specs();

create or replace function public.admin_create_component(
  p_category public.component_category,
  p_manufacturer text,
  p_name text,
  p_model text,
  p_description text,
  p_specs jsonb,
  p_lot_code text,
  p_quantity integer,
  p_purchase_date date,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_profile_id uuid;
  new_component public.components;
  new_lot public.component_lots;
  should_create_lot boolean;
begin
  if not public.is_active_admin() then
    raise exception 'Apenas administradores ativos podem cadastrar componentes.'
      using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity < 0 or p_quantity > 100000 then
    raise exception 'A quantidade inicial deve estar entre zero e cem mil.' using errcode = '22023';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Informe o nome do componente.' using errcode = '22023';
  end if;
  if p_model is null or length(trim(p_model)) = 0 then
    raise exception 'Informe o modelo do componente.' using errcode = '22023';
  end if;
  if p_category = 'RAM' and (p_lot_code is null or length(trim(p_lot_code)) = 0) then
    raise exception 'Informe o lote da memória RAM ou marque Sem Informação.' using errcode = '22023';
  end if;
  if p_lot_code is not null and length(trim(p_lot_code)) > 80 then
    raise exception 'O lote não pode ultrapassar 80 caracteres.' using errcode = '22023';
  end if;

  select id into actor_profile_id from public.profiles where auth_user_id = actor_id;
  insert into public.components (
    category, manufacturer, name, model, description, specs, created_by
  ) values (
    p_category,
    trim(p_manufacturer),
    trim(p_name),
    trim(p_model),
    nullif(trim(p_description), ''),
    coalesce(p_specs, '{}'::jsonb),
    actor_profile_id
  ) returning * into new_component;

  should_create_lot := p_quantity > 0 or p_category = 'RAM';
  if should_create_lot then
    insert into public.component_lots (
      component_id, lot_code, quantity_total, purchase_date, notes
    ) values (
      new_component.id,
      nullif(trim(p_lot_code), ''),
      p_quantity,
      p_purchase_date,
      nullif(trim(p_notes), '')
    ) returning * into new_lot;
  end if;

  insert into public.audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
  values (
    actor_profile_id,
    'component.created',
    'component',
    new_component.id,
    null,
    jsonb_build_object(
      'component', to_jsonb(new_component),
      'initial_lot', case when should_create_lot then to_jsonb(new_lot) else null end
    )
  );

  return new_component.id;
end;
$$;
