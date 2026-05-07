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

export default async function TransactionsPage() {
  const supabase = await createClient();

  const [{ data: transactions }, { data: categories }] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "id, booking_date, amount, currency, counterparty_name, description, remittance_info, category_id",
      )
      .order("booking_date", { ascending: false })
      .limit(100),
    supabase.from("categories").select("id, name, color"),
  ]);

  const categoryById = new Map(categories?.map((c) => [c.id, c]) ?? []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
        <p className="text-sm text-muted-foreground">
          Latest 100 booked transactions across all accounts.
        </p>
      </div>

      {transactions?.length ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Date</TableHead>
                <TableHead>Counterparty</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => {
                const amount = Number(tx.amount);
                const cat = tx.category_id ? categoryById.get(tx.category_id) : null;
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
                    <TableCell>{cat?.name ?? "—"}</TableCell>
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
            <CardTitle>No transactions yet</CardTitle>
            <CardDescription>
              Connect a bank account to start importing transactions.
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      )}
    </div>
  );
}
