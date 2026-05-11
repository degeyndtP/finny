"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const KIND_VALUES = ["income", "expense", "transfer"] as const;
type Kind = (typeof KIND_VALUES)[number];

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  kind: z.enum(KIND_VALUES),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/u, "Color must be a #RRGGBB hex value")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  parent_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  /** Positive monthly budget; null clears the budget. */
  monthly_budget: z
    .number()
    .finite()
    .nonnegative()
    .nullable()
    .optional()
    .transform((v) => (v == null || v === 0 ? null : v)),
});

export type UpsertCategoryInput = z.input<typeof upsertSchema>;

export async function upsertCategory(
  input: UpsertCategoryInput,
): Promise<{ ok: true; id: string } | { error: string }> {
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const data = parsed.data;

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

  // Budgets only apply to expense categories — null it out otherwise so
  // switching kind doesn't leave a stale value behind.
  const monthlyBudget = data.kind === "expense" ? data.monthly_budget : null;

  if (data.id) {
    // Update — RLS limits to the user's household.
    const { error } = await supabase
      .from("categories")
      .update({
        name: data.name,
        kind: data.kind,
        color: data.color ?? null,
        parent_id: data.parent_id ?? null,
        monthly_budget: monthlyBudget,
      })
      .eq("id", data.id);
    if (error) return { error: error.message };
    revalidatePath("/settings/categories");
    revalidatePath("/transactions");
    revalidatePath("/cashflow");
    revalidatePath("/");
    return { ok: true, id: data.id };
  }

  const { data: row, error } = await supabase
    .from("categories")
    .insert({
      household_id,
      name: data.name,
      kind: data.kind,
      color: data.color ?? null,
      parent_id: data.parent_id ?? null,
      monthly_budget: monthlyBudget,
    })
    .select("id")
    .single();
  if (error || !row) return { error: error?.message ?? "Insert failed" };

  revalidatePath("/settings/categories");
  revalidatePath("/transactions");
  revalidatePath("/cashflow");
  revalidatePath("/");
  return { ok: true, id: row.id };
}

export async function deleteCategory(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/settings/categories");
  revalidatePath("/transactions");
  revalidatePath("/");
  return { ok: true };
}

export type CategoryKind = Kind;
