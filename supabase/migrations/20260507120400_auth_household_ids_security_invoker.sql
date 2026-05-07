-- =============================================================================
-- auth_household_ids: switch to SECURITY INVOKER.
--
-- The function only returns rows the caller already has SELECT-RLS access to
-- (their own household_members rows). SECURITY DEFINER is unnecessary and
-- triggers a lint (0029) about callable-by-authenticated DEFINER functions.
-- SECURITY INVOKER keeps the same behaviour because RLS on household_members
-- already filters on `user_id = auth.uid()`.
-- =============================================================================

create or replace function public.auth_household_ids()
returns setof uuid
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select household_id
  from public.household_members
  where user_id = auth.uid();
$$;

grant execute on function public.auth_household_ids() to authenticated;
