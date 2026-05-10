-- =============================================================================
-- Revert auth_household_ids to SECURITY DEFINER.
--
-- Migration 20260507120400 switched the function to SECURITY INVOKER to silence
-- a Supabase lint (0029, "Signed-In Users Can Execute SECURITY DEFINER
-- Function"). That triggered Postgres "stack depth limit exceeded" at runtime:
-- the household_members RLS policy is
--   `using (user_id = auth.uid() OR household_id IN (select auth_household_ids()))`
-- so with INVOKER the function reads household_members as the caller, which
-- causes PostgreSQL to evaluate the recursive call inside the OR branch and
-- spiral.
--
-- DEFINER bypasses RLS for the lookup. No privilege escalation: the
-- function still only returns household_ids that the caller is a member of,
-- via the explicit `where user_id = auth.uid()`.
-- =============================================================================

create or replace function public.auth_household_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select household_id
  from public.household_members
  where user_id = auth.uid();
$$;

grant execute on function public.auth_household_ids() to authenticated;
revoke execute on function public.auth_household_ids() from public, anon;
