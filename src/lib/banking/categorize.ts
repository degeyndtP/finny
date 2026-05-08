import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

// Narrowed unions matching the DB's CHECK constraints.
export type MatchField =
  | "counterparty_name"
  | "counterparty_iban"
  | "description"
  | "remittance_info";
export type MatchType = "contains" | "equals" | "regex";

export interface RuleRow {
  id: string;
  category_id: string;
  match_field: MatchField;
  match_type: MatchType;
  match_value: string;
  is_case_sensitive: boolean;
  priority: number;
}

export interface CategorizableTransaction {
  counterparty_name: string | null;
  counterparty_iban: string | null;
  description: string | null;
  remittance_info: string | null;
}

/**
 * Given a transaction-like object and a list of rules sorted by priority desc,
 * return the first matching category id (or null).
 */
export function findMatchingCategoryId(
  tx: CategorizableTransaction,
  rules: RuleRow[],
): string | null {
  for (const rule of rules) {
    const haystack = tx[rule.match_field];
    if (!haystack) continue;
    if (matches(haystack, rule)) return rule.category_id;
  }
  return null;
}

function matches(haystack: string, rule: RuleRow): boolean {
  const ci = !rule.is_case_sensitive;
  const a = ci ? haystack.toLowerCase() : haystack;
  const b = ci ? rule.match_value.toLowerCase() : rule.match_value;

  switch (rule.match_type) {
    case "contains":
      return a.includes(b);
    case "equals":
      return a === b;
    case "regex":
      try {
        const re = new RegExp(rule.match_value, rule.is_case_sensitive ? "" : "i");
        return re.test(haystack);
      } catch {
        return false;
      }
  }
}

/**
 * Apply rules to all uncategorised transactions in a household.
 *
 * Loads rules once, walks transactions in batches, computes target category
 * per row in JS, and issues per-category UPDATE statements (so we touch the
 * minimum number of rows that should change).
 *
 * Returns the number of newly-categorised transactions.
 */
export async function applyRulesToUncategorised(
  supabase: SupabaseClient<Database>,
  opts: { household_id: string; only_account_ids?: string[] },
): Promise<number> {
  const { data: rulesRaw, error: rulesErr } = await supabase
    .from("categorization_rules")
    .select("id, category_id, match_field, match_type, match_value, is_case_sensitive, priority")
    .eq("household_id", opts.household_id)
    .order("priority", { ascending: false });
  if (rulesErr) throw new Error(`load rules: ${rulesErr.message}`);
  if (!rulesRaw?.length) return 0;
  // DB CHECK constraints guarantee match_field/match_type are valid enum values.
  const rules = rulesRaw as RuleRow[];

  let query = supabase
    .from("transactions")
    .select("id, counterparty_name, counterparty_iban, description, remittance_info")
    .eq("household_id", opts.household_id)
    .is("category_id", null);
  if (opts.only_account_ids?.length) {
    query = query.in("account_id", opts.only_account_ids);
  }
  const { data: txs, error: txErr } = await query;
  if (txErr) throw new Error(`load transactions: ${txErr.message}`);
  if (!txs?.length) return 0;

  // Group transaction ids by category
  const byCategory = new Map<string, string[]>();
  for (const tx of txs) {
    const cat = findMatchingCategoryId(tx, rules);
    if (!cat) continue;
    const arr = byCategory.get(cat) ?? [];
    arr.push(tx.id);
    byCategory.set(cat, arr);
  }

  let updated = 0;
  for (const [categoryId, ids] of byCategory) {
    // Chunk to keep IN() lists reasonable
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      const { error: updErr, count } = await supabase
        .from("transactions")
        .update({ category_id: categoryId }, { count: "exact" })
        .in("id", chunk);
      if (updErr) throw new Error(`update transactions: ${updErr.message}`);
      updated += count ?? chunk.length;
    }
  }

  return updated;
}
