import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/format";
import { CategoryCell, type CategoryOption } from "./category-cell";
import {
  TransactionsFilters,
  type FilterAccount,
  type FilterCategory,
} from "./transactions-filters";

const PAGE_LIMIT = 200;

type SortKey = "booking_date" | "amount";
type SortDir = "asc" | "desc";

interface SearchParams {
  q?: string;
  counterparty?: string;
  category?: string;
  account?: string;
  sort?: string;
  dir?: string;
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const filter = {
    q: params.q?.trim() ?? "",
    counterparty: params.counterparty?.trim() ?? "",
    category: params.category?.trim() ?? "",
    account: params.account?.trim() ?? "",
  };
  const sort: SortKey = params.sort === "amount" ? "amount" : "booking_date";
  const dir: SortDir = params.dir === "asc" ? "asc" : "desc";

  // Build the filtered query. We do TWO queries: one for the list, one for an
  // accurate row count to render in the active-filter chip header.
  function withFilters<T>(builder: T): T {
    let q = builder as unknown as ReturnType<
      ReturnType<typeof supabase.from>["select"]
    >;
    if (filter.q) {
      const safe = filter.q.replace(/[%_,]/g, " ").trim();
      if (safe) {
        q = q.or(
          `counterparty_name.ilike.%${safe}%,description.ilike.%${safe}%,remittance_info.ilike.%${safe}%`,
        );
      }
    }
    if (filter.counterparty) {
      q = q.eq("counterparty_name", filter.counterparty);
    }
    if (filter.category === "uncategorised") {
      q = q.is("category_id", null);
    } else if (filter.category) {
      q = q.eq("category_id", filter.category);
    }
    if (filter.account) {
      q = q.eq("account_id", filter.account);
    }
    return q as unknown as T;
  }

  const listQuery = supabase
    .from("transactions")
    .select(
      "id, booking_date, amount, currency, counterparty_name, description, remittance_info, category_id, account_id",
    );

  const countQuery = supabase
    .from("transactions")
    .select("id", { count: "exact", head: true });

  const [
    { data: transactions, error: listErr },
    { count: totalCount },
    { data: categoriesRaw },
    { data: accountsRaw },
  ] = await Promise.all([
    withFilters(listQuery)
      .order(sort, { ascending: dir === "asc" })
      .order("created_at", { ascending: false })
      .limit(PAGE_LIMIT),
    withFilters(countQuery),
    supabase
      .from("categories")
      .select("id, name, kind, color")
      .order("kind")
      .order("sort_order")
      .order("name"),
    supabase
      .from("accounts")
      .select("id, display_name, iban")
      .eq("archived", false)
      .order("display_name"),
  ]);

  const categories = (categoriesRaw ?? []) as CategoryOption[];
  const filterCategories = (categoriesRaw ?? []) as FilterCategory[];
  const accounts = (accountsRaw ?? []) as FilterAccount[];

  const hasAnyFilter =
    !!filter.q || !!filter.counterparty || !!filter.category || !!filter.account;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
        <p className="text-sm text-muted-foreground">
          {hasAnyFilter
            ? `${totalCount ?? 0} matching transaction${totalCount === 1 ? "" : "s"}, showing up to ${PAGE_LIMIT}.`
            : `Latest ${PAGE_LIMIT} booked transactions across all accounts.`}
        </p>
      </div>

      <TransactionsFilters
        initial={filter}
        categories={filterCategories}
        accounts={accounts}
        totalCount={totalCount ?? 0}
      />

      {listErr ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base">Could not load transactions</CardTitle>
            <CardDescription>{listErr.message}</CardDescription>
          </CardHeader>
        </Card>
      ) : transactions?.length ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">
                  <SortLink sort="booking_date" current={{ sort, dir }} params={params}>
                    Date
                  </SortLink>
                </TableHead>
                <TableHead>Counterparty</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">
                  <SortLink
                    sort="amount"
                    current={{ sort, dir }}
                    params={params}
                    align="right"
                  >
                    Amount
                  </SortLink>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => {
                const amount = Number(tx.amount);
                return (
                  <TableRow key={tx.id}>
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
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-emerald-600 dark:text-emerald-400"
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
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {hasAnyFilter ? "No matches" : "No transactions yet"}
            </CardTitle>
            <CardDescription>
              {hasAnyFilter
                ? "Try widening or clearing your filters."
                : "Connect a bank account to start importing transactions."}
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      )}
    </div>
  );
}

/** Clickable column header — toggles the sort dir or switches the sort key. */
function SortLink({
  sort,
  current,
  params,
  align = "left",
  children,
}: {
  sort: SortKey;
  current: { sort: SortKey; dir: SortDir };
  params: SearchParams;
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  const isActive = current.sort === sort;
  const nextDir: SortDir = isActive
    ? current.dir === "desc"
      ? "asc"
      : "desc"
    : "desc"; // first click = desc

  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string" && v) next.set(k, v);
  }
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
