"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type Kind = "income" | "expense" | "transfer";

export interface FilterCategory {
  id: string;
  name: string;
  kind: Kind;
  color: string | null;
}

export interface FilterAccount {
  id: string;
  display_name: string | null;
  iban: string | null;
}

interface Props {
  initial: {
    q: string;
    counterparty: string;
    category: string; // id or "uncategorised" or ""
    account: string;
  };
  categories: FilterCategory[];
  accounts: FilterAccount[];
  totalCount: number;
}

const ALL = "__all__";

export function TransactionsFilters({
  initial,
  categories,
  accounts,
  totalCount,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  // Local state for the search box so typing isn't on every keystroke.
  const [q, setQ] = useState(initial.q);

  // Push the URL when q is committed (Enter or blur or debounce).
  useEffect(() => {
    setQ(initial.q);
  }, [initial.q]);

  function pushParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function onSubmitSearch(e: React.FormEvent) {
    e.preventDefault();
    pushParams({ q: q.trim() || null });
  }

  const grouped = {
    income: categories.filter((c) => c.kind === "income"),
    expense: categories.filter((c) => c.kind === "expense"),
    transfer: categories.filter((c) => c.kind === "transfer"),
  };

  const hasAnyFilter =
    !!initial.q || !!initial.counterparty || !!initial.category || !!initial.account;

  const categoryLabel = (() => {
    if (!initial.category) return null;
    if (initial.category === "uncategorised") return "Uncategorised";
    return categories.find((c) => c.id === initial.category)?.name ?? "Category";
  })();

  const accountLabel = (() => {
    if (!initial.account) return null;
    const a = accounts.find((x) => x.id === initial.account);
    return a?.display_name ?? a?.iban ?? "Account";
  })();

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <form onSubmit={onSubmitSearch} className="relative flex-1 min-w-0">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search counterparty, description, remittance…"
            className="pl-8"
            disabled={pending}
          />
        </form>
        <div className="flex gap-2">
          <Select
            value={initial.category || ALL}
            onValueChange={(v) =>
              pushParams({ category: v === ALL ? null : v })
            }
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All categories">
                {(value: string | null) => {
                  if (!value || value === ALL) return "All categories";
                  if (value === "uncategorised") return "Uncategorised";
                  return categories.find((c) => c.id === value)?.name ?? "Category";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL} label="All categories">All categories</SelectItem>
              <SelectItem value="uncategorised" label="Uncategorised">
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
          <Select
            value={initial.account || ALL}
            onValueChange={(v) =>
              pushParams({ account: v === ALL ? null : v })
            }
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All accounts">
                {(value: string | null) => {
                  if (!value || value === ALL) return "All accounts";
                  const a = accounts.find((x) => x.id === value);
                  return a?.display_name ?? a?.iban ?? "Account";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL} label="All accounts">All accounts</SelectItem>
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

      {hasAnyFilter ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">{totalCount} match{totalCount === 1 ? "" : "es"}</span>
          {initial.q ? (
            <Chip onClear={() => pushParams({ q: null })}>
              Search: <strong className="ml-1">{initial.q}</strong>
            </Chip>
          ) : null}
          {initial.counterparty ? (
            <Chip onClear={() => pushParams({ counterparty: null })}>
              Counterparty: <strong className="ml-1">{initial.counterparty}</strong>
            </Chip>
          ) : null}
          {categoryLabel ? (
            <Chip onClear={() => pushParams({ category: null })}>
              Category: <strong className="ml-1">{categoryLabel}</strong>
            </Chip>
          ) : null}
          {accountLabel ? (
            <Chip onClear={() => pushParams({ account: null })}>
              Account: <strong className="ml-1">{accountLabel}</strong>
            </Chip>
          ) : null}
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() =>
              pushParams({ q: null, counterparty: null, category: null, account: null })
            }
            disabled={pending}
          >
            Clear all
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function CategoryItem({ c }: { c: FilterCategory }) {
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

function Chip({ children, onClear }: { children: React.ReactNode; onClear: () => void }) {
  return (
    <Badge variant="secondary" className="gap-1 pr-1">
      <span>{children}</span>
      <button
        type="button"
        onClick={onClear}
        aria-label="Remove filter"
        className="rounded-full p-0.5 hover:bg-background/50"
      >
        <X className="size-3" />
      </button>
    </Badge>
  );
}
