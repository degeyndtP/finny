import { createClient } from "@/lib/supabase/server";
import {
  RulesManager,
  type RuleListRow,
} from "./rules-manager";
import type { RuleDialogCategory } from "./rule-form-dialog";

// Reapply can touch many rows on first runs.
export const maxDuration = 60;

export default async function RulesPage() {
  const supabase = await createClient();

  const [{ data: rulesRaw }, { data: categoriesRaw }] = await Promise.all([
    supabase
      .from("categorization_rules")
      .select(
        "id, category_id, match_field, match_type, match_value, is_case_sensitive, priority",
      )
      .order("priority", { ascending: false })
      .order("match_value", { ascending: true }),
    supabase
      .from("categories")
      .select("id, name, kind, color")
      .order("kind")
      .order("sort_order")
      .order("name"),
  ]);

  // DB CHECK constrains the unions; widen back to the narrow types.
  const rules = (rulesRaw ?? []) as RuleListRow[];
  const categories = (categoriesRaw ?? []) as RuleDialogCategory[];

  return <RulesManager rules={rules} categories={categories} />;
}
