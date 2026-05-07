# Finny

Personal finance dashboard — income, expenses, and cashflow planning fed by your real bank accounts via PSD2.

## Stack

- **Web**: Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui
- **Data**: Supabase (Postgres + Auth + RLS), all migrations applied via the Supabase MCP
- **Banking**: [Enable Banking](https://enablebanking.com/) — Berlin Group XS2A aggregator covering KBC, Belfius, BNP Paribas Fortis, ING, Argenta, etc. (We originally planned GoCardless Bank Account Data; it stopped accepting new free signups in mid-2025.)
- **Mobile-ready**: provider-agnostic banking + domain types live in `src/lib/*` so a future React Native (Expo) client can reuse them.

## Project layout

```
src/
  app/
    (app)/              authenticated routes (protected by proxy.ts)
      page.tsx          overview dashboard
      transactions/
      cashflow/
      accounts/
    login/              magic-link sign-in
    auth/callback/      Supabase OAuth/OTP exchange
  components/
    ui/                 shadcn primitives
    providers.tsx       TanStack Query
    user-menu.tsx
  lib/
    supabase/           browser, server, service-role clients + middleware
    gocardless/         legacy GoCardless adapter — to be folded into a
                        provider-agnostic `banking/` module in phase 2
    format.ts           money/date helpers
  proxy.ts              session refresh + auth gating
keys/                   gitignored — Enable Banking RSA keypair lives here
supabase/
  migrations/
    20260507120000_init.sql                              core schema
    20260507120100_functions.sql                         seed + auth trigger
    20260507120200_rls.sql                               row-level security
    20260507120300_harden_function_security.sql          revoke RPC + search_path
    20260507120400_auth_household_ids_security_invoker.sql
```

## Setup

### 1. Environment variables

`.env.local` is created and gitignored. Fill in the one missing secret:

- `SUPABASE_SERVICE_ROLE_KEY` — Supabase Dashboard → Project Settings → API → `service_role` (NEVER commit it).

The Enable Banking app is already registered (`ENABLE_BANKING_APP_ID` filled in `.env.local`). Its private key lives in `keys/enablebanking_private.pem` and is gitignored.

### 2. Database

All five migrations are already applied to the Supabase project. To replay against a fresh project, either:

- Run them through the Supabase MCP (`apply_migration`), or
- Paste each file from `supabase/migrations/` into the Supabase SQL editor in numeric order, or
- `supabase db push` if you wire up the local CLI.

### 3. Supabase auth redirect URLs

Supabase Dashboard → Authentication → URL Configuration:

- Site URL: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000/auth/callback`

### 4. Run

```bash
npm run dev
```

Visit <http://localhost:3000>, magic-link sign in, and the `on_auth_user_created` trigger will spin up your household with default categories.

## Working with Enable Banking keys

```
keys/
  enablebanking_private.pem   # 2048-bit RSA private key — secret
  enablebanking_public.crt    # self-signed X.509 cert — already submitted to Enable Banking
```

To regenerate (only if you want to rotate or start over):

```bash
openssl genrsa -out keys/enablebanking_private.pem 2048
openssl req -new -x509 \
  -key keys/enablebanking_private.pem \
  -out keys/enablebanking_public.crt \
  -days 730 \
  -subj "/CN=Finny/O=Pieter De Geyndt/C=BE"
```

Then upload the new `public.crt` content via Enable Banking's `/api/applications` endpoint and update `ENABLE_BANKING_APP_ID` in `.env.local`.

## Roadmap

- [x] Schema, RLS, auth, app shell, types from live Supabase
- [x] Enable Banking sandbox application registered
- [ ] **Phase 2**: refactor `src/lib/gocardless/` into `src/lib/banking/` with a provider-agnostic interface and an `enablebanking` adapter that signs JWTs with the local RSA key, lists institutions, opens a consent session, and on callback persists accounts + first sync
- [ ] **Phase 3**: cashflow chart on `/`, category breakdown
- [ ] **Phase 4**: planned cashflows CRUD + projection
- [ ] **Phase 5**: categorization rules + auto-apply on sync
- [ ] **Phase 6**: scheduled daily sync (Supabase Edge Function + pg_cron)
- [ ] **Phase 7**: React Native (Expo) client reusing `src/lib/*`
