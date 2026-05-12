# Finny

Personal Belgian banking dashboard. Public for transparency / forkable as a template. No support; fork it and run your own.

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

## Self-host setup (forks)

Finny is shared as a template — you can fork it and run your own copy. To get a working deployment you need to wire up these accounts and secrets yourself.

### Accounts to create

1. **Supabase** project — Postgres + Auth + RLS. Run the SQL files in `supabase/migrations/` in numeric order against your new project.
2. **Enable Banking** application — request access at <https://enablebanking.com/>. You need your own `app_id` and RSA keypair (see "Working with Enable Banking keys" above).
3. **Vercel** project — link this repo, set the env vars below, deploy.

### Required environment variables (Vercel + `.env.local`)

See [`.env.example`](.env.example) for the full list with descriptions. The variables that are **secrets** (never commit them):

| Variable | Where to get it | Mark as Sensitive on Vercel |
|----------|-----------------|------------------------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` | ✓ |
| `ENABLE_BANKING_PRIVATE_KEY` | `keys/enablebanking_private.pem` (inline as PEM with `\n` escapes) | ✓ |
| `CRON_SECRET` | Generate yourself: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | ✓ |
| `COLUMN_ENCRYPTION_KEY` | Generate yourself: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` — **back this up in a password manager; losing it makes encrypted bank session tokens unrecoverable** | ✓ |

### GitHub Actions setup (for daily bank sync)

Finny runs a 3×/day automatic bank sync via `.github/workflows/sync-bank.yml` (GitHub Actions is more reliable than Vercel Hobby cron). To enable it on your fork:

1. Go to **your fork's** Settings → Secrets and variables → Actions → **New repository secret**
2. Name: `CRON_SECRET`. Value: same string you put in Vercel's `CRON_SECRET` env var
3. Wait for the next scheduled run (9:01 / 12:01 / 17:01 Brussels time, year-round), or trigger manually from the Actions tab → "Sync bank transactions" → "Run workflow"

If `CRON_SECRET` is missing, the workflow fails on the first step with a clear error message.

Adjust the schedule and timezone-filter in `.github/workflows/sync-bank.yml` if you're not in Belgium.

