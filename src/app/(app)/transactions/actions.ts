"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

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
  revalidatePath("/");
  return { ok: true };
}
