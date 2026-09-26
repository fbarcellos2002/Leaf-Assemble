create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

alter table public.audit_logs enable row level security;
grant select on public.audit_logs to authenticated;

create policy "Active admins can read audit logs"
on public.audit_logs for select to authenticated
using ((select public.is_active_admin()));

create or replace function public.admin_update_profile(
  p_auth_user_id uuid,
  p_name text,
  p_role public.app_role,
  p_is_active boolean,
  p_action text
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  previous_profile public.profiles;
  updated_profile public.profiles;
begin
  if not public.is_active_admin() then
    raise exception 'Apenas administradores ativos podem gerenciar usuários.'
      using errcode = '42501';
  end if;

  if p_action not in (
    'user.created',
    'user.updated',
    'user.activated',
    'user.deactivated',
    'user.role_changed'
  ) then
    raise exception 'Ação de auditoria inválida.' using errcode = '22023';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'O nome não pode ficar vazio.' using errcode = '22023';
  end if;

  select * into strict previous_profile
  from public.profiles
  where auth_user_id = p_auth_user_id
  for update;

  update public.profiles
  set name = trim(p_name), role = p_role, is_active = p_is_active
  where auth_user_id = p_auth_user_id
  returning * into updated_profile;

  if p_action = 'user.created' then
    p_action := 'user.created';
  elsif previous_profile.role is distinct from updated_profile.role then
    p_action := 'user.role_changed';
  elsif previous_profile.is_active is distinct from updated_profile.is_active then
    p_action := case when updated_profile.is_active then 'user.activated' else 'user.deactivated' end;
  else
    p_action := 'user.updated';
  end if;

  insert into public.audit_logs (
    user_id, action, entity_type, entity_id, old_data, new_data
  ) values (
    actor_id,
    p_action,
    'profile',
    updated_profile.id,
    to_jsonb(previous_profile),
    to_jsonb(updated_profile)
  );

  return updated_profile;
end;
$$;

revoke all on function public.admin_update_profile(uuid, text, public.app_role, boolean, text) from public;
grant execute on function public.admin_update_profile(uuid, text, public.app_role, boolean, text) to authenticated;

create or replace function public.record_auth_login()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles;
begin
  select * into actor
  from public.profiles
  where auth_user_id = (select auth.uid()) and is_active;
  if actor.id is null then
    raise exception 'Perfil ativo necessário.' using errcode = '42501';
  end if;
  insert into public.audit_logs (user_id, action, entity_type, entity_id, new_data)
  values (actor.id, 'auth.login', 'profile', actor.id, jsonb_build_object('email', actor.email));
end;
$$;

revoke all on function public.record_auth_login() from public;
grant execute on function public.record_auth_login() to authenticated;
