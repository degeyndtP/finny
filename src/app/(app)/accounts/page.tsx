import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/format";
import { DisconnectButton } from "./disconnect-button";
import { SyncButton } from "./sync-button";

const CONSENT_WARN_DAYS = 14;

// Vercel Hobby max — gives the server action enough room for an initial
// 90-day sync of a multi-account connection.
export const maxDuration = 60;

export default async function AccountsPage() {
  const supabase = await createClient();

  const [{ data: connections }, { data: accounts }] = await Promise.all([
    supabase
      .from("bank_connections")
      .select("id, institution_name, institution_logo, status, expires_at, last_error, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("accounts")
      .select(
        "id, display_name, iban, currency, balance_amount, balance_date, last_synced_at, bank_connection_id, archived",
      )
      .eq("archived", false),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Manage bank connections and the accounts they grant access to.
          </p>
        </div>
        <Link href="/accounts/connect" className={buttonVariants()}>
          Connect a bank
        </Link>
      </div>

      {(connections?.length ?? 0) === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No bank connected yet</CardTitle>
            <CardDescription>
              Use Enable Banking to securely link a Belgian or EU bank.
              Read-only PSD2 access — no payments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/accounts/connect" className={buttonVariants()}>
              Connect a bank
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {connections!.map((conn) => {
            const connAccounts =
              accounts?.filter((a) => a.bank_connection_id === conn.id) ?? [];
            const consent = consentStatus(conn.expires_at);
            return (
              <Card key={conn.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <CardTitle>{conn.institution_name}</CardTitle>
                      <Badge variant={conn.status === "linked" ? "default" : "secondary"}>
                        {conn.status}
                      </Badge>
                    </div>
                    <CardDescription>
                      {conn.expires_at
                        ? `Consent expires ${formatDate(conn.expires_at)}`
                        : "Awaiting consent"}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <SyncButton
                      connectionId={conn.id}
                      institutionName={conn.institution_name}
                    />
                    <DisconnectButton
                      connectionId={conn.id}
                      institutionName={conn.institution_name}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {consent.severity !== "ok" ? (
                    <ConsentReminder
                      severity={consent.severity}
                      daysLeft={consent.daysLeft}
                    />
                  ) : null}
                  {conn.last_error ? (
                    <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive break-words">
                      Last sync error: {conn.last_error}
                    </div>
                  ) : null}
                  {connAccounts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No accounts under this connection yet.
                    </p>
                  ) : (
                    <ul className="divide-y">
                      {connAccounts.map((acc) => (
                        <li
                          key={acc.id}
                          className="flex items-center justify-between py-3 text-sm"
                        >
                          <div>
                            <div className="font-medium">
                              {acc.display_name ?? acc.iban ?? "Unnamed account"}
                            </div>
                            <div className="text-muted-foreground">
                              {acc.iban ?? "—"}
                              {acc.last_synced_at
                                ? ` · synced ${formatDate(acc.last_synced_at)}`
                                : ""}
                            </div>
                          </div>
                          <div className="tabular-nums">
                            {acc.balance_amount != null
                              ? formatMoney(Number(acc.balance_amount), acc.currency)
                              : "—"}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ConsentStatus {
  severity: "ok" | "warn" | "expired";
  daysLeft: number;
}

function consentStatus(expiresAt: string | null): ConsentStatus {
  if (!expiresAt) return { severity: "ok", daysLeft: Number.POSITIVE_INFINITY };
  const ms = new Date(expiresAt).getTime() - Date.now();
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  if (days <= 0) return { severity: "expired", daysLeft: days };
  if (days <= CONSENT_WARN_DAYS) return { severity: "warn", daysLeft: days };
  return { severity: "ok", daysLeft: days };
}

function ConsentReminder({
  severity,
  daysLeft,
}: {
  severity: "warn" | "expired";
  daysLeft: number;
}) {
  const expired = severity === "expired";
  const className = expired
    ? "border-destructive/40 bg-destructive/5 text-destructive"
    : "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400";
  const message = expired
    ? `Consent has expired${daysLeft < 0 ? ` ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"} ago` : ""}. Reconnect to resume syncing.`
    : `Consent expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Re-link to keep syncs flowing.`;
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs ${className}`}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 shrink-0" />
        <span>{message}</span>
      </div>
      <Link
        href="/accounts/connect"
        className={buttonVariants({
          variant: expired ? "destructive" : "outline",
          size: "xs",
        })}
      >
        Re-link
      </Link>
    </div>
  );
}
