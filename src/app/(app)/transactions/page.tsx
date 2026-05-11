import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { type CategoryOption } from "./category-cell";
import {
  TransactionsFilters,
  type FilterAccount,
  type FilterCategory,
} from "./transactions-filters";
import {
  TransactionsTable,
  type SortDir,
  type SortKey,
} from "./transactions-table";

const PAGE_LIMIT = 200;

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
        <TransactionsTable
          transactions={transactions}
          categories={categories}
          sort={sort}
          dir={dir}
        />
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
