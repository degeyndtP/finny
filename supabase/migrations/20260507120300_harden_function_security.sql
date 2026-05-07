-- =============================================================================
-- Tighten SECURITY DEFINER functions:
--   - on_auth_user_created and seed_default_categories are trigger-internals,
--     nobody should call them via RPC. Triggers still fire because they run
--     under the table owner, not the API caller.
--   - set_updated_at gets an explicit search_path (lint 0011).
-- =============================================================================

revoke execute on function public.on_auth_user_created()        from public, anon, authenticated;
revoke execute on function public.seed_default_categories(uuid) from public, anon, authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
