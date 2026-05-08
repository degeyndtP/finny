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

import { upsertRule } from "./actions";

type Field = "counterparty_name" | "counterparty_iban" | "description" | "remittance_info";
type MatchType = "contains" | "equals" | "regex";
type Kind = "income" | "expense" | "transfer";

const FIELD_LABEL: Record<Field, string> = {
  counterparty_name: "Counterparty name",
  counterparty_iban: "Counterparty IBAN",
  description: "Description",
  remittance_info: "Remittance info",
};

const MATCH_LABEL: Record<MatchType, string> = {
  contains: "contains",
  equals: "equals",
  regex: "matches regex",
};

export interface RuleDialogCategory {
  id: string;
  name: string;
  kind: Kind;
  color: string | null;
}

export interface RuleDialogValue {
  id?: string;
  category_id: string;
  match_field: Field;
  match_type: MatchType;
  match_value: string;
  is_case_sensitive: boolean;
  priority: number;
}

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  rule?: RuleDialogValue;
  categories: RuleDialogCategory[];
}

export function RuleFormDialog({ open, onOpenChange, rule, categories }: Props) {
  const router = useRouter();
  const formId = useId();
  const [pending, startTransition] = useTransition();
  const isEdit = !!rule?.id;

  const [matchField, setMatchField] = useState<Field>(
    rule?.match_field ?? "counterparty_name",
  );
  const [matchType, setMatchType] = useState<MatchType>(rule?.match_type ?? "contains");
  const [matchValue, setMatchValue] = useState(rule?.match_value ?? "");
  const [caseSensitive, setCaseSensitive] = useState(rule?.is_case_sensitive ?? false);
  const [categoryId, setCategoryId] = useState(rule?.category_id ?? categories[0]?.id ?? "");
  const [priority, setPriority] = useState(rule?.priority ?? 0);

  const grouped = {
    income: categories.filter((c) => c.kind === "income"),
    expense: categories.filter((c) => c.kind === "expense"),
    transfer: categories.filter((c) => c.kind === "transfer"),
  };

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId) {
      toast.error("Pick a category");
      return;
    }
    if (matchValue.trim().length === 0) {
      toast.error("Match value is required");
      return;
    }

    startTransition(async () => {
      const result = await upsertRule({
        id: rule?.id,
        category_id: categoryId,
        match_field: matchField,
        match_type: matchType,
        match_value: matchValue.trim(),
        is_case_sensitive: caseSensitive,
        priority,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? "Rule updated" : "Rule created");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit rule" : "New rule"}</DialogTitle>
          <DialogDescription>
            New imports are tagged with the first matching rule, by priority
            (highest first). Use the Reapply button to retag existing
            uncategorised transactions.
          </DialogDescription>
        </DialogHeader>
        <form id={formId} onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-[1fr_auto_2fr] gap-2 items-end">
            <div className="space-y-2">
              <Label>Field</Label>
              <Select
                value={matchField}
                onValueChange={(v) => setMatchField(v as Field)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(FIELD_LABEL) as Field[]).map((f) => (
                    <SelectItem key={f} value={f}>
                      {FIELD_LABEL[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Select
                value={matchType}
                onValueChange={(v) => setMatchType(v as MatchType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(MATCH_LABEL) as MatchType[]).map((m) => (
                    <SelectItem key={m} value={m}>
                      {MATCH_LABEL[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${formId}-value`}>Value</Label>
              <Input
                id={`${formId}-value`}
                value={matchValue}
                onChange={(e) => setMatchValue(e.target.value)}
                required
                autoFocus
                placeholder={
                  matchType === "regex"
                    ? "^Carrefour\\b"
                    : "Carrefour"
                }
                className="font-mono"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id={`${formId}-cs`}
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
              className="size-4 rounded border-input"
            />
            <Label htmlFor={`${formId}-cs`} className="text-sm font-normal">
              Case-sensitive
            </Label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={categoryId}
                onValueChange={(v) => setCategoryId(v ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pick a category" />
                </SelectTrigger>
                <SelectContent>
                  {grouped.income.length ? (
                    <SelectGroup>
                      <SelectLabel>Income</SelectLabel>
                      {grouped.income.map((c) => (
                        <CategoryItem key={c.id} c={c} />
                      ))}
                    </SelectGroup>
                  ) : null}
                  {grouped.expense.length ? (
                    <>
                      {grouped.income.length ? <SelectSeparator /> : null}
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
                      {grouped.income.length || grouped.expense.length ? (
                        <SelectSeparator />
                      ) : null}
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
              <Label htmlFor={`${formId}-prio`}>Priority</Label>
              <Input
                id={`${formId}-prio`}
                type="number"
                min={0}
                max={1000}
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="font-mono tabular-nums"
              />
              <p className="text-xs text-muted-foreground">
                Higher wins when multiple rules match. Default 0.
              </p>
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
            {pending ? "Saving…" : isEdit ? "Save changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoryItem({ c }: { c: RuleDialogCategory }) {
  return (
    <SelectItem value={c.id}>
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
