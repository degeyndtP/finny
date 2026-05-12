# Finny

Personal banking dashboard. Pulls transactions from your Belgian bank accounts over PSD2, then renders an overview, cashflow analysis, recurring-payment detection, and forecasting.

Public for transparency / forkable as a template. No support — fork it and run your own.

## Stack

- **Web**: Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui (Base UI flavour)
- **Data**: Supabase (Postgres + Auth + RLS), column-level encryption on bank session tokens
- **Banking**: [Enable Banking](https://enablebanking.com/) — Berlin Group XS2A aggregator covering KBC, Belfius, BNP Paribas Fortis, ING, Argenta, etc.
- **Hosting**: Vercel (Frankfurt region by default)
- **Daily sync**: GitHub Actions cron, 3× per day, timezone-aware

The banking + cashflow code in `src/lib/*` is framework-agnostic — a future React Native client can lift it as-is.

## Self-host walkthrough

### Prerequisites

- Node.js 20 or newer, `npm`, `git`
- A bank account at a PSD2-supported Belgian (or any Berlin Group) bank
- Three free-tier accounts: **Supabase**, **Enable Banking**, **Vercel**
- A GitHub account (for forking + the daily sync workflow)

### 1. Fork and clone

```bash
git clone https://github.com/<your-username>/finny.git
cd finny
npm install
```

### 2. Set up Supabase

1. Create a project at <https://supabase.com/dashboard>. Pick an EU region (`eu-central-1` ≈ same data center as Vercel `fra1`).
2. Apply the SQL migrations in `supabase/migrations/` in numeric filename order. Either:
   - Paste each file into the Supabase SQL editor (Dashboard → SQL Editor → New query)
   - Or `supabase db push` if you wire up the local CLI
   - Or use the Supabase MCP `apply_migration` tool if you have it configured
3. Note these three values from **Project Settings → API**:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` / `publishable` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` secret → `SUPABASE_SERVICE_ROLE_KEY` (server-only, never commit)
4. **Authentication → URL Configuration**: set Site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` (and later your production URL) to Redirect URLs.

### 3. Set up Enable Banking

Enable Banking is the PSD2 aggregator that talks to your bank's APIs.

1. Register at <https://enablebanking.com/> and create an application. Start with a **sandbox** app for local development; later create a separate **production** app once your sandbox flow works end-to-end.
2. Generate an RSA keypair locally:

   ```bash
   mkdir -p keys
   openssl genrsa -out keys/enablebanking_private.pem 2048
   openssl req -new -x509 \
     -key keys/enablebanking_private.pem \
     -out keys/enablebanking_public.crt \
     -days 730 \
     -subj "/CN=finny/O=YourOrg/C=BE"
   ```

3. Upload the **contents of `keys/enablebanking_public.crt`** to your Enable Banking application via their control panel. The private key stays on your machine and (later) in your Vercel env vars — never commit either.
4. In the Enable Banking app config, register your **redirect URL**: `http://localhost:3000/auth/banking/callback` for sandbox; your Vercel URL + `/auth/banking/callback` for production.
5. Note your application's `app_id` (UUID) — this becomes `ENABLE_BANKING_APP_ID`.

`keys/` is in `.gitignore` — keep it that way.

### 4. Generate the two app secrets

Two values you generate yourself (they don't come from any external service):

```bash
# CRON_SECRET — auth token for the daily sync endpoint
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# COLUMN_ENCRYPTION_KEY — AES-256 key for encrypted DB columns (bank session tokens)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Store both in a password manager. **`COLUMN_ENCRYPTION_KEY` in particular**: if you lose it, your encrypted bank sessions become unrecoverable and users will need to re-link their bank.

### 5. Configure `.env.local`

Copy `.env.example` to `.env.local`, fill in the values from steps 2-4:

```bash
cp .env.example .env.local
```

Required fields (see `.env.example` for full descriptions):

| Variable | Source |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase API settings |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase API settings (server-only) |
| `ENABLE_BANKING_APP_ID` | Enable Banking application UUID |
| `ENABLE_BANKING_ENV` | `sandbox` for local, `production` on Vercel |
| `ENABLE_BANKING_PRIVATE_KEY_PATH` | `keys/enablebanking_private.pem` (local) |
| `ENABLE_BANKING_REDIRECT_URI` | `http://localhost:3000/auth/banking/callback` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` |
| `CRON_SECRET` | From step 4 |
| `COLUMN_ENCRYPTION_KEY` | From step 4 |

### 6. Run locally

```bash
npm run dev
```

Open <http://localhost:3000>, sign in with magic link, and the database trigger will create your household with 14 default expense categories. Go to **Accounts → Connect a bank** to start the PSD2 consent flow.

### 7. Deploy to Vercel

1. Install the CLI: `npm i -g vercel` (or use `npx vercel@latest …`)
2. `vercel link` — connect this repo to a new Vercel project
3. Add every variable from `.env.local` to **Vercel → Project Settings → Environment Variables**. The secrets (marked above) should be set as **Sensitive**.
   - For `ENABLE_BANKING_PRIVATE_KEY`: paste the PEM content inline. Replace newlines with `\n` so it's a single line.
   - For `ENABLE_BANKING_ENV`: use `production` on Vercel.
   - For `ENABLE_BANKING_REDIRECT_URI` and `NEXT_PUBLIC_APP_URL`: use your production URL.
4. Set the region to `fra1` (or your nearest) in `vercel.json` if you're outside North America.
5. `vercel --prod` to deploy. Update Enable Banking app config + Supabase Authentication URLs with the production redirect URL.

### 8. Set up the daily bank sync (GitHub Actions)

The workflow at `.github/workflows/sync-bank.yml` triggers `/api/cron/sync` three times a day. (Vercel Hobby Cron is best-effort; GitHub Actions is more reliable and free.)

1. In **your fork's** GitHub: Settings → Secrets and variables → Actions → **New repository secret**
2. Name: `CRON_SECRET`. Value: the same string you put in Vercel.
3. Trigger a test run: Actions tab → "Sync bank transactions" → **Run workflow**

Scheduled runs land at 09:01 / 12:01 / 17:01 Brussels time year-round (DST is handled by a runtime tz check). If you're elsewhere, edit the cron lines and the hour-filter in the workflow file.

## Project layout

```
src/
  app/
    (app)/                  authenticated routes — layout enforces auth via proxy.ts
      page.tsx              overview (KPIs + balance area chart + recent tx)
      transactions/         filtered table with bulk-categorize
      cashflow/             period-based KPIs, totals, breakdowns, forecast
      accounts/             connections + accounts + Sync + Disconnect
      settings/
        categories/         CRUD + monthly budgets
        rules/              categorization rules with auto-reapply
    api/cron/sync/          daily-sync endpoint (Bearer CRON_SECRET)
    auth/                   Supabase OTP callback + Enable Banking PSD2 callback
    login/                  magic link or email/password
  components/                shadcn primitives + charts + nav + dialogs
  lib/
    banking/                Enable Banking client, JWT signer, sync, normalize,
                            categorize (rule engine), forecast
    cashflow.ts             bucketing + per-cat/per-counterparty aggregates
    recurring.ts            cadence detection from transaction history
    crypto.ts               AES-256-GCM helpers for encrypted DB columns
    supabase/               browser, server, service-role clients + proxy helper
  proxy.ts                  Next.js 16 successor of middleware.ts; auth gate
supabase/migrations/        chronological SQL migrations (run in order)
.github/workflows/          GitHub Actions — daily bank sync
keys/                       gitignored — Enable Banking RSA keypair
```

## Security notes

- Row-level security on every domain table, scoped by `household_id`
- AES-256-GCM column encryption on `bank_connections.requisition_id` (Enable Banking session tokens)
- HTTPS strict, CSP, HSTS, X-Frame-Options, Permissions-Policy via `next.config.ts`
- `CRON_SECRET` Bearer auth on `/api/cron/sync`; cron endpoint excluded from the auth proxy
- Bank consent CSRF protection via state cookie

If you find a security issue, please open a private security advisory on the repo rather than a public issue.

## License

MIT — see [`LICENSE`](LICENSE).
