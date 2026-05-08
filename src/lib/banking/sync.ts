import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import { enableBanking, EnableBankingError } from "./enablebanking";
import { normalizeTransaction } from "./normalize";
import type { Database } from "@/lib/supabase/database.types";

export interface SyncOutcome {
  added: number;
  errors: string[];
  /** True when at least one account synced successfully. */
  partialSuccess: boolean;
}

const PSD2_HISTORY_DAYS = 90;
const REFRESH_OVERLAP_DAYS = 7;

/**
 * Pull fresh transactions and balances for every account under a connection.
 * Idempotent — uses an upsert keyed on (account_id, external_id).
 */
export async function syncBankConnection(
  supabase: SupabaseClient<Database>,
  connectionId: string,
): Promise<SyncOutcome> {
  const { data: conn, error: connErr } = await supabase
    .from("bank_connections")
    .select("id, household_id, provider, requisition_id, status")
    .eq("id", connectionId)
    .maybeSingle();

  if (connErr) throw new Error(`load bank_connection: ${connErr.message}`);
  if (!conn) throw new Error("bank_connection not found");
  if (conn.provider !== "enablebanking") {
    throw new Error(`unsupported provider: ${conn.provider}`);
  }

  const { data: run, error: runErr } = await supabase
    .from("sync_runs")
    .insert({
      household_id: conn.household_id,
      bank_connection_id: conn.id,
      status: "running",
    })
    .select("id")
    .single();
  if (runErr || !run) throw new Error(`open sync_runs: ${runErr?.message ?? "no row"}`);

  const { data: accounts, error: accErr } = await supabase
    .from("accounts")
    .select("id, household_id, external_account_id, currency, last_synced_at")
    .eq("bank_connection_id", connectionId)
    .eq("archived", false);
  if (accErr) throw new Error(`load accounts: ${accErr.message}`);

  let totalAdded = 0;
  const errors: string[] = [];
  const successes: string[] = [];

  for (const acc of accounts ?? []) {
    try {
      const added = await syncOneAccount(supabase, acc, conn.household_id);
      totalAdded += added;
      successes.push(acc.external_account_id);
    } catch (e) {
      const detail =
        e instanceof EnableBankingError
          ? `${e.status} ${typeof e.body === "string" ? e.body : JSON.stringify(e.body)}`
          : (e as Error).message;
      errors.push(`${acc.external_account_id}: ${detail}`);
    }
  }

  const finalStatus =
    successes.length > 0 ? "success" : errors.length > 0 ? "error" : "success";

  await supabase
    .from("sync_runs")
    .update({
      status: finalStatus,
      transactions_added: totalAdded,
      error_message: errors.length ? errors.join("\n") : null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", run.id);

  // Reflect a non-fatal error on the connection so the UI can show it,
  // but only mark expired/error if EVERY account failed.
  if (successes.length === 0 && errors.length > 0) {
    await supabase
      .from("bank_connections")
      .update({
        last_error: errors.join("\n").slice(0, 1000),
      })
      .eq("id", conn.id);
  } else if (errors.length === 0) {
    await supabase
      .from("bank_connections")
      .update({ last_error: null })
      .eq("id", conn.id);
  }

  return {
    added: totalAdded,
    errors,
    partialSuccess: successes.length > 0,
  };
}

async function syncOneAccount(
  supabase: SupabaseClient<Database>,
  acc: {
    id: string;
    household_id: string;
    external_account_id: string;
    last_synced_at: string | null;
  },
  householdId: string,
): Promise<number> {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);

  // First sync: pull the full PSD2 window (90 days). Incremental syncs:
  // re-fetch a 7-day overlap to catch late-booked items.
  const lookbackDays = acc.last_synced_at ? REFRESH_OVERLAP_DAYS : PSD2_HISTORY_DAYS;
  const fromDate = new Date(today.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const dateFrom = fromDate.toISOString().slice(0, 10);

  let added = 0;
  let continuationKey: string | undefined;

  do {
    const res = await enableBanking.getAccountTransactions(acc.external_account_id, {
      date_from: dateFrom,
      date_to: todayIso,
      continuation_key: continuationKey,
      transaction_status: "booked",
    });

    if (res.transactions?.length) {
      const rows = res.transactions.map((tx) =>
        normalizeTransaction(tx, { household_id: householdId, account_id: acc.id }),
      );

      const { error: insErr } = await supabase
        .from("transactions")
        .upsert(rows, {
          onConflict: "account_id,external_id",
          ignoreDuplicates: true,
        });
      if (insErr) throw new Error(`upsert transactions: ${insErr.message}`);

      added += rows.length;
    }

    continuationKey = res.continuation_key;
  } while (continuationKey);

  // Pull the latest balance and stamp last_synced_at.
  const accountUpdate: Database["public"]["Tables"]["accounts"]["Update"] = {
    last_synced_at: new Date().toISOString(),
  };
  try {
    const balResp = await enableBanking.getAccountBalances(acc.external_account_id);
    const preferred: Array<typeof balResp.balances[number]["balance_type"]> = [
      "CLAV",
      "CLBD",
      "ITAV",
    ];
    const chosen = preferred
      .map((kind) => balResp.balances.find((b) => b.balance_type === kind))
      .find(Boolean);
    if (chosen) {
      accountUpdate.balance_amount = Number(chosen.balance_amount.amount);
      accountUpdate.balance_date = chosen.reference_date ?? todayIso;
    }
  } catch (e) {
    // Don't let balance failures abort the sync — the transactions are the
    // valuable part. Surface in logs only.
    console.warn(
      `[sync] balance fetch failed for ${acc.external_account_id}:`,
      e instanceof Error ? e.message : e,
    );
  }

  await supabase.from("accounts").update(accountUpdate).eq("id", acc.id);

  return added;
}
