-- =============================================================================
-- categories.monthly_budget — per-category monthly budget.
-- =============================================================================
-- Stored as a positive number. The app surfaces budgets only on expense
-- categories today, but the column stays kind-agnostic so a future "income
-- target" feature can reuse it without another migration.
-- =============================================================================

alter table public.categories
  add column if not exists monthly_budget numeric(14,2);

comment on column public.categories.monthly_budget is
  'Optional monthly budget (positive number, currency = household.base_currency).';
