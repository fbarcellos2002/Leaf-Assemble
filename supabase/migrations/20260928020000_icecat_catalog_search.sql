create extension if not exists pg_trgm with schema extensions;

create table public.icecat_catalog (
  icecat_id bigint primary key,
  supplier_id integer not null,
  supplier_name text not null,
  product_code text not null,
  model_name text not null,
  category_id integer,
  quality text not null,
  gtins text[] not null default '{}',
  image_url text,
  updated_at timestamptz,
  search_text text generated always as (
    supplier_name || ' ' || model_name || ' ' || product_code
  ) stored,
  constraint icecat_catalog_icecat_id_positive check (icecat_id > 0),
  constraint icecat_catalog_product_code_not_blank check (length(trim(product_code)) > 0),
  constraint icecat_catalog_model_name_not_blank check (length(trim(model_name)) > 0)
);

create index icecat_catalog_search_idx
  on public.icecat_catalog using gin (search_text extensions.gin_trgm_ops);

create index icecat_catalog_supplier_product_idx
  on public.icecat_catalog (supplier_id, product_code);

alter table public.icecat_catalog enable row level security;

revoke all on public.icecat_catalog from anon, authenticated;
grant select on public.icecat_catalog to authenticated;
grant select, insert, update, delete on public.icecat_catalog to service_role;

create policy "Active admins can search Icecat catalog"
on public.icecat_catalog for select to authenticated
using ((select public.is_active_admin()));
