"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CashflowError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[/cashflow] error boundary:", error);
  }, [error]);

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle>Something went wrong on this page</CardTitle>
        <CardDescription>
          The Cashflow view crashed while rendering. The error message is below
          — share it if you need help.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
          {error.name}: {error.message}
          {error.digest ? `\n\ndigest: ${error.digest}` : ""}
          {error.stack ? `\n\n${error.stack}` : ""}
        </pre>
        <Button type="button" onClick={reset}>
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}
