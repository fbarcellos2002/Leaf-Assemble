alter table public.components add column name text;

update public.components
set name = concat_ws(' ', nullif(trim(manufacturer), ''), nullif(trim(model), ''));

alter table public.components alter column name set not null;
alter table public.components
  add constraint components_name_not_blank check (length(trim(name)) > 0);

create index components_name_idx on public.components (name);

drop function public.admin_create_component(
  public.component_category, text, text, text, jsonb, text, integer, date, text
);

create function public.admin_create_component(
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

  select id into actor_profile_id from public.profiles where auth_user_id = actor_id;
  insert into public.components (
    category, manufacturer, name, model, description, specs, created_by
  ) values (
    p_category,
    trim(p_manufacturer),
    trim(p_name),
    coalesce(nullif(trim(p_model), ''), trim(p_name)),
    nullif(trim(p_description), ''),
    coalesce(p_specs, '{}'::jsonb),
    actor_profile_id
  ) returning * into new_component;

  if p_quantity > 0 then
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
      'initial_lot', case when p_quantity > 0 then to_jsonb(new_lot) else null end
    )
  );

  return new_component.id;
end;
$$;

revoke all on function public.admin_create_component(
  public.component_category, text, text, text, text, jsonb, text, integer, date, text
) from public;
grant execute on function public.admin_create_component(
  public.component_category, text, text, text, text, jsonb, text, integer, date, text
) to authenticated;
