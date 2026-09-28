create or replace function public.admin_delete_user(p_auth_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_auth_user_id uuid := (select auth.uid());
  actor_profile public.profiles;
  target_profile public.profiles;
begin
  if not public.is_active_admin() then
    raise exception 'Apenas administradores ativos podem remover usuários.'
      using errcode = '42501';
  end if;

  select * into actor_profile
  from public.profiles
  where auth_user_id = actor_auth_user_id
  for update;

  select * into target_profile
  from public.profiles
  where auth_user_id = p_auth_user_id
  for update;

  if not found then
    raise exception 'Usuário não encontrado.' using errcode = 'P0002';
  end if;

  if target_profile.auth_user_id = actor_auth_user_id then
    raise exception 'Não é possível remover a própria conta.' using errcode = '23514';
  end if;

  if target_profile.is_protected then
    raise exception 'O administrador protegido não pode ser removido.' using errcode = '23514';
  end if;

  insert into public.audit_logs (
    user_id, action, entity_type, entity_id, old_data, new_data
  ) values (
    actor_profile.id,
    'user.deleted',
    'profile',
    target_profile.id,
    to_jsonb(target_profile),
    null
  );

  delete from auth.users
  where id = p_auth_user_id;

  if not found then
    raise exception 'Usuário não encontrado.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;
