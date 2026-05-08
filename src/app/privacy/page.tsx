import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy — Finny",
  description: "How Finny handles your bank data.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:mb-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3 [&_p]:my-3 [&_p]:leading-7 [&_p]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_ul]:text-muted-foreground [&_li]:leading-7 [&_a]:underline [&_a]:underline-offset-2">
      <h1>Privacy</h1>

      <p>
        Finny is a personal-use application. It is operated by Pieter De Geyndt
        and used solely by the registered user (single-tenant, restricted-mode
        Enable Banking application).
      </p>

      <h2>What data we process</h2>
      <ul>
        <li>
          <strong>Account information</strong> retrieved from your bank via
          Enable Banking under PSD2: account identifier (IBAN), account name,
          balance, and booked transactions (counterparty, amount, dates,
          remittance information).
        </li>
        <li>
          <strong>Authentication data</strong>: your email address, used by
          Supabase Auth to send a magic-link sign-in.
        </li>
      </ul>

      <h2>Where data is stored</h2>
      <p>
        Account and transaction data is persisted to a private Supabase Postgres
        database in the EU region. Row Level Security ensures only the
        authenticated user can read their own household&apos;s data.
      </p>

      <h2>Who has access</h2>
      <p>
        Only the registered user. There are no third-party recipients. Enable
        Banking acts as the licensed PSD2 Account Information Service Provider
        (AISP) that intermediates the bank connection; their privacy notice
        applies to that processing role.
      </p>

      <h2>Retention</h2>
      <p>
        Data is kept for as long as the application is in use. You can revoke
        the bank consent at your bank or in Finny at any time, and you can
        delete the underlying records by removing the Supabase project.
      </p>

      <h2>Contact</h2>
      <p>
        Data protection contact:{" "}
        <a href="mailto:pieter.degeyndt@icloud.com">
          pieter.degeyndt@icloud.com
        </a>
        .
      </p>
    </main>
  );
}
