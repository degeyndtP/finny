import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CashflowPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cashflow planning</h1>
        <p className="text-sm text-muted-foreground">
          Forecast your runway based on real transactions and planned items.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Coming up</CardTitle>
          <CardDescription>
            We&apos;ll project your balance using booked transactions, recurring
            patterns we detect, and any planned cashflows you add.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          This view becomes useful once you have at least a few weeks of
          transaction history. Connect a bank to get started.
        </CardContent>
      </Card>
    </div>
  );
}
