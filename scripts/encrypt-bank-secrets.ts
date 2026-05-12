/**
 * One-shot backfill: encrypt any legacy plaintext `requisition_id` rows in
 * `bank_connections` with the v1 envelope from `src/lib/crypto.ts`.
 *
 * Idempotent — rows already in the `enc:v1:` envelope are skipped.
 *
 * Usage (locally, against production):
 *   1. Ensure these env vars are set in your shell (NOT just .env.local —
 *      tsx doesn't auto-load it). The simplest is:
 *        set -a && source .env.local && set +a
 *   2. Required: SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL,
 *      COLUMN_ENCRYPTION_KEY.
 *   3. Run:  npx tsx scripts/encrypt-bank-secrets.ts
 *
 * Run it locally with the SAME COLUMN_ENCRYPTION_KEY you set on Vercel,
 * otherwise the live app can't decrypt the rows you just wrote.
 */
import { createClient } from "@supabase/supabase-js";

import { encryptSecret, isEncrypted } from "../src/lib/crypto";
import type { Database } from "../src/lib/supabase/database.types";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running.",
    );
  }
  if (!process.env.COLUMN_ENCRYPTION_KEY) {
    throw new Error("Set COLUMN_ENCRYPTION_KEY (same value as on Vercel).");
  }

  const supabase = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("bank_connections")
    .select("id, requisition_id");

  if (error) throw error;
  if (!data?.length) {
    console.log("No bank_connections rows. Nothing to do.");
    return;
  }

  let encrypted = 0;
  let alreadyEncrypted = 0;
  let empty = 0;

  for (const row of data) {
    if (!row.requisition_id) {
      empty++;
      continue;
    }
    if (isEncrypted(row.requisition_id)) {
      alreadyEncrypted++;
      continue;
    }
    const ciphertext = encryptSecret(row.requisition_id);
    const { error: upErr } = await supabase
      .from("bank_connections")
      .update({ requisition_id: ciphertext })
      .eq("id", row.id);
    if (upErr) {
      console.error(`row ${row.id}: ${upErr.message}`);
      continue;
    }
    encrypted++;
    console.log(`row ${row.id}: encrypted`);
  }

  console.log(
    `Done. encrypted=${encrypted}  already_encrypted=${alreadyEncrypted}  empty=${empty}  total=${data.length}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
