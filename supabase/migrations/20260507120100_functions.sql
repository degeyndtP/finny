-- =============================================================================
-- Finny — domain functions
-- =============================================================================

-- -----------------------------------------------------------------------------
-- seed_default_categories(household_id)
-- Adds a sensible starter taxonomy to a fresh household.
-- -----------------------------------------------------------------------------
create or replace function public.seed_default_categories(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- income
  insert into public.categories (household_id, name, kind, color, icon, sort_order) values
    (p_household_id, 'Salary',         'income',  '#10B981', 'briefcase',     1),
    (p_household_id, 'Refunds',        'income',  '#10B981', 'rotate-ccw',    2),
    (p_household_id, 'Other income',   'income',  '#10B981', 'plus-circle', 99);

  -- expense
  insert into public.categories (household_id, name, kind, color, icon, sort_order) values
    (p_household_id, 'Housing',        'expense', '#EF4444', 'home',          1),
    (p_household_id, 'Groceries',      'expense', '#F97316', 'shopping-cart', 2),
    (p_household_id, 'Transport',      'expense', '#F59E0B', 'car',           3),
    (p_household_id, 'Utilities',      'expense', '#EAB308', 'zap',           4),
    (p_household_id, 'Insurance',      'expense', '#A855F7', 'shield',        5),
    (p_household_id, 'Subscriptions',  'expense', '#EC4899', 'repeat',        6),
    (p_household_id, 'Eating out',     'expense', '#06B6D4', 'utensils',      7),
    (p_household_id, 'Leisure',        'expense', '#3B82F6', 'sparkles',      8),
    (p_household_id, 'Health',         'expense', '#EC4899', 'heart-pulse',   9),
    (p_household_id, 'Other expenses', 'expense', '#6B7280', 'minus-circle', 99);

  -- transfer
  insert into public.categories (household_id, name, kind, color, icon, sort_order) values
    (p_household_id, 'Internal transfer', 'transfer', '#94A3B8', 'arrow-right-left', 1);
end;
$$;

-- -----------------------------------------------------------------------------
-- on_auth_user_created()
-- When a new auth.users row is created, give them their first household,
-- make them owner, and seed default categories. Onboarding becomes one signup.
-- -----------------------------------------------------------------------------
create or replace function public.on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
begin
  insert into public.households (name, created_by)
  values (coalesce(new.raw_user_meta_data->>'household_name', 'My household'), new.id)
  returning id into v_household_id;

  insert into public.household_members (household_id, user_id, role)
  values (v_household_id, new.id, 'owner');

  perform public.seed_default_categories(v_household_id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.on_auth_user_created();
