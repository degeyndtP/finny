"use server";

import { revalidatePath } from "next/cache";

import { enableBanking, EnableBankingError } from "@/lib/banking";
import { syncBankConnection } from "@/lib/banking/sync";
import { decryptSecret } from "@/lib/crypto";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * Hard-delete a bank_connection. FK cascades remove its accounts,
 * transactions and sync_runs in one go.
 *
 * Best-effort revoke at Enable Banking too, but if that fails (sandbox
 * session, expired session, signed by a different app, …) we still
 * delete the local row so the user gets the UI cleanup they asked for.
 */
export async function disconnectBank(
  connectionId: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // RLS already restricts to the user's household, but fetching first lets
  // us pull the requisition_id we need to revoke at Enable Banking.
  const { data: conn, error: fetchErr } = await supabase
    .from("bank_connections")
    .select("id, provider, requisition_id, institution_name")
    .eq("id", connectionId)
    .maybeSingle();

  if (fetchErr) return { error: fetchErr.message };
  if (!conn) return { error: "Bank connection not found" };

  // Best-effort revoke at the provider.
  if (conn.provider === "enablebanking" && conn.requisition_id) {
    const sessionId = decryptSecret(conn.requisition_id);
    if (sessionId) {
      try {
        await enableBanking.deleteSession(sessionId);
      } catch (e) {
        const detail =
          e instanceof EnableBankingError
            ? `${e.status} ${typeof e.body === "string" ? e.body : JSON.stringify(e.body)}`
            : (e as Error).message;
        console.warn(
          `[disconnectBank] could not revoke Enable Banking session for connection ${conn.id}: ${detail}`,
        );
        // continue — local cleanup is what the user asked for
      }
    }
  }

  const { error: delErr } = await supabase
    .from("bank_connections")
    .delete()
    .eq("id", connectionId);

  if (delErr) return { error: delErr.message };

  revalidatePath("/accounts");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Pull the latest transactions and balance for one bank connection.
 *
 * Auth-checks the user via RLS, then runs the actual sync with the
 * service-role client because writing to `sync_runs` and bulk-upserting
 * transactions plays nicer without the per-statement RLS overhead.
 */
export async function syncBank(
  connectionId: string,
): Promise<{ added: number; warnings: string[] } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Ownership check via RLS — if the row is invisible the user is not allowed.
  const { data: conn, error: ownErr } = await supabase
    .from("bank_connections")
    .select("id, household_id")
    .eq("id", connectionId)
    .maybeSingle();
  if (ownErr) return { error: ownErr.message };
  if (!conn) return { error: "Bank connection not found" };

  const service = createServiceClient();

  try {
    const result = await syncBankConnection(service, connectionId);
    revalidatePath("/accounts");
    revalidatePath("/transactions");
    revalidatePath("/");
    if (result.errors.length && !result.partialSuccess) {
      return { error: result.errors.join("; ") };
    }
    return { added: result.added, warnings: result.errors };
  } catch (e) {
    const detail =
      e instanceof EnableBankingError
        ? `${e.status} ${typeof e.body === "string" ? e.body : JSON.stringify(e.body)}`
        : (e as Error).message;
    return { error: detail };
  }
}
