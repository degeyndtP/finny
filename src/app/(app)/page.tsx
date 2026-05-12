import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { CashflowChart, type CashflowPoint } from "@/components/cashflow-chart";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/format";

const HISTORY_DAYS = 90;

export default async function OverviewPage() {
  const supabase = await createClient();

  const [{ data: accounts }, { data: household }] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, display_name, iban, currency, balance_amount, balance_date")
      .eq("archived", false),
    supabase
      .from("households")
      .select("id, name, base_currency")
      .limit(1)
      .maybeSingle(),
  ]);

  const hasAccounts = (accounts?.length ?? 0) > 0;
  const baseCurrency = household?.base_currency ?? "EUR";

  if (!hasAccounts) {
    return <EmptyState />;
  }

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthFromIso = firstOfMonth.toISOString().slice(0, 10);

  const historyStart = new Date(today.getTime() - HISTORY_DAYS * 24 * 60 * 60 * 1000);
  const historyFromIso = historyStart.toISOString().slice(0, 10);

  const [{ data: monthTx }, { data: historyTx }, { data: recentTx }] =
    await Promise.all([
      supabase
        .from("transactions")
        .select("amount")
        .gte("booking_date", monthFromIso)
        .eq("is_internal_transfer", false),
      supabase
        .from("transactions")
        .select("booking_date, amount, currency, is_internal_transfer")
        .gte("booking_date", historyFromIso)
        .eq("is_internal_transfer", false),
      supabase
        .from("transactions")
        .select("id, booking_date, amount, currency, counterparty_name, description, remittance_info")
        .order("booking_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

  const income = (monthTx ?? [])
    .filter((t) => Number(t.amount) > 0)
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const expenses = (monthTx ?? [])
    .filter((t) => Number(t.amount) < 0)
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const totalBalance = (accounts ?? []).reduce(
    (sum, a) => sum + Number(a.balance_amount ?? 0),
    0,
  );

  const cashflowSeries = buildCashflowSeries(historyTx ?? [], totalBalance, today);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Month-to-date snapshot and a {HISTORY_DAYS}-day balance trend.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Balance" value={formatMoney(totalBalance, baseCurrency)} />
        <Kpi label="Income (MTD)" value={formatMoney(income, baseCurrency)} tone="positive" />
        <Kpi label="Expenses (MTD)" value={formatMoney(expenses, baseCurrency)} tone="negative" />
        <Kpi label="Net (MTD)" value={formatMoney(income + expenses, baseCurrency)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Balance</CardTitle>
          <CardDescription>
            Total balance across all accounts over the last {HISTORY_DAYS} days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cashflowSeries.length > 1 ? (
            <CashflowChart data={cashflowSeries} currency={baseCurrency} />
          ) : (
            <div className="grid h-64 place-items-center text-sm text-muted-foreground">
              Sync transactions to populate this view.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent transactions</CardTitle>
            <CardDescription>Latest 8 across all accounts.</CardDescription>
          </div>
          <Link
            href="/transactions"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            View all →
          </Link>
        </CardHeader>
        <CardContent>
          {recentTx?.length ? (
            <ul className="divide-y">
              {recentTx.map((tx) => {
                const amt = Number(tx.amount);
                return (
                  <li key={tx.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {tx.counterparty_name ?? tx.description ?? tx.remittance_info ?? "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(tx.booking_date)}
                      </div>
                    </div>
                    <div
                      className={`tabular-nums ${
                        amt < 0
                          ? "text-chart-5"
                          : "text-chart-2"
                      }`}
                    >
                      {formatMoney(amt, tx.currency)}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Build a daily balance series ending at `endBalance` today.
 *
 * We walk forward from `today - HISTORY_DAYS` summing daily net cashflows.
 * Day-zero balance is reverse-engineered: today_balance - net_over_window.
 * For days with no transactions we carry the previous balance forward.
 */
function buildCashflowSeries(
  transactions: { booking_date: string; amount: number | string }[],
  endBalance: number,
  today: Date,
): CashflowPoint[] {
  // Bucket per day
  const dailyNet = new Map<string, number>();
  for (const tx of transactions) {
    const d = tx.booking_date;
    dailyNet.set(d, (dailyNet.get(d) ?? 0) + Number(tx.amount));
  }

  const totalNet = Array.from(dailyNet.values()).reduce((s, v) => s + v, 0);
  let runningBalance = endBalance - totalNet;

  const points: CashflowPoint[] = [];
  for (let i = 0; i < HISTORY_DAYS; i++) {
    const d = new Date(today.getTime() - (HISTORY_DAYS - 1 - i) * 24 * 60 * 60 * 1000);
    const iso = d.toISOString().slice(0, 10);
    runningBalance += dailyNet.get(iso) ?? 0;
    points.push({ date: iso, balance: round2(runningBalance) });
  }
  return points;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-chart-2"
      : tone === "negative"
        ? "text-chart-5"
        : "";
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

function EmptyState() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Connect your first bank</CardTitle>
          <CardDescription>
            Finny uses Enable Banking (PSD2) to securely import your transactions.
            Read-only — no payments.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Link href="/accounts" className={buttonVariants()}>
            Connect a bank
          </Link>
          <p className="text-xs text-muted-foreground">
            Consent lasts 90 days; you can revoke access at any time.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
