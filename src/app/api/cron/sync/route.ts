import { headers } from "next/headers";

import { syncBankConnection } from "@/lib/banking/sync";
import { createServiceClient } from "@/lib/supabase/server";

// Vercel Hobby caps function duration; we may have multiple bank connections
// and each does paged Enable Banking calls. Give it the full budget.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Vercel Cron — runs daily at 07:05 UTC (≈ 09:05 Brussels in summer,
 * ≈ 08:05 Brussels in winter; configure in vercel.json).
 *
 * Iterates every linked bank connection across all households and
 * triggers an incremental sync per connection. Service-role client
 * because RLS policies on sync_runs are read-only for members.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when
 * the env var is set.
 */
export async function GET() {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return Response.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 },
    );
  }

  const auth = (await headers()).get("authorization");
  if (auth !== `Bearer ${expected}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: connections, error: connErr } = await supabase
    .from("bank_connections")
    .select("id, household_id, provider, institution_name, status")
    .eq("status", "linked");

  if (connErr) {
    return Response.json({ error: connErr.message }, { status: 500 });
  }

  const results: Array<{
    id: string;
    institution: string;
    household_id: string;
    added?: number;
    errors?: string[];
    error?: string;
    duration_ms?: number;
  }> = [];

  for (const conn of connections ?? []) {
    if (conn.provider !== "enablebanking") continue;
    const start = Date.now();
    try {
      const r = await syncBankConnection(supabase, conn.id);
      results.push({
        id: conn.id,
        institution: conn.institution_name,
        household_id: conn.household_id,
        added: r.added,
        errors: r.errors.length ? r.errors : undefined,
        duration_ms: Date.now() - start,
      });
    } catch (e) {
      results.push({
        id: conn.id,
        institution: conn.institution_name,
        household_id: conn.household_id,
        error: e instanceof Error ? e.message : String(e),
        duration_ms: Date.now() - start,
      });
    }
  }

  const totalAdded = results.reduce((s, r) => s + (r.added ?? 0), 0);
  const failed = results.filter((r) => r.error).length;

  console.log(
    `[cron/sync] connections=${results.length} added=${totalAdded} failed=${failed}`,
  );

  return Response.json({
    ok: true,
    connections: results.length,
    added: totalAdded,
    failed,
    results,
  });
}
