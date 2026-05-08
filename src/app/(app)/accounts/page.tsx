import Link from "next/link";

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
