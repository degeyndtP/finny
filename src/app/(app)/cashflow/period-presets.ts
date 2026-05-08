// Pure helpers — no React, no client-only deps. Safe to import from both
// the server component (page.tsx) and the client period selector.

export type Preset = "mtd" | "last30" | "ytd" | "lastyear" | "custom";

export const PRESETS: { id: Preset; label: string }[] = [
  { id: "mtd", label: "This month" },
  { id: "last30", label: "Last 30 days" },
  { id: "ytd", label: "Year to date" },
  { id: "lastyear", label: "Last year" },
  { id: "custom", label: "Custom" },
];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Given a non-custom preset id, return the [from, to] ISO dates.
 * Today is the upper bound for everything except `lastyear`.
 */
export function rangeForPreset(preset: Exclude<Preset, "custom">): {
  from: string;
  to: string;
} {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (preset) {
    case "mtd":
      return {
        from: isoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
        to: isoDate(today),
      };
    case "last30":
      return {
        from: isoDate(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)),
        to: isoDate(today),
      };
    case "ytd":
      return {
        from: isoDate(new Date(today.getFullYear(), 0, 1)),
        to: isoDate(today),
      };
    case "lastyear":
      return {
        from: isoDate(new Date(today.getFullYear() - 1, 0, 1)),
        to: isoDate(new Date(today.getFullYear() - 1, 11, 31)),
      };
  }
}

/**
 * Inverse: figure out which preset matches the given from/to (or "custom"
 * if none does). Used by the selector to highlight the active button.
 */
export function matchPreset(from: string, to: string): Preset {
  for (const p of ["mtd", "last30", "ytd", "lastyear"] as const) {
    const r = rangeForPreset(p);
    if (r.from === from && r.to === to) return p;
  }
  return "custom";
}

/**
 * For a given period, return the "prior equivalent" range so we can compute
 * a vs-prior delta on KPIs.
 *
 *   mtd       → same day-of-month range last month
 *   ytd       → Jan 1 to (today, last year)
 *   lastyear  → year before last year
 *   last30    → 30 days before the current 30-day window
 *   custom    → shift the entire range back by its own length
 */
export function priorPeriod(
  fromIso: string,
  toIso: string,
): { from: string; to: string; label: string } {
  const preset = matchPreset(fromIso, toIso);
  const from = new Date(fromIso);
  const to = new Date(toIso);

  if (preset === "mtd") {
    const priorFrom = new Date(from.getFullYear(), from.getMonth() - 1, from.getDate());
    const priorTo = new Date(to.getFullYear(), to.getMonth() - 1, to.getDate());
    return { from: isoDate(priorFrom), to: isoDate(priorTo), label: "previous month, same range" };
  }

  if (preset === "ytd") {
    const priorFrom = new Date(from.getFullYear() - 1, 0, 1);
    const priorTo = new Date(to.getFullYear() - 1, to.getMonth(), to.getDate());
    return { from: isoDate(priorFrom), to: isoDate(priorTo), label: "same range, last year" };
  }

  if (preset === "lastyear") {
    const priorFrom = new Date(from.getFullYear() - 1, 0, 1);
    const priorTo = new Date(from.getFullYear() - 1, 11, 31);
    return { from: isoDate(priorFrom), to: isoDate(priorTo), label: "the year before" };
  }

  // last30 or custom → shift back by the period's own length.
  const oneDay = 24 * 60 * 60 * 1000;
  const lengthDays = Math.floor((to.getTime() - from.getTime()) / oneDay) + 1;
  const priorTo = new Date(from.getTime() - oneDay);
  const priorFrom = new Date(priorTo.getTime() - (lengthDays - 1) * oneDay);
  return {
    from: isoDate(priorFrom),
    to: isoDate(priorTo),
    label: `previous ${lengthDays} days`,
  };
}
