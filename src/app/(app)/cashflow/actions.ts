"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const RECURRENCE_VALUES = ["weekly", "monthly", "quarterly", "yearly"] as const;

const planFromPatternSchema = z.object({
  description: z.string().trim().min(1).max(200),
  amount: z.number().finite(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  recurrence: z.enum(RECURRENCE_VALUES),
  category_id: z.string().uuid().nullable().optional(),
});

export type AddPlannedFromPatternInput = z.input<typeof planFromPatternSchema>;

export async function addPlannedFromPattern(
  input: AddPlannedFromPatternInput,
): Promise<{ ok: true; id: string } | { error: string }> {
  const parsed = planFromPatternSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const data = parsed.data;

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

  const { data: row, error } = await supabase
    .from("planned_cashflows")
    .insert({
      household_id: membership.household_id,
      description: data.description,
      amount: data.amount,
      due_date: data.due_date,
      recurrence: data.recurrence,
      category_id: data.category_id ?? null,
    })
    .select("id")
    .single();
  if (error || !row) return { error: error?.message ?? "Insert failed" };

  revalidatePath("/cashflow");
  revalidatePath("/");
  return { ok: true, id: row.id };
}

export async function deletePlanned(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("planned_cashflows").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/cashflow");
  revalidatePath("/");
  return { ok: true };
}
