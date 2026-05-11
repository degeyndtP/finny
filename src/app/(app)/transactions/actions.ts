"use server";

import { revalidatePath } from "next/cache";

import { applyRulesToUncategorised } from "@/lib/banking/categorize";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function setTransactionCategory(
  transactionId: string,
  categoryId: string | null,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // RLS restricts to the user's household; categoryId (if provided) must
  // belong to the same household — Postgres FK enforces existence, RLS
  // prevents reading a category outside the household so this is fine.
  const { error } = await supabase
    .from("transactions")
    .update({ category_id: categoryId })
    .eq("id", transactionId);

  if (error) return { error: error.message };

  revalidatePath("/transactions");
  revalidatePath("/cashflow");
  revalidatePath("/");
  return { ok: true };
}

const NONE_SENTINEL = "__none__";

/**
 * Update many transactions in one go. Optionally creates one
 * categorization_rule per unique counterparty in the selection so
 * future imports get the same tag automatically.
 */
export async function bulkSetCategory(
  transactionIds: string[],
  categoryId: string | null,
  createRules: boolean,
): Promise<
  | { ok: true; updated: number; rulesCreated: number; alsoApplied: number }
  | { error: string }
> {
  if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
    return { error: "No transactions selected" };
  }
  if (transactionIds.length > 1000) {
    return { error: "Too many transactions in one batch (>1000)" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!membership) return { error: "No household for user" };
  const household_id = membership.household_id;

  // Resolve "no category" sentinel to null. RLS makes sure ids that don't
  // belong to the user's household are silently filtered out.
  const targetCategoryId = categoryId === NONE_SENTINEL ? null : categoryId;

  const { data: updated, error: updErr } = await supabase
    .from("transactions")
    .update({ category_id: targetCategoryId })
    .in("id", transactionIds)
    .select("id, counterparty_name");

  if (updErr) return { error: updErr.message };

  let rulesCreated = 0;

  if (createRules && targetCategoryId && updated?.length) {
    // Distinct, non-empty counterparties from the selection.
    const counterparties = Array.from(
      new Set(
        updated
          .map((t) => t.counterparty_name?.trim())
          .filter((n): n is string => !!n && n.length > 0),
      ),
    );

    if (counterparties.length > 0) {
      // Pull existing rules so we don't duplicate counterparty matches.
      const { data: existing } = await supabase
        .from("categorization_rules")
        .select("match_value, match_field, match_type")
        .eq("household_id", household_id)
        .eq("match_field", "counterparty_name")
        .eq("match_type", "contains");

      const existingValues = new Set(
        (existing ?? []).map((r) => r.match_value.trim().toLowerCase()),
      );

      const newRules = counterparties
        .filter((c) => !existingValues.has(c.toLowerCase()))
        .map((c) => ({
          household_id,
          category_id: targetCategoryId,
          match_field: "counterparty_name" as const,
          match_type: "contains" as const,
          match_value: c,
          is_case_sensitive: false,
          priority: 0,
        }));

      if (newRules.length > 0) {
        const { error: ruleErr, count } = await supabase
          .from("categorization_rules")
          .insert(newRules, { count: "exact" });
        if (ruleErr) {
          // Categorisation worked; surface the rule-creation error softly.
          return { error: `Categorisation done, rule creation failed: ${ruleErr.message}` };
        }
        rulesCreated = count ?? newRules.length;
      }
    }
  }

  // When we created at least one new rule, retroactively apply rules to
  // anything that's still uncategorised — historical occurrences of the
  // same counterparty that weren't part of this selection get tagged too.
  let alsoApplied = 0;
  if (rulesCreated > 0) {
    try {
      const service = createServiceClient();
      alsoApplied = await applyRulesToUncategorised(service, { household_id });
    } catch (e) {
      console.warn(
        "[bulkSetCategory] auto-reapply failed:",
        e instanceof Error ? e.message : e,
      );
    }
  }

  revalidatePath("/transactions");
  revalidatePath("/cashflow");
  revalidatePath("/settings/rules");
  revalidatePath("/");

  return {
    ok: true,
    updated: updated?.length ?? 0,
    rulesCreated,
    alsoApplied,
  };
}
