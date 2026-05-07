import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";

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

  // Aggregate the current month's income/expense from transactions.
  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  const fromDate = firstOfMonth.toISOString().slice(0, 10);

  const { data: monthTx } = await supabase
    .from("transactions")
    .select("amount")
    .gte("booking_date", fromDate)
    .eq("is_internal_transfer", false);

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Month-to-date snapshot of your money.
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
          <CardTitle>Cashflow</CardTitle>
          <CardDescription>Daily net flow — chart coming soon.</CardDescription>
        </CardHeader>
        <CardContent className="h-64 grid place-items-center text-sm text-muted-foreground">
          Connect a bank and sync transactions to populate this view.
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
  tone?: "positive" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-rose-600 dark:text-rose-400"
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
            Finny uses GoCardless Bank Account Data (PSD2) to securely import
            your transactions. Read-only — no payments.
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
