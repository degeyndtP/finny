import Link from "next/link";

const SUB_NAV = [
  { href: "/settings/categories", label: "Categories" },
  { href: "/settings/rules", label: "Rules" },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Categorise spending and teach Finny how to auto-tag future imports.
        </p>
      </div>
      <nav className="flex gap-4 border-b text-sm">
        {SUB_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="-mb-px border-b-2 border-transparent py-2 text-muted-foreground hover:border-border hover:text-foreground transition-colors aria-[current=page]:border-foreground aria-[current=page]:text-foreground"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
