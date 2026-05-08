import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms — Finny",
  description: "Terms of use for Finny.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:mb-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3 [&_p]:my-3 [&_p]:leading-7 [&_p]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_ul]:text-muted-foreground [&_li]:leading-7 [&_a]:underline [&_a]:underline-offset-2">
      <h1>Terms</h1>

      <p>
        Finny is provided as-is for personal use by its registered user
        (single-tenant). It is not a commercial service and is not made
        available to the public.
      </p>

      <h2>Service scope</h2>
      <ul>
        <li>
          Read-only access to bank accounts via the PSD2 Account Information
          Service, intermediated by Enable Banking (the licensed AISP).
        </li>
        <li>No payment initiation. No data sharing with third parties.</li>
      </ul>

      <h2>Use restrictions</h2>
      <p>
        The application operates in Enable Banking&apos;s restricted production
        mode and accepts consents only for accounts owned by the registered
        user.
      </p>

      <h2>No warranty</h2>
      <p>
        Data freshness and availability depend on the bank&apos;s PSD2 APIs and
        Enable Banking&apos;s service. Finny makes no guarantee of uptime,
        accuracy, or fitness for any particular purpose.
      </p>

      <h2>Liability</h2>
      <p>
        Use of Finny is at your own risk. The operator is not liable for any
        damages arising from use, misuse, or unavailability of the service.
      </p>

      <h2>Contact</h2>
      <p>
        <a href="mailto:pieter.degeyndt@icloud.com">
          pieter.degeyndt@icloud.com
        </a>
      </p>
    </main>
  );
}
