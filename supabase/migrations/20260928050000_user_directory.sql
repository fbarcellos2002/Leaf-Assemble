create or replace function public.user_directory()
returns table (
  id uuid,
  name text,
  role public.app_role
)
language sql
stable
security definer
set search_path = ''
as $$
  select profile.id, profile.name, profile.role
  from public.profiles as profile
  where profile.is_active
    and exists (
      select 1
      from public.profiles as actor
      where actor.auth_user_id = (select auth.uid())
        and actor.is_active
    );
$$;

revoke all on function public.user_directory() from public;
grant execute on function public.user_directory() to authenticated;
