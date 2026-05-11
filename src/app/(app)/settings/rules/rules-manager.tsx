"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CategoryBadge } from "@/components/category-badge";
import { deleteRule, reapplyRules } from "./actions";
import {
  RuleFormDialog,
  type RuleDialogCategory,
  type RuleDialogValue,
} from "./rule-form-dialog";

type Field = "counterparty_name" | "counterparty_iban" | "description" | "remittance_info";
type MatchType = "contains" | "equals" | "regex";

const FIELD_LABEL: Record<Field, string> = {
  counterparty_name: "Counterparty",
  counterparty_iban: "Counterparty IBAN",
  description: "Description",
  remittance_info: "Remittance",
};
const MATCH_LABEL: Record<MatchType, string> = {
  contains: "contains",
  equals: "equals",
  regex: "regex",
};

export interface RuleListRow {
  id: string;
  category_id: string;
  match_field: Field;
  match_type: MatchType;
  match_value: string;
  is_case_sensitive: boolean;
  priority: number;
}

interface Props {
  rules: RuleListRow[];
  categories: RuleDialogCategory[];
}

export function RulesManager({ rules, categories }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RuleDialogValue | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reapplying, startReapply] = useTransition();
  const [, startDelete] = useTransition();

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  function openCreate() {
    setEditing(undefined);
    setOpen(true);
  }

  function openEdit(r: RuleListRow) {
    setEditing(r);
    setOpen(true);
  }

  function onDelete(r: RuleListRow) {
    const cat = categoryById.get(r.category_id);
    const ok = window.confirm(
      `Delete this rule? Any transactions previously tagged via this rule keep their category — they're not retagged automatically.`,
    );
    if (!ok) return;

    setDeletingId(r.id);
    startDelete(async () => {
      const result = await deleteRule(r.id);
      setDeletingId(null);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Rule deleted${cat ? ` (${cat.name})` : ""}`);
      router.refresh();
    });
  }

  function onReapply() {
    startReapply(async () => {
      const t = toast.loading("Reapplying rules…");
      const result = await reapplyRules();
      toast.dismiss(t);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.updated
          ? `Tagged ${result.updated} transaction${result.updated === 1 ? "" : "s"}`
          : "All caught up — no uncategorised matches",
      );
      router.refresh();
    });
  }

  if (categories.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No categories yet</CardTitle>
          <CardDescription>
            Create at least one category before adding a rule. Rules tag
            transactions with a target category.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onReapply}
          disabled={reapplying || rules.length === 0}
        >
          <Wand2 />
          {reapplying ? "Reapplying…" : "Reapply to uncategorised"}
        </Button>
        <Button type="button" onClick={openCreate}>
          <Plus />
          Add rule
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Categorisation rules</CardTitle>
          <CardDescription>
            Applied to new imports during sync. Highest priority wins.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No rules yet. Add one to start auto-tagging.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {rules.map((r) => {
                const cat = categoryById.get(r.category_id);
                return (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-wrap">
                      <Badge variant="secondary" className="tabular-nums">
                        p{r.priority}
                      </Badge>
                      <span className="text-muted-foreground">
                        {FIELD_LABEL[r.match_field]}
                      </span>
                      <span className="text-muted-foreground">
                        {MATCH_LABEL[r.match_type]}
                      </span>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        {r.match_value}
                      </code>
                      {r.is_case_sensitive ? (
                        <Badge variant="secondary" className="text-xs">case</Badge>
                      ) : null}
                      <span className="text-muted-foreground">→</span>
                      {cat ? (
                        <CategoryBadge name={cat.name} color={cat.color} />
                      ) : (
                        <span className="text-muted-foreground italic">
                          missing category
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(r)}
                        aria-label="Edit rule"
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onDelete(r)}
                        disabled={deletingId === r.id}
                        aria-label="Delete rule"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <RuleFormDialog
        open={open}
        onOpenChange={setOpen}
        rule={editing}
        categories={categories}
      />
    </>
  );
}
