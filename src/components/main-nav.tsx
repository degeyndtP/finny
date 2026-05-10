"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  /**
   * Optional path used for active-state matching. Defaults to `href`.
   * Useful when the link points at a sub-page (e.g. /settings/categories)
   * but should still appear active for the whole section (e.g. /settings/*).
   */
  match?: string;
}

function isActive(pathname: string, item: NavItem): boolean {
  const m = item.match ?? item.href;
  if (m === "/") return pathname === "/";
  return pathname === m || pathname.startsWith(`${m}/`);
}

export function MainNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-0.5 text-sm">
      {items.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            prefetch
            className={cn(
              "rounded-md px-3 py-1.5 transition-colors",
              active
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
