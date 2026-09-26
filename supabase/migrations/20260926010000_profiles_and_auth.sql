create type public.app_role as enum ('ADMIN', 'VISITANTE');

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  email text not null,
  name text not null default 'Novo usuário',
  role public.app_role not null default 'VISITANTE',
  is_active boolean not null default true,
  is_protected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz,
  constraint profiles_name_not_blank check (length(trim(name)) > 0)
);

create index profiles_role_active_idx on public.profiles (role, is_active);
create unique index profiles_email_lower_idx on public.profiles (lower(email));
create unique index profiles_single_protected_admin_idx
  on public.profiles (is_protected)
  where is_protected;

create or replace function public.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.auth_user_id = (select auth.uid())
      and p.role = 'ADMIN'::public.app_role
      and p.is_active
  );
$$;

revoke all on function public.is_active_admin() from public;
grant execute on function public.is_active_admin() to authenticated;

create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_profile_updated_at();

create or replace function public.enforce_profile_protection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  remaining_admins integer;
begin
  if tg_op = 'DELETE' then
    if old.is_protected then
      raise exception 'O administrador protegido não pode ser excluído.'
        using errcode = '23514';
    end if;

    if old.role = 'ADMIN' and old.is_active then
      perform pg_advisory_xact_lock(hashtext('leaf_assemble_active_admin_guard')::bigint);
      select count(*) into remaining_admins
      from public.profiles p
      where p.role = 'ADMIN'::public.app_role
        and p.is_active
        and p.auth_user_id <> old.auth_user_id;

      if remaining_admins = 0 then
        raise exception 'O sistema precisa manter ao menos um administrador ativo.'
          using errcode = '23514';
      end if;
    end if;

    return old;
  else
    if old.is_protected and (
      new.role <> 'ADMIN' or not new.is_active or new.is_protected is distinct from true
    ) then
      raise exception 'O administrador protegido deve permanecer ativo e administrador.'
        using errcode = '23514';
    end if;

    if old.role = 'ADMIN' and old.is_active
      and (new.role <> 'ADMIN' or not new.is_active) then
      perform pg_advisory_xact_lock(hashtext('leaf_assemble_active_admin_guard')::bigint);
      select count(*) into remaining_admins
      from public.profiles p
      where p.role = 'ADMIN'::public.app_role
        and p.is_active
        and p.auth_user_id <> old.auth_user_id;

      if remaining_admins = 0 then
        raise exception 'O sistema precisa manter ao menos um administrador ativo.'
          using errcode = '23514';
      end if;
    end if;

    return new;
  end if;
end;
$$;

create trigger profiles_enforce_protection
before update or delete on public.profiles
for each row execute function public.enforce_profile_protection();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (auth_user_id, email, name)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(new.email, '@', 1),
      'Novo usuário'
    )
  )
  on conflict (auth_user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.handle_auth_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where auth_user_id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
after update of email on auth.users
for each row execute function public.handle_auth_user_email_change();

create or replace function public.handle_auth_last_sign_in()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.last_sign_in_at is distinct from old.last_sign_in_at then
    update public.profiles
      set last_login_at = new.last_sign_in_at
      where auth_user_id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_last_sign_in
after update of last_sign_in_at on auth.users
for each row execute function public.handle_auth_last_sign_in();

alter table public.profiles enable row level security;

grant select on public.profiles to authenticated;

create policy "Users can read their own profile"
on public.profiles for select to authenticated
using (auth_user_id = (select auth.uid()) or (select public.is_active_admin()));
