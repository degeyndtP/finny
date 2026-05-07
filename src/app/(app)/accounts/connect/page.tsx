import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ConnectBankPage() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Bank connection flow — next phase</CardTitle>
          <CardDescription>
            The PSD2 consent flow with GoCardless lands in the next iteration.
            It will: list institutions for your country, create a requisition,
            redirect you to the bank, and on return persist accounts +
            transactions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/accounts" className={buttonVariants({ variant: "outline" })}>
            Back to accounts
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
