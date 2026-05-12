"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { formatDate, formatMoney } from "@/lib/format";
import { bulkSetCategory } from "./actions";
import { CategoryCell, type CategoryOption } from "./category-cell";

interface Tx {
  id: string;
  booking_date: string;
  amount: number | string;
  currency: string;
  counterparty_name: string | null;
  description: string | null;
  remittance_info: string | null;
  category_id: string | null;
}

const NONE = "__none__";

export type SortKey = "booking_date" | "amount";
export type SortDir = "asc" | "desc";

interface Props {
  transactions: Tx[];
  categories: CategoryOption[];
  sort: SortKey;
  dir: SortDir;
}

export function TransactionsTable({ transactions, categories, sort, dir }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState<string>(NONE);
  const [createRules, setCreateRules] = useState<boolean>(false);
  const [pending, startTransition] = useTransition();

  const allIds = useMemo(() => transactions.map((t) => t.id), [transactions]);
  const allChecked = selected.size > 0 && selected.size === allIds.length;
  const someChecked = selected.size > 0 && selected.size < allIds.length;

  function toggleOne(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((cur) => {
      if (cur.size === allIds.length) return new Set();
      return new Set(allIds);
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setBulkCategory(NONE);
    setCreateRules(false);
  }

  function applyBulk() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const target = bulkCategory === NONE ? null : bulkCategory;

    startTransition(async () => {
      const result = await bulkSetCategory(ids, target, createRules && !!target);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const cat =
        target == null
          ? "uncategorised"
          : categories.find((c) => c.id === target)?.name ?? "category";
      const main = `Tagged ${result.updated} transaction${result.updated === 1 ? "" : "s"} as ${cat}`;
      if (result.rulesCreated > 0) {
        const parts = [
          `Created ${result.rulesCreated} auto-rule${result.rulesCreated === 1 ? "" : "s"} for the counterparties in this batch.`,
        ];
        if (result.alsoApplied > 0) {
          parts.push(
            `Tagged ${result.alsoApplied} other previously-uncategorised transaction${result.alsoApplied === 1 ? "" : "s"} too.`,
          );
        }
        toast.success(main, { description: parts.join(" ") });
      } else {
        toast.success(main);
      }
      clearSelection();
      router.refresh();
    });
  }

  const grouped = {
    income: categories.filter((c) => c.kind === "income"),
    expense: categories.filter((c) => c.kind === "expense"),
    transfer: categories.filter((c) => c.kind === "transfer"),
  };

  return (
    <div className="space-y-3">
      {selected.size > 0 ? (
        <div className="sticky top-16 z-10 flex flex-wrap items-center gap-3 rounded-md border bg-background/95 backdrop-blur p-3 shadow-sm">
          <span className="text-sm font-medium">
            {selected.size} selected
          </span>
          <Select
            value={bulkCategory}
            onValueChange={(v) => setBulkCategory(v ?? NONE)}
            disabled={pending}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Set category…">
                {(value: string | null) => {
                  if (!value || value === NONE)
                    return <span className="text-muted-foreground">Set as uncategorised</span>;
                  return categories.find((c) => c.id === value)?.name ?? "Set category…";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE} label="Uncategorised">
                <span className="text-muted-foreground">Uncategorised</span>
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
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={createRules}
              disabled={pending || bulkCategory === NONE}
              onChange={(e) => setCreateRules(e.target.checked)}
              className="size-4 rounded border-input"
            />
            <span>
              Also create rule per counterparty
              <span className="ml-1 text-xs">(disabled when uncategorising)</span>
            </span>
          </label>
          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={applyBulk}
              disabled={pending}
            >
              {pending ? "Applying…" : "Apply"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={clearSelection}
              disabled={pending}
              aria-label="Clear selection"
            >
              <X />
            </Button>
          </div>
        </div>
      ) : null}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all visible"
                  checked={allChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = someChecked;
                  }}
                  onChange={toggleAll}
                  className="size-4 rounded border-input align-middle"
                />
              </TableHead>
              <TableHead className="w-32">
                <SortHeader sort="booking_date" current={{ sort, dir }}>Date</SortHeader>
              </TableHead>
              <TableHead>Counterparty</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">
                <SortHeader sort="amount" current={{ sort, dir }} align="right">
                  Amount
                </SortHeader>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => {
              const amount = Number(tx.amount);
              const isSelected = selected.has(tx.id);
              return (
                <TableRow
                  key={tx.id}
                  data-state={isSelected ? "selected" : undefined}
                  className={isSelected ? "bg-muted/40" : undefined}
                >
                  <TableCell>
                    <input
                      type="checkbox"
                      aria-label={`Select transaction ${tx.id}`}
                      checked={isSelected}
                      onChange={() => toggleOne(tx.id)}
                      className="size-4 rounded border-input align-middle"
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {formatDate(tx.booking_date)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {tx.counterparty_name ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-sm truncate text-muted-foreground">
                    {tx.description ?? tx.remittance_info ?? "—"}
                  </TableCell>
                  <TableCell className="p-1">
                    <CategoryCell
                      transactionId={tx.id}
                      currentCategoryId={tx.category_id}
                      categories={categories}
                    />
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${
                      amount < 0
                        ? "text-chart-5"
                        : "text-chart-2"
                    }`}
                  >
                    {formatMoney(amount, tx.currency)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CategoryItem({ c }: { c: CategoryOption }) {
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

function SortHeader({
  sort,
  current,
  align = "left",
  children,
}: {
  sort: SortKey;
  current: { sort: SortKey; dir: SortDir };
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const isActive = current.sort === sort;
  const nextDir: SortDir = isActive
    ? current.dir === "desc"
      ? "asc"
      : "desc"
    : "desc";

  const next = new URLSearchParams(searchParams.toString());
  next.set("sort", sort);
  next.set("dir", nextDir);

  const Icon = !isActive ? ArrowUpDown : current.dir === "asc" ? ArrowUp : ArrowDown;

  return (
    <Link
      href={`/transactions?${next.toString()}`}
      className={`flex items-center gap-1 ${align === "right" ? "justify-end" : ""} ${
        isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      } transition-colors`}
    >
      {children}
      <Icon className="size-3" />
    </Link>
  );
}
