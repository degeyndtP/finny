import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { enableBanking, EnableBankingError } from "@/lib/banking";
import { startBankAuth } from "./actions";

const COUNTRIES = [
  { code: "BE", label: "Belgium" },
  { code: "NL", label: "Netherlands" },
  { code: "FR", label: "France" },
  { code: "DE", label: "Germany" },
  { code: "FI", label: "Finland (sandbox test bank lives here)" },
];

export default async function ConnectBankPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; error?: string }>;
}) {
  const params = await searchParams;
  const country = (params.country ?? "BE").toUpperCase();
  const error = params.error;

  let aspsps: Awaited<ReturnType<typeof enableBanking.listAspsps>> = [];
  let listError: string | null = null;
  try {
    aspsps = await enableBanking.listAspsps(country);
  } catch (e) {
    listError =
      e instanceof EnableBankingError
        ? `Enable Banking ${e.status}: ${typeof e.body === "string" ? e.body : JSON.stringify(e.body)}`
        : (e as Error).message;
  }

  // Filter to ASPSPs that support personal PSU access.
  const personalAspsps = aspsps.filter(
    (a) => !a.psu_types || a.psu_types.includes("personal"),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Connect a bank</h1>
          <p className="text-sm text-muted-foreground">
            Choose your bank to start a PSD2 consent flow. Read-only access — no payments.
          </p>
        </div>
        <Link href="/accounts" className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>

      <form className="flex items-center gap-2 text-sm" method="GET">
        <label htmlFor="country" className="text-muted-foreground">
          Country
        </label>
        <select
          id="country"
          name="country"
          defaultValue={country}
          className="rounded-md border bg-background px-3 py-1.5"
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary" size="sm">
          Update
        </Button>
      </form>

      {error ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base">Could not start the consent flow</CardTitle>
            <CardDescription className="break-words">{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {listError ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base">Could not list banks</CardTitle>
            <CardDescription className="break-words">{listError}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Check that <code>ENABLE_BANKING_APP_ID</code> matches the registered
            application and that <code>keys/enablebanking_private.pem</code>
            is the matching private key.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {personalAspsps.map((aspsp) => (
            <Card key={`${aspsp.name}-${aspsp.country}`} className="flex flex-col">
              <CardHeader className="flex-row items-center gap-3 space-y-0">
                {aspsp.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={aspsp.logo}
                    alt=""
                    className="size-9 rounded-md bg-muted object-contain p-1"
                  />
                ) : (
                  <div className="size-9 rounded-md bg-muted" />
                )}
                <div className="min-w-0">
                  <CardTitle className="text-sm leading-tight truncate">
                    {aspsp.name}
                  </CardTitle>
                  {aspsp.beta ? (
                    <CardDescription className="text-xs">beta</CardDescription>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="mt-auto pt-0">
                <form action={startBankAuth}>
                  <input type="hidden" name="aspsp_name" value={aspsp.name} />
                  <input type="hidden" name="country" value={aspsp.country} />
                  <Button type="submit" size="sm" className="w-full">
                    Connect
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))}
          {personalAspsps.length === 0 && !listError ? (
            <p className="text-sm text-muted-foreground">
              No banks supporting personal PSU access found for {country}.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
