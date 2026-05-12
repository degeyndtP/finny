"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Repeat, Trash2 } from "lucide-react";
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

import { addPlannedFromPattern, deletePlanned } from "./actions";
import {
  PlannedFormDialog,
  type PlannedDialogAccount,
  type PlannedDialogCategory,
  type PlannedDialogValue,
} from "./planned-form-dialog";

export interface SuggestionRow {
  key: string;
  display: string;
  cadence: "weekly" | "monthly" | "quarterly" | "yearly";
  averageAmount: number;
  occurrences: number;
  lastDate: string;
  nextPredicted: string;
  category_id: string | null;
}

export interface PlannedRow {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  recurrence: "none" | "weekly" | "monthly" | "quarterly" | "yearly";
  recurrence_until: string | null;
  category_id: string | null;
  account_id: string | null;
}

interface Props {
  suggestions: SuggestionRow[];
  planned: PlannedRow[];
  currency: string;
  categories: PlannedDialogCategory[];
  accounts: PlannedDialogAccount[];
  locale?: string;
}

export function RecurringSection({
  suggestions,
  planned,
  currency,
  categories,
  accounts,
  locale = "nl-BE",
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PlannedDialogValue | undefined>(undefined);

  const money = new Intl.NumberFormat(locale, { style: "currency", currency });
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  function onAddFromSuggestion(s: SuggestionRow) {
    startTransition(async () => {
      const result = await addPlannedFromPattern({
        description: s.display,
        amount: s.averageAmount,
        due_date: s.nextPredicted,
        recurrence: s.cadence,
        category_id: s.category_id,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Added "${s.display}" to your plan`);
      router.refresh();
    });
  }

  function openCreate() {
    setEditing(undefined);
    setDialogOpen(true);
  }

  function openEdit(p: PlannedRow) {
    setEditing({
      id: p.id,
      description: p.description,
      amount: p.amount,
      due_date: p.due_date,
      recurrence: p.recurrence,
      recurrence_until: p.recurrence_until,
      category_id: p.category_id,
      account_id: p.account_id,
    });
    setDialogOpen(true);
  }

  function onDelete(p: PlannedRow) {
    const ok = window.confirm(
      `Remove "${p.description}" from your plan? Forecast will recompute.`,
    );
    if (!ok) return;

    startTransition(async () => {
      const result = await deletePlanned(p.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Removed ${p.description}`);
      router.refresh();
    });
  }

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Suggestions</CardTitle>
            <CardDescription>
              Patterns we found in your history. Add them to your plan to
              include in the forecast.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {suggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing new — all detected patterns are already planned (or you
                have too little history yet).
              </p>
            ) : (
              <ul className="divide-y">
                {suggestions.map((s) => {
                  const isOut = s.averageAmount < 0;
                  return (
                    <li
                      key={s.key}
                      className="flex items-center justify-between gap-3 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{s.display}</div>
                        <div className="text-xs text-muted-foreground">
                          {s.cadence} · last {date(s.lastDate)} · next {date(s.nextPredicted)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`tabular-nums text-sm ${
                            isOut
                              ? "text-chart-5"
                              : "text-chart-2"
                          }`}
                        >
                          {money.format(s.averageAmount)}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onAddFromSuggestion(s)}
                          disabled={pending}
                        >
                          <Plus />
                          Plan
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div className="space-y-1.5">
              <CardTitle className="text-base">Planned cashflows</CardTitle>
              <CardDescription>
                Drives the forecast. Recurring entries repeat until you remove them.
              </CardDescription>
            </div>
            <Button type="button" size="sm" onClick={openCreate}>
              <Plus />
              Add
            </Button>
          </CardHeader>
          <CardContent>
            {planned.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing planned yet. Accept a suggestion or click <strong>Add</strong>.
              </p>
            ) : (
              <ul className="divide-y">
                {planned.map((p) => {
                  const isOut = p.amount < 0;
                  return (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-3 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate flex items-center gap-2">
                          {p.recurrence !== "none" ? (
                            <Repeat className="size-3.5 text-muted-foreground" />
                          ) : null}
                          {p.description}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {p.recurrence === "none" ? (
                            <>one-off · {date(p.due_date)}</>
                          ) : (
                            <>
                              {p.recurrence} · next {date(p.due_date)}
                              {p.recurrence_until
                                ? ` · until ${date(p.recurrence_until)}`
                                : ""}
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`tabular-nums text-sm ${
                            isOut
                              ? "text-chart-5"
                              : "text-chart-2"
                          }`}
                        >
                          {money.format(p.amount)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEdit(p)}
                          disabled={pending}
                          aria-label={`Edit ${p.description}`}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => onDelete(p)}
                          disabled={pending}
                          aria-label={`Remove ${p.description}`}
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
      </div>

      <PlannedFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        categories={categories}
        accounts={accounts}
      />
    </>
  );
}

export function CadenceBadge({ cadence }: { cadence: string }) {
  return <Badge variant="secondary">{cadence}</Badge>;
}
