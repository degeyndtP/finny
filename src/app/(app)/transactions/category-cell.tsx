"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { CategoryBadge } from "@/components/category-badge";
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

import { setTransactionCategory } from "./actions";

type Kind = "income" | "expense" | "transfer";

export interface CategoryOption {
  id: string;
  name: string;
  kind: Kind;
  color: string | null;
}

const NONE = "__none__";

interface Props {
  transactionId: string;
  currentCategoryId: string | null;
  categories: CategoryOption[];
}

export function CategoryCell({
  transactionId,
  currentCategoryId,
  categories,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Local state lets us show the new value immediately while the action runs.
  const [value, setValue] = useState<string>(currentCategoryId ?? NONE);

  const byId = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  function onChange(next: string | null) {
    const resolved = next ?? NONE;
    if (resolved === value) return;
    const previous = value;
    setValue(resolved);
    startTransition(async () => {
      const result = await setTransactionCategory(
        transactionId,
        resolved === NONE ? null : resolved,
      );
      if ("error" in result) {
        toast.error(result.error);
        setValue(previous);
        return;
      }
      router.refresh();
    });
  }

  const grouped = {
    income: categories.filter((c) => c.kind === "income"),
    expense: categories.filter((c) => c.kind === "expense"),
    transfer: categories.filter((c) => c.kind === "transfer"),
  };

  return (
    <Select value={value} onValueChange={onChange} disabled={pending}>
      <SelectTrigger className="h-7 w-full max-w-48 border-transparent bg-transparent px-2 hover:border-border data-[state=open]:border-border">
        <SelectValue placeholder="None">
          {(selected: string | null) => {
            if (!selected || selected === NONE) {
              return <span className="text-sm text-muted-foreground">None</span>;
            }
            const c = byId.get(selected);
            if (!c) return <span className="text-sm text-muted-foreground">None</span>;
            return <CategoryBadge name={c.name} color={c.color} />;
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE} label="None">
          <span className="text-muted-foreground">None</span>
        </SelectItem>
        {grouped.income.length ? (
          <>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Income</SelectLabel>
              {grouped.income.map((c) => (
                <Option key={c.id} c={c} />
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
                <Option key={c.id} c={c} />
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
                <Option key={c.id} c={c} />
              ))}
            </SelectGroup>
          </>
        ) : null}
      </SelectContent>
    </Select>
  );
}

function Option({ c }: { c: CategoryOption }) {
  return (
    <SelectItem value={c.id} label={c.name}>
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: c.color ?? "#6B7280" }}
        />
        <span>{c.name}</span>
      </span>
    </SelectItem>
  );
}
