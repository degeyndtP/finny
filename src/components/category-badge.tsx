interface Props {
  name: string;
  color?: string | null;
  /** Render as a smaller variant — useful inside compact triggers. */
  size?: "default" | "sm";
}

/**
 * Small "status pill" used wherever we want to display a category by name +
 * its colour (transaction table cell, plan rows, filters, etc.). Uses the
 * category colour as a soft tint behind a normal-contrast label so it stays
 * legible across light / dark themes.
 */
export function CategoryBadge({ name, color, size = "default" }: Props) {
  const c = color ?? "#6B7280";
  const sizeClass = size === "sm" ? "px-1.5 py-0 text-[11px]" : "px-2 py-0.5 text-xs";
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 truncate rounded-md border font-medium text-foreground ${sizeClass}`}
      style={{
        backgroundColor: `${c}1A`, // ~10% opacity
        borderColor: `${c}55`,
      }}
    >
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: c }}
      />
      <span className="truncate">{name}</span>
    </span>
  );
}
