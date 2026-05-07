# Finny

Personal finance dashboard — income, expenses, and cashflow planning fed by your real bank accounts via PSD2.

## Stack

- **Web**: Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui
- **Data**: Supabase (Postgres + Auth + RLS)
- **Banking**: GoCardless Bank Account Data (free PSD2 access for EU banks)
- **Mobile-ready**: API + domain types live in `src/lib/*` so a future React Native (Expo) client can reuse them.

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
    gocardless/         typed PSD2 client + transaction normaliser
    format.ts           money/date helpers
  proxy.ts              session refresh + auth gating (Next.js 16 successor of middleware.ts)
supabase/
  migrations/
    20260507120000_init.sql        schema (households, accounts, transactions, …)
    20260507120100_functions.sql   default-category seed + on_auth_user_created trigger
    20260507120200_rls.sql         row-level security policies
```

## Setup

1. **Copy env**: `cp .env.example .env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` — already set to your project
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` — Supabase Dashboard → Project Settings → API
   - `GOCARDLESS_SECRET_ID` and `GOCARDLESS_SECRET_KEY` — register at <https://bankaccountdata.gocardless.com/> (free), Developer → User Secrets

2. **Apply migrations** in order to your Supabase project. Three options:
   - **MCP** (after restarting Claude Code): ask Claude to run them via the Supabase MCP server
   - **Supabase CLI**: `supabase db push` (if you initialise the local project)
   - **Dashboard**: paste each `supabase/migrations/*.sql` file into Project → SQL editor and run

3. **Configure auth redirect** in Supabase Dashboard → Authentication → URL Configuration:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/callback`

4. **Run dev server**:
   ```bash
   npm run dev
   ```

   Open <http://localhost:3000>. You'll be redirected to `/login`. Send yourself a magic link, click it in your email, and you'll land on the empty dashboard. The `on_auth_user_created` trigger automatically creates a household for you with default categories.

## Roadmap

- [x] Schema, RLS, auth, app shell
- [ ] **Phase 2**: GoCardless consent flow at `/accounts/connect` — list institutions, create requisition, callback handler, persist accounts + first sync
- [ ] **Phase 3**: cashflow chart on `/` (Recharts via shadcn chart), category bar chart
- [ ] **Phase 4**: planned cashflows CRUD, projection
- [ ] **Phase 5**: categorization rules + auto-apply on sync
- [ ] **Phase 6**: scheduled daily sync (Supabase Edge Function + pg_cron)
- [ ] **Phase 7**: React Native (Expo) client reusing `src/lib/*`
