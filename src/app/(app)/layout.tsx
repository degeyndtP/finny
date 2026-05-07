import { redirect } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { UserMenu } from "@/components/user-menu";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/transactions", label: "Transactions" },
  { href: "/cashflow", label: "Cashflow" },
  { href: "/accounts", label: "Accounts" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link href="/" className="font-semibold tracking-tight">
            Finny
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto">
            <UserMenu email={user.email ?? ""} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
