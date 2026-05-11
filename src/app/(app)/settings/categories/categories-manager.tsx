"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryBadge } from "@/components/category-badge";
import { CategoryFormDialog } from "./category-form-dialog";
import { deleteCategory } from "./actions";

type Kind = "income" | "expense" | "transfer";

export interface CategoryRow {
  id: string;
  name: string;
  kind: Kind;
  color: string | null;
  parent_id: string | null;
  sort_order: number;
  monthly_budget: number | null;
}

const KIND_LABELS: Record<Kind, string> = {
  income: "Income",
  expense: "Expense",
  transfer: "Transfer",
};

const KIND_ORDER: Kind[] = ["income", "expense", "transfer"];

export function CategoriesManager({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const grouped = useMemo(() => {
    const out: Record<Kind, CategoryRow[]> = {
      income: [],
      expense: [],
      transfer: [],
    };
    for (const c of categories) out[c.kind].push(c);
    for (const kind of KIND_ORDER) {
      out[kind].sort(
        (a, b) =>
          a.sort_order - b.sort_order || a.name.localeCompare(b.name),
      );
    }
    return out;
  }, [categories]);

  function openCreate() {
    setEditing(undefined);
    setDialogOpen(true);
  }

  function openEdit(cat: CategoryRow) {
    setEditing(cat);
    setDialogOpen(true);
  }

  function onDelete(cat: CategoryRow) {
    const ok = window.confirm(
      `Delete "${cat.name}"?\n\n` +
        `Transactions tagged with this category will become uncategorised. ` +
        `Any rules pointing at this category will also be removed.`,
    );
    if (!ok) return;

    setDeletingId(cat.id);
    startTransition(async () => {
      const result = await deleteCategory(cat.id);
      setDeletingId(null);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Deleted ${cat.name}`);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center justify-end">
        <Button onClick={openCreate}>
          <Plus />
          Add category
        </Button>
      </div>

      <div className="space-y-6">
        {KIND_ORDER.map((kind) => {
          const items = grouped[kind];
          return (
            <Card key={kind}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">{KIND_LABELS[kind]}</CardTitle>
                <Badge variant="secondary">{items.length}</Badge>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No {KIND_LABELS[kind].toLowerCase()} categories yet.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {items.map((cat) => (
                      <li
                        key={cat.id}
                        className="flex items-center justify-between gap-3 py-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <CategoryBadge name={cat.name} color={cat.color} />
                          {cat.monthly_budget != null ? (
                            <span className="text-xs text-muted-foreground tabular-nums">
                              €{cat.monthly_budget}/mo
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openEdit(cat)}
                            aria-label={`Edit ${cat.name}`}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => onDelete(cat)}
                            disabled={deletingId === cat.id}
                            aria-label={`Delete ${cat.name}`}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <CategoryFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={
          editing
            ? {
                id: editing.id,
                name: editing.name,
                kind: editing.kind,
                color: editing.color,
                monthly_budget: editing.monthly_budget,
              }
            : undefined
        }
      />
    </>
  );
}
