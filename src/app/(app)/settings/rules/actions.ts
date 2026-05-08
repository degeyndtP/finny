"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { applyRulesToUncategorised } from "@/lib/banking/categorize";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const MATCH_FIELDS = [
  "counterparty_name",
  "counterparty_iban",
  "description",
  "remittance_info",
] as const;
const MATCH_TYPES = ["contains", "equals", "regex"] as const;

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  category_id: z.string().uuid(),
  match_field: z.enum(MATCH_FIELDS),
  match_type: z.enum(MATCH_TYPES),
  match_value: z.string().trim().min(1).max(500),
  is_case_sensitive: z.boolean().default(false),
  priority: z.coerce.number().int().min(0).max(1000).default(0),
});

export type UpsertRuleInput = z.input<typeof upsertSchema>;

export async function upsertRule(
  input: UpsertRuleInput,
): Promise<{ ok: true; id: string } | { error: string }> {
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const data = parsed.data;

  // Reject invalid regex up front.
  if (data.match_type === "regex") {
    try {
      new RegExp(data.match_value);
    } catch {
      return { error: "Invalid regular expression" };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: membership, error: memErr } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (memErr || !membership) {
    return { error: memErr?.message ?? "No household for user" };
  }
  const household_id = membership.household_id;

  if (data.id) {
    const { error } = await supabase
      .from("categorization_rules")
      .update({
        category_id: data.category_id,
        match_field: data.match_field,
        match_type: data.match_type,
        match_value: data.match_value,
        is_case_sensitive: data.is_case_sensitive,
        priority: data.priority,
      })
      .eq("id", data.id);
    if (error) return { error: error.message };
    revalidatePath("/settings/rules");
    return { ok: true, id: data.id };
  }

  const { data: row, error } = await supabase
    .from("categorization_rules")
    .insert({
      household_id,
      category_id: data.category_id,
      match_field: data.match_field,
      match_type: data.match_type,
      match_value: data.match_value,
      is_case_sensitive: data.is_case_sensitive,
      priority: data.priority,
    })
    .select("id")
    .single();
  if (error || !row) return { error: error?.message ?? "Insert failed" };

  revalidatePath("/settings/rules");
  return { ok: true, id: row.id };
}

export async function deleteRule(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("categorization_rules").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/settings/rules");
  return { ok: true };
}

/** Re-run all rules over every uncategorised transaction in the household. */
export async function reapplyRules(): Promise<
  { ok: true; updated: number } | { error: string }
> {
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

  // Service role for the bulk update — RLS overhead is significant for
  // hundreds of rows, and we've already verified ownership.
  const service = createServiceClient();
  try {
    const updated = await applyRulesToUncategorised(service, {
      household_id: membership.household_id,
    });
    revalidatePath("/transactions");
    revalidatePath("/");
    revalidatePath("/settings/rules");
    return { ok: true, updated };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
