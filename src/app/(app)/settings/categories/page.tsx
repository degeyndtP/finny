import { createClient } from "@/lib/supabase/server";
import { CategoriesManager, type CategoryRow } from "./categories-manager";

export default async function CategoriesPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("categories")
    .select("id, name, kind, color, parent_id, sort_order, monthly_budget")
    .order("kind", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return (
      <p className="text-sm text-destructive">Could not load categories: {error.message}</p>
    );
  }

  // DB CHECK constrains kind to one of three string values; the generated
  // type widens it to `string`. Narrow back here for the manager.
  const categories = (data ?? []) as CategoryRow[];

  return <CategoriesManager categories={categories} />;
}
