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
  actor_profile_id uuid;
  previous_profile public.profiles;
  updated_profile public.profiles;
begin
  if not public.is_active_admin() then
    raise exception 'Apenas administradores ativos podem gerenciar usuários.'
      using errcode = '42501';
  end if;

  select profile.id into actor_profile_id
  from public.profiles as profile
  where profile.auth_user_id = (select auth.uid())
    and profile.role = 'ADMIN'::public.app_role
    and profile.is_active;

  if actor_profile_id is null then
    raise exception 'Perfil de administrador ativo necessário.'
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
    actor_profile_id,
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
