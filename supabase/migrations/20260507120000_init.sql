-- =============================================================================
-- Finny — initial schema
-- =============================================================================
-- Multi-user-ready from day 1: every domain row is scoped by household_id.
-- A household has 1..N members. RLS (next migration) restricts visibility to
-- the auth user's households.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- households
-- -----------------------------------------------------------------------------
create table public.households (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  base_currency   text not null default 'EUR',
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null
);

-- -----------------------------------------------------------------------------
-- household_members  (user ↔ household, with role)
-- -----------------------------------------------------------------------------
create table public.household_members (
  household_id    uuid not null references public.households(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null default 'owner' check (role in ('owner','member','viewer')),
  joined_at       timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index household_members_user_id_idx on public.household_members (user_id);

-- -----------------------------------------------------------------------------
-- bank_connections  (one PSD2 consent per institution per household)
-- -----------------------------------------------------------------------------
create table public.bank_connections (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references public.households(id) on delete cascade,
  provider            text not null default 'gocardless',
  institution_id      text not null,                    -- e.g. KBC_KREDBEBB
  institution_name    text not null,
  institution_logo    text,
  requisition_id      text,                             -- GoCardless requisition id
  agreement_id        text,                             -- GoCardless end_user_agreement id
  status              text not null default 'pending'
                      check (status in ('pending','linked','expired','error','revoked')),
  expires_at          timestamptz,                      -- when consent expires (PSD2 = 90d)
  last_error          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index bank_connections_household_idx on public.bank_connections (household_id);

-- -----------------------------------------------------------------------------
-- accounts  (IBAN-level account from a bank_connection)
-- -----------------------------------------------------------------------------
create table public.accounts (
  id                    uuid primary key default gen_random_uuid(),
  household_id          uuid not null references public.households(id) on delete cascade,
  bank_connection_id    uuid not null references public.bank_connections(id) on delete cascade,
  external_account_id   text not null,                  -- GoCardless account uuid
  iban                  text,
  display_name          text,
  owner_name            text,
  currency              text not null default 'EUR',
  balance_amount        numeric(14,2),
  balance_date          date,
  last_synced_at        timestamptz,
  archived              boolean not null default false,
  created_at            timestamptz not null default now(),
  unique (bank_connection_id, external_account_id)
);

create index accounts_household_idx on public.accounts (household_id);

-- -----------------------------------------------------------------------------
-- categories  (hierarchical, per household)
-- -----------------------------------------------------------------------------
create table public.categories (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.households(id) on delete cascade,
  parent_id       uuid references public.categories(id) on delete cascade,
  name            text not null,
  kind            text not null check (kind in ('income','expense','transfer')),
  color           text,
  icon            text,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);

create index categories_household_idx on public.categories (household_id);
create unique index categories_unique_name_per_parent
  on public.categories (household_id, coalesce(parent_id::text, ''), lower(name));

-- -----------------------------------------------------------------------------
-- transactions
-- -----------------------------------------------------------------------------
create table public.transactions (
  id                      uuid primary key default gen_random_uuid(),
  household_id            uuid not null references public.households(id) on delete cascade,
  account_id              uuid not null references public.accounts(id) on delete cascade,
  external_id             text not null,                 -- GoCardless transactionId
  booking_date            date not null,
  value_date              date,
  amount                  numeric(14,2) not null,        -- signed: negative = outflow
  currency                text not null default 'EUR',
  counterparty_name       text,
  counterparty_iban       text,
  counterparty_account    text,
  description             text,
  remittance_info         text,
  category_id             uuid references public.categories(id) on delete set null,
  is_internal_transfer    boolean not null default false,
  notes                   text,
  raw                     jsonb,                         -- full payload from provider
  created_at              timestamptz not null default now(),
  unique (account_id, external_id)
);

create index transactions_household_booking_idx on public.transactions (household_id, booking_date desc);
create index transactions_account_booking_idx   on public.transactions (account_id, booking_date desc);
create index transactions_category_idx          on public.transactions (category_id);

-- -----------------------------------------------------------------------------
-- categorization_rules  (auto-categorise incoming transactions)
-- -----------------------------------------------------------------------------
create table public.categorization_rules (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references public.households(id) on delete cascade,
  category_id         uuid not null references public.categories(id) on delete cascade,
  match_field         text not null check (match_field in ('counterparty_name','counterparty_iban','description','remittance_info')),
  match_type          text not null check (match_type in ('contains','equals','regex')),
  match_value         text not null,
  is_case_sensitive   boolean not null default false,
  priority            int not null default 0,
  created_at          timestamptz not null default now()
);

create index categorization_rules_household_idx on public.categorization_rules (household_id, priority desc);

-- -----------------------------------------------------------------------------
-- planned_cashflows  (manual future income/expenses, drives the cashflow chart)
-- -----------------------------------------------------------------------------
create table public.planned_cashflows (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references public.households(id) on delete cascade,
  account_id          uuid references public.accounts(id) on delete set null,
  category_id         uuid references public.categories(id) on delete set null,
  description         text not null,
  amount              numeric(14,2) not null,            -- signed
  currency            text not null default 'EUR',
  due_date            date not null,
  recurrence          text not null default 'none'
                      check (recurrence in ('none','weekly','monthly','quarterly','yearly')),
  recurrence_until    date,
  created_at          timestamptz not null default now()
);

create index planned_cashflows_household_due_idx on public.planned_cashflows (household_id, due_date);

-- -----------------------------------------------------------------------------
-- sync_runs  (audit log for bank-data sync attempts)
-- -----------------------------------------------------------------------------
create table public.sync_runs (
  id                      uuid primary key default gen_random_uuid(),
  household_id            uuid not null references public.households(id) on delete cascade,
  bank_connection_id      uuid references public.bank_connections(id) on delete cascade,
  status                  text not null check (status in ('running','success','error')),
  transactions_added      int not null default 0,
  error_message           text,
  started_at              timestamptz not null default now(),
  finished_at             timestamptz
);

create index sync_runs_household_started_idx on public.sync_runs (household_id, started_at desc);

-- -----------------------------------------------------------------------------
-- updated_at trigger helper
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_bank_connections_updated_at
  before update on public.bank_connections
  for each row execute function public.set_updated_at();
