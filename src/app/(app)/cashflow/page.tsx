import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ForecastChart } from "@/components/forecast-chart";
import { TotalsChart } from "@/components/totals-chart";
import { createClient } from "@/lib/supabase/server";
import {
  bucketTransactions,
  periodTotals,
  pickGranularity,
  totalsByCategory,
  totalsByCounterparty,
  type MinTx,
} from "@/lib/cashflow";
import { projectBalance, type PlannedCashflow, type Recurrence } from "@/lib/forecast";
import { detectRecurring } from "@/lib/recurring";
import { formatDate, formatMoney } from "@/lib/format";
import { AccountSelector, type AccountOption } from "./account-selector";
import { rangeForPreset } from "./period-presets";
import { PeriodSelector } from "./period-selector";
import {
  RecurringSection,
  type PlannedRow,
  type SuggestionRow,
} from "./recurring-section";
import type {
  PlannedDialogAccount,
  PlannedDialogCategory,
} from "./planned-form-dialog";

const DETECTION_WINDOW_DAYS = 180;
const FORECAST_WINDOW_DAYS = 90;

const GRANULARITY_LABEL = {
  day: "daily",
  week: "weekly",
  month: "monthly",
} as const;

interface CategoryLookup {
  id: string;
  name: string;
  kind: "income" | "expense" | "transfer";
  color: string | null;
}

