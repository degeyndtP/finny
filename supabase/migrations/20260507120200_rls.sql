-- =============================================================================
-- Finny — Row Level Security
-- =============================================================================
-- Every domain table is scoped by household_id. A user can only see/modify rows
-- whose household_id is in the set of households they are a member of.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper: returns set of household_ids the current auth.uid() belongs to.
-- security definer to bypass RLS on household_members itself when called
-- inside policies on other tables.
-- -----------------------------------------------------------------------------
create or replace function public.auth_household_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id
  from public.household_members
  where user_id = auth.uid();
$$;

grant execute on function public.auth_household_ids() to authenticated;

-- Enable RLS on every domain table
alter table public.households            enable row level security;
alter table public.household_members     enable row level security;
alter table public.bank_connections      enable row level security;
alter table public.accounts              enable row level security;
alter table public.categories            enable row level security;
alter table public.transactions          enable row level security;
alter table public.categorization_rules  enable row level security;
alter table public.planned_cashflows     enable row level security;
alter table public.sync_runs             enable row level security;

-- -----------------------------------------------------------------------------
-- households
-- -----------------------------------------------------------------------------
create policy "households: members can read"
  on public.households for select to authenticated
  using (id in (select public.auth_household_ids()));

create policy "households: owners can update"
  on public.households for update to authenticated
  using (
    exists (
      select 1 from public.household_members hm
      where hm.household_id = public.households.id
        and hm.user_id = auth.uid()
        and hm.role = 'owner'
    )
  );

-- Insert path: only via the on_auth_user_created trigger or an RPC. We do not
-- expose direct INSERT on households to the client.

-- -----------------------------------------------------------------------------
-- household_members
-- -----------------------------------------------------------------------------
create policy "household_members: read own memberships"
  on public.household_members for select to authenticated
  using (
    user_id = auth.uid()
    or household_id in (select public.auth_household_ids())
  );

create policy "household_members: owners can add"
  on public.household_members for insert to authenticated
  with check (
    exists (
      select 1 from public.household_members hm
      where hm.household_id = household_members.household_id
        and hm.user_id = auth.uid()
        and hm.role = 'owner'
    )
  );

create policy "household_members: owners can remove"
  on public.household_members for delete to authenticated
  using (
    exists (
      select 1 from public.household_members hm
      where hm.household_id = household_members.household_id
        and hm.user_id = auth.uid()
        and hm.role = 'owner'
    )
  );

-- -----------------------------------------------------------------------------
-- Generic household-scoped policies (read + write for any member).
-- bank_connections, accounts, categories, transactions, categorization_rules,
-- planned_cashflows, sync_runs.
-- -----------------------------------------------------------------------------

-- bank_connections
create policy "bank_connections: members r"  on public.bank_connections for select to authenticated using (household_id in (select public.auth_household_ids()));
create policy "bank_connections: members w"  on public.bank_connections for all    to authenticated using (household_id in (select public.auth_household_ids())) with check (household_id in (select public.auth_household_ids()));

-- accounts
create policy "accounts: members r"          on public.accounts for select to authenticated using (household_id in (select public.auth_household_ids()));
create policy "accounts: members w"          on public.accounts for all    to authenticated using (household_id in (select public.auth_household_ids())) with check (household_id in (select public.auth_household_ids()));

-- categories
create policy "categories: members r"        on public.categories for select to authenticated using (household_id in (select public.auth_household_ids()));
create policy "categories: members w"        on public.categories for all    to authenticated using (household_id in (select public.auth_household_ids())) with check (household_id in (select public.auth_household_ids()));

-- transactions
create policy "transactions: members r"      on public.transactions for select to authenticated using (household_id in (select public.auth_household_ids()));
create policy "transactions: members w"      on public.transactions for all    to authenticated using (household_id in (select public.auth_household_ids())) with check (household_id in (select public.auth_household_ids()));

-- categorization_rules
create policy "categorization_rules: members r"  on public.categorization_rules for select to authenticated using (household_id in (select public.auth_household_ids()));
create policy "categorization_rules: members w"  on public.categorization_rules for all    to authenticated using (household_id in (select public.auth_household_ids())) with check (household_id in (select public.auth_household_ids()));

-- planned_cashflows
create policy "planned_cashflows: members r" on public.planned_cashflows for select to authenticated using (household_id in (select public.auth_household_ids()));
create policy "planned_cashflows: members w" on public.planned_cashflows for all    to authenticated using (household_id in (select public.auth_household_ids())) with check (household_id in (select public.auth_household_ids()));

-- sync_runs (read-only for members; service role writes)
create policy "sync_runs: members r"         on public.sync_runs for select to authenticated using (household_id in (select public.auth_household_ids()));
