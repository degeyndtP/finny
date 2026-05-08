import { redirect } from "next/navigation";
import Link from "next/link";
import { Wallet } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { MainNav, type NavItem } from "@/components/main-nav";
import { UserMenu } from "@/components/user-menu";

const NAV: NavItem[] = [
  { href: "/", label: "Overview" },
  { href: "/transactions", label: "Transactions" },
  { href: "/cashflow", label: "Cashflow" },
  { href: "/accounts", label: "Accounts" },
  { href: "/settings", label: "Settings" },
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
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4">
          <Link
            href="/"
            className="group flex items-center gap-2 transition-opacity hover:opacity-90"
            aria-label="Finny home"
          >
            <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-[var(--chart-1)] to-[var(--chart-3)] text-white shadow-sm">
              <Wallet className="size-4" />
            </span>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
              Finny
            </span>
          </Link>
          <MainNav items={NAV} />
          <div className="ml-auto">
            <UserMenu email={user.email ?? ""} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