export default async function CashflowPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; account?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: household } = await supabase
    .from("households")
    .select("base_currency")
    .limit(1)
    .maybeSingle();
  const currency = household?.base_currency ?? "EUR";

  // Resolve period — default to MTD when no params.
  const def = rangeForPreset("mtd");
  const from = params.from ?? def.from;
  const to = params.to ?? def.to;
  const accountFilter = params.account?.trim() ?? "";

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const detectionFromIso = new Date(
    today.getTime() - DETECTION_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .slice(0, 10);
  const forecastToIso = new Date(
    today.getTime() + FORECAST_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .slice(0, 10);

  const periodTxQuery = supabase
    .from("transactions")
    .select(
      "booking_date, amount, counterparty_name, counterparty_iban, category_id, is_internal_transfer",
    )
    .gte("booking_date", from)
    .lte("booking_date", to);
  if (accountFilter) periodTxQuery.eq("account_id", accountFilter);

  const detectionTxQuery = supabase
    .from("transactions")
    .select(
      "booking_date, amount, counterparty_name, counterparty_iban, category_id, is_internal_transfer",
    )
    .gte("booking_date", detectionFromIso)
    .lte("booking_date", todayIso);
  if (accountFilter) detectionTxQuery.eq("account_id", accountFilter);

  const accountsBalanceQuery = supabase
    .from("accounts")
    .select("id, display_name, iban, balance_amount")
    .eq("archived", false);
  if (accountFilter) accountsBalanceQuery.eq("id", accountFilter);

  const [
    { data: txRaw },
    { data: catsRaw },
    { data: detectionTxRaw },
    { data: accountsRaw },
    { data: allAccountsRaw },
    { data: plannedRaw },
  ] = await Promise.all([
    periodTxQuery,
    supabase
      .from("categories")
      .select("id, name, kind, color")
      .order("kind")
      .order("sort_order")
      .order("name"),
    detectionTxQuery,
    accountsBalanceQuery,
    // Always need the FULL list of accounts for the selector, regardless of filter.
    supabase
      .from("accounts")
      .select("id, display_name, iban")
      .eq("archived", false)
      .order("display_name"),
    supabase
      .from("planned_cashflows")
      .select(
        "id, description, amount, due_date, recurrence, recurrence_until, category_id, account_id",
      )
      .order("due_date", { ascending: true }),
  ]);

  const transactions: MinTx[] = (txRaw ?? []).map((t) => ({
    booking_date: t.booking_date,
    amount: Number(t.amount),
    counterparty_name: t.counterparty_name,
    counterparty_iban: t.counterparty_iban,
    category_id: t.category_id,
    is_internal_transfer: t.is_internal_transfer,
  }));
  const categories = (catsRaw ?? []) as CategoryLookup[];
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const totals = periodTotals(transactions);
  const granularity = pickGranularity(from, to);
  const { buckets } = bucketTransactions(transactions, {
    fromIso: from,
    toIso: to,
    granularity,
  });

  // Category breakdown — split into expense/income lists.
  type BreakdownRow = {
    /** category id, or "uncategorised" sentinel — used for /transactions filter link */
    filterValue: string;
    name: string;
    color: string;
    amount: number;
    pct: number;
  };
  const catSums = totalsByCategory(transactions);
  const expenseRows: BreakdownRow[] = [];
  const incomeRows: BreakdownRow[] = [];
  for (const sum of catSums) {
    const cat = sum.category_id ? categoryById.get(sum.category_id) : null;
    const name = cat?.name ?? "Uncategorised";
    const color = cat?.color ?? "#6B7280";
    const filterValue = sum.category_id ?? "uncategorised";
    if (sum.total < 0) {
      expenseRows.push({ filterValue, name, color, amount: -sum.total, pct: 0 });
    } else if (sum.total > 0) {
      incomeRows.push({ filterValue, name, color, amount: sum.total, pct: 0 });
    }
  }
  expenseRows.sort((a, b) => b.amount - a.amount);
  incomeRows.sort((a, b) => b.amount - a.amount);
  const maxExpense = expenseRows[0]?.amount ?? 1;
  const maxIncome = incomeRows[0]?.amount ?? 1;
  for (const r of expenseRows) r.pct = (r.amount / maxExpense) * 100;
  for (const r of incomeRows) r.pct = (r.amount / maxIncome) * 100;

  // Top counterparties — max 15 by absolute value.
  const counterparties = totalsByCounterparty(transactions).slice(0, 15);

  // ---------- Recurring detection + forecast (independent of period) -------
  const detectionTxs: MinTx[] = (detectionTxRaw ?? []).map((t) => ({
    booking_date: t.booking_date,
    amount: Number(t.amount),
    counterparty_name: t.counterparty_name,
    counterparty_iban: t.counterparty_iban,
    category_id: t.category_id,
    is_internal_transfer: t.is_internal_transfer,
  }));

  const planned: PlannedRow[] = (plannedRaw ?? []).map((p) => ({
    id: p.id,
    description: p.description,
    amount: Number(p.amount),
    due_date: p.due_date,
    recurrence: p.recurrence as PlannedRow["recurrence"],
    recurrence_until: p.recurrence_until,
    category_id: p.category_id,
    account_id: p.account_id,
  }));

  // Skip suggestions for descriptions that are already planned (case-insensitive).
  const plannedKeys = new Set(
    planned.map((p) => p.description.trim().toLowerCase()),
  );
  const detected = detectRecurring(detectionTxs, { excludeKeys: plannedKeys });
  const suggestions: SuggestionRow[] = detected.map((d) => ({
    key: d.key,
    display: d.display,
    cadence: d.cadence,
    averageAmount: Math.round(d.averageAmount * 100) / 100,
    occurrences: d.occurrences,
    lastDate: d.lastDate,
    nextPredicted: d.nextPredicted,
    category_id: d.category_id,
  }));

  const startingBalance = (accountsRaw ?? []).reduce(
    (s, a) => s + Number(a.balance_amount ?? 0),
    0,
  );

  // Project the balance forward using ONLY recurring planned cashflows so the
  // chart represents "what will happen if nothing else changes".
  const forecastPlans: PlannedCashflow[] = planned.map((p) => ({
    id: p.id,
    description: p.description,
    amount: p.amount,
    due_date: p.due_date,
    recurrence: p.recurrence as Recurrence,
    recurrence_until: p.recurrence_until,
  }));
  const { points: forecastPoints, occurrences: forecastOccurrences } =
    projectBalance({
      startingBalance,
      plans: forecastPlans,
      fromIso: todayIso,
      toIso: forecastToIso,
    });

  const projectedNet = forecastOccurrences.reduce(
    (s, o) => s + o.amount,
    0,
  );
  const projectedEnd = startingBalance + projectedNet;

  const periodLabel = `${formatDate(from)} → ${formatDate(to)}`;

  // Account selector: full list of accounts with friendly labels.
  const accountOptions: AccountOption[] = (allAccountsRaw ?? []).map((a) => ({
    id: a.id,
    label: a.display_name ?? a.iban ?? "Account",
  }));
  // Categories for the planned-form dialog (with kind narrowed).
  const dialogCategories = (catsRaw ?? []) as PlannedDialogCategory[];
  const dialogAccounts: PlannedDialogAccount[] = (allAccountsRaw ?? []).map((a) => ({
    id: a.id,
    display_name: a.display_name,
    iban: a.iban,
  }));

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Cashflow</h1>
            <p className="text-sm text-muted-foreground">
              Income, expenses and net for {periodLabel} · {GRANULARITY_LABEL[granularity]} buckets
            </p>
          </div>
          <AccountSelector current={accountFilter} accounts={accountOptions} />
        </div>
        <PeriodSelector from={from} to={to} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi
          label="Income"
          value={formatMoney(totals.income, currency)}
          tone="positive"
        />
        <Kpi
          label="Expenses"
          value={formatMoney(totals.expense, currency)}
          tone="negative"
        />
        <Kpi
          label="Net"
          value={formatMoney(totals.net, currency)}
          tone={totals.net >= 0 ? "positive" : "negative"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Income vs Expenses</CardTitle>
          <CardDescription>
            {GRANULARITY_LABEL[granularity].charAt(0).toUpperCase() +
              GRANULARITY_LABEL[granularity].slice(1)}{" "}
            buckets across the selected period.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length > 0 ? (
            <TotalsChart data={buckets} currency={currency} />
          ) : (
            <div className="grid h-64 place-items-center text-sm text-muted-foreground">
              No transactions in this range.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryBreakdownCard
          title="Expenses by category"
          rows={expenseRows}
          currency={currency}
          tone="negative"
          empty="No expenses in this range."
        />
        <CategoryBreakdownCard
          title="Income by category"
          rows={incomeRows}
          currency={currency}
          tone="positive"
          empty="No income in this range."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top counterparties</CardTitle>
          <CardDescription>
            Up to 15 by total absolute value. Tag rules can clean these up:
            <code className="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs">
              Settings → Rules
            </code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {counterparties.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions in this range.</p>
          ) : (
            <ul className="divide-y">
              {counterparties.map((c) => {
                const isOut = c.total < 0;
                return (
                  <li key={c.key}>
                    <Link
                      href={`/transactions?counterparty=${encodeURIComponent(c.key)}`}
                      className="-mx-2 flex items-center justify-between gap-4 rounded-md px-2 py-3 text-sm transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{c.key}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.count} transaction{c.count === 1 ? "" : "s"}
                        </div>
                      </div>
                      <div
                        className={`tabular-nums shrink-0 ${
                          isOut
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {formatMoney(Math.abs(c.total), currency)}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="space-y-1 pt-4">
        <h2 className="text-xl font-semibold tracking-tight">Looking ahead</h2>
        <p className="text-sm text-muted-foreground">
          Detected recurring patterns from the last {DETECTION_WINDOW_DAYS} days
          and a {FORECAST_WINDOW_DAYS}-day projection of your balance.
        </p>
      </div>

      <RecurringSection
        suggestions={suggestions}
        planned={planned}
        currency={currency}
        categories={dialogCategories}
        accounts={dialogAccounts}
      />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1.5">
            <CardTitle>Forecast</CardTitle>
            <CardDescription>
              Projection assumes only your planned cashflows fire. Today&apos;s
              balance: {formatMoney(startingBalance, currency)} · in{" "}
              {FORECAST_WINDOW_DAYS} days: {formatMoney(projectedEnd, currency)}{" "}
              ({formatMoney(projectedNet, currency)} net).
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {planned.length === 0 ? (
            <div className="grid h-64 place-items-center text-sm text-muted-foreground text-center px-6">
              No planned cashflows yet. Accept a suggestion above (or none was
              detected) — the forecast becomes useful from the first plan.
            </div>
          ) : (
            <ForecastChart
              data={forecastPoints}
              today={todayIso}
              currency={currency}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "positive" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-rose-600 dark:text-rose-400";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function CategoryBreakdownCard({
  title,
  rows,
  currency,
  tone,
  empty,
}: {
  title: string;
  rows: { filterValue: string; name: string; color: string; amount: number; pct: number }[];
  currency: string;
  tone: "positive" | "negative";
  empty: string;
}) {
  const valueClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-rose-600 dark:text-rose-400";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="space-y-1">
            {rows.map((r) => (
              <li key={r.filterValue}>
                <Link
                  href={`/transactions?category=${encodeURIComponent(r.filterValue)}`}
                  className="-mx-2 block space-y-1 rounded-md px-2 py-2 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: r.color }}
                      />
                      <span className="truncate">{r.name}</span>
                    </div>
                    <span className={`tabular-nums shrink-0 ${valueClass}`}>
                      {formatMoney(r.amount, currency)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width: `${Math.max(2, r.pct)}%`,
                        backgroundColor: r.color,
                      }}
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
