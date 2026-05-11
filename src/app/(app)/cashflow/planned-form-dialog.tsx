"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { upsertPlanned, type UpsertPlannedInput } from "./actions";

type Recurrence = "none" | "weekly" | "monthly" | "quarterly" | "yearly";
type Kind = "income" | "expense" | "transfer";

export interface PlannedDialogValue {
  id?: string;
  description: string;
  /** UI uses absolute value + a separate sign toggle so it's harder to enter wrong sign. */
  amount: number; // signed
  due_date: string;
  recurrence: Recurrence;
  recurrence_until: string | null;
  category_id: string | null;
  account_id: string | null;
}

export interface PlannedDialogCategory {
  id: string;
  name: string;
  kind: Kind;
  color: string | null;
}

export interface PlannedDialogAccount {
  id: string;
  display_name: string | null;
  iban: string | null;
}

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  initial?: PlannedDialogValue;
  categories: PlannedDialogCategory[];
  accounts: PlannedDialogAccount[];
}

const NONE_VALUE = "__none__";

const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: "One-off",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PlannedFormDialog({
  open,
  onOpenChange,
  initial,
  categories,
  accounts,
}: Props) {
  const router = useRouter();
  const formId = useId();
  const [pending, startTransition] = useTransition();
  const isEdit = !!initial?.id;

  const [description, setDescription] = useState(initial?.description ?? "");
  const [direction, setDirection] = useState<"out" | "in">(
    initial && initial.amount >= 0 ? "in" : "out",
  );
  const [amountAbs, setAmountAbs] = useState<string>(
    initial ? String(Math.abs(initial.amount)) : "",
  );
  const [dueDate, setDueDate] = useState(initial?.due_date ?? todayIso());
  const [recurrence, setRecurrence] = useState<Recurrence>(initial?.recurrence ?? "monthly");
  const [recurrenceUntil, setRecurrenceUntil] = useState(initial?.recurrence_until ?? "");
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [accountId, setAccountId] = useState(initial?.account_id ?? "");

  const grouped = {
    income: categories.filter((c) => c.kind === "income"),
    expense: categories.filter((c) => c.kind === "expense"),
    transfer: categories.filter((c) => c.kind === "transfer"),
  };

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const abs = Number(amountAbs);
    if (!Number.isFinite(abs) || abs <= 0) {
      toast.error("Amount must be a positive number");
      return;
    }
    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }

    const signed = direction === "out" ? -abs : abs;

    const payload: UpsertPlannedInput = {
      id: initial?.id,
      description: description.trim(),
      amount: signed,
      due_date: dueDate,
      recurrence,
      recurrence_until:
        recurrence === "none" ? null : recurrenceUntil || null,
      category_id: categoryId || null,
      account_id: accountId || null,
    };

    startTransition(async () => {
      const result = await upsertPlanned(payload);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? "Plan updated" : "Plan added");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit planned cashflow" : "New planned cashflow"}</DialogTitle>
          <DialogDescription>
            One-off (no recurrence) or recurring. Drives the 90-day forecast.
          </DialogDescription>
        </DialogHeader>
        <form id={formId} onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${formId}-desc`}>Description</Label>
            <Input
              id={`${formId}-desc`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              autoFocus
              placeholder="e.g. Rent, Salary, Vacation Italy"
            />
          </div>

          <div className="grid grid-cols-[100px_1fr] gap-2">
            <div className="space-y-2">
              <Label>Direction</Label>
              <Select
                value={direction}
                onValueChange={(v) => setDirection((v ?? "out") as "out" | "in")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string | null) => (value === "in" ? "In" : "Out")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="out" label="Out">
                    <span className="text-rose-600 dark:text-rose-400">Out</span>
                  </SelectItem>
                  <SelectItem value="in" label="In">
                    <span className="text-emerald-600 dark:text-emerald-400">In</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${formId}-amount`}>Amount</Label>
              <Input
                id={`${formId}-amount`}
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={amountAbs}
                onChange={(e) => setAmountAbs(e.target.value)}
                required
                className="font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`${formId}-date`}>Due date</Label>
              <Input
                id={`${formId}-date`}
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Recurrence</Label>
              <Select
                value={recurrence}
                onValueChange={(v) => setRecurrence((v ?? "none") as Recurrence)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string | null) => RECURRENCE_LABELS[(value ?? "none") as Recurrence]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" label="One-off">One-off</SelectItem>
                  <SelectItem value="weekly" label="Weekly">Weekly</SelectItem>
                  <SelectItem value="monthly" label="Monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly" label="Quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly" label="Yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {recurrence !== "none" ? (
            <div className="space-y-2">
              <Label htmlFor={`${formId}-until`}>Recurrence until (optional)</Label>
              <Input
                id={`${formId}-until`}
                type="date"
                value={recurrenceUntil}
                onChange={(e) => setRecurrenceUntil(e.target.value)}
                min={dueDate}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for indefinite recurrence.
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category (optional)</Label>
              <Select
                value={categoryId || NONE_VALUE}
                onValueChange={(v) => setCategoryId(v === NONE_VALUE ? "" : (v ?? ""))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="None">
                    {(value: string | null) => {
                      if (!value || value === NONE_VALUE) return "None";
                      return categories.find((c) => c.id === value)?.name ?? "Category";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE} label="None">
                    <span className="text-muted-foreground">None</span>
                  </SelectItem>
                  {grouped.income.length ? (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>Income</SelectLabel>
                        {grouped.income.map((c) => (
                          <CategoryItem key={c.id} c={c} />
                        ))}
                      </SelectGroup>
                    </>
                  ) : null}
                  {grouped.expense.length ? (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>Expense</SelectLabel>
                        {grouped.expense.map((c) => (
                          <CategoryItem key={c.id} c={c} />
                        ))}
                      </SelectGroup>
                    </>
                  ) : null}
                  {grouped.transfer.length ? (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>Transfer</SelectLabel>
                        {grouped.transfer.map((c) => (
                          <CategoryItem key={c.id} c={c} />
                        ))}
                      </SelectGroup>
                    </>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Account (optional)</Label>
              <Select
                value={accountId || NONE_VALUE}
                onValueChange={(v) => setAccountId(v === NONE_VALUE ? "" : (v ?? ""))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Any account">
                    {(value: string | null) => {
                      if (!value || value === NONE_VALUE) return "Any account";
                      const a = accounts.find((x) => x.id === value);
                      return a?.display_name ?? a?.iban ?? "Account";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE} label="Any account">
                    <span className="text-muted-foreground">Any account</span>
                  </SelectItem>
                  {accounts.map((a) => {
                    const label = a.display_name ?? a.iban ?? "Account";
                    return (
                      <SelectItem key={a.id} value={a.id} label={label}>
                        {label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={pending}>
            {pending ? "Saving…" : isEdit ? "Save changes" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoryItem({ c }: { c: PlannedDialogCategory }) {
  return (
    <SelectItem value={c.id} label={c.name}>
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: c.color ?? "#6B7280" }}
        />
        {c.name}
      </span>
    </SelectItem>
  );
}
