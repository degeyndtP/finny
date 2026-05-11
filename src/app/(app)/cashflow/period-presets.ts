// Pure helpers — no React, no client-only deps. Safe to import from both
// the server component (page.tsx) and the client period selector.

export type Preset =
  | "this_week"
  | "last_week"
  | "mtd"
  | "last_month"
  | "last30"
  | "last365"
  | "this_quarter"
  | "last_quarter"
  | "ytd"
  | "lastyear"
  | "custom";

export const PRESETS: { id: Preset; label: string }[] = [
  { id: "this_week", label: "This week" },
  { id: "last_week", label: "Last week" },
  { id: "mtd", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "last30", label: "Last 30 days" },
  { id: "this_quarter", label: "This quarter" },
  { id: "last_quarter", label: "Last quarter" },
  { id: "ytd", label: "Year to date" },
  { id: "last365", label: "Last 365 days" },
  { id: "lastyear", label: "Last year" },
  { id: "custom", label: "Custom" },
];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Monday-based week boundaries for a given date. */
function startOfIsoWeek(d: Date): Date {
  const day = d.getDay();
  const diff = (day + 6) % 7; // distance back to Monday
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
}

/** First day of the quarter that contains `d`. */
function startOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1);
}

/** Last day of the quarter that contains `d`. */
function endOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3 + 3, 0);
}

/**
 * Given a non-custom preset id, return the [from, to] ISO dates.
 */
export function rangeForPreset(preset: Exclude<Preset, "custom">): {
  from: string;
  to: string;
} {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case "this_week": {
      const mon = startOfIsoWeek(today);
      return { from: isoDate(mon), to: isoDate(today) };
    }
    case "last_week": {
      const mon = startOfIsoWeek(today);
      const lastMon = new Date(mon.getTime() - 7 * 24 * 60 * 60 * 1000);
      const lastSun = new Date(mon.getTime() - 24 * 60 * 60 * 1000);
      return { from: isoDate(lastMon), to: isoDate(lastSun) };
    }
    case "mtd":
      return {
        from: isoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
        to: isoDate(today),
      };
    case "last_month": {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: isoDate(first), to: isoDate(last) };
    }
    case "last30":
      return {
        from: isoDate(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)),
        to: isoDate(today),
      };
    case "last365":
      return {
        from: isoDate(new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000)),
        to: isoDate(today),
      };
    case "this_quarter":
      return {
        from: isoDate(startOfQuarter(today)),
        to: isoDate(today),
      };
    case "last_quarter": {
      const startThis = startOfQuarter(today);
      const startLast = new Date(startThis.getFullYear(), startThis.getMonth() - 3, 1);
      const endLast = endOfQuarter(startLast);
      return { from: isoDate(startLast), to: isoDate(endLast) };
    }
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
  const candidates: Exclude<Preset, "custom">[] = [
    "this_week",
    "last_week",
    "mtd",
    "last_month",
    "last30",
    "last365",
    "this_quarter",
    "last_quarter",
    "ytd",
    "lastyear",
  ];
  for (const p of candidates) {
    const r = rangeForPreset(p);
    if (r.from === from && r.to === to) return p;
  }
  return "custom";
}

/**
 * Prior period for delta KPIs — always "the same range, one year earlier".
 *
 * Shifting by exactly one year (calendar) keeps the comparison
 * semantically clean: "How is this MTD vs the same days last year?",
 * "How is Q2 this year vs Q2 last year?", "How is last week vs the same
 * week last year?". Falls back to a day-offset for Feb 29 edge cases
 * by relying on JS's Date(year, month, day) overflow handling.
 */
export function priorPeriod(
  fromIso: string,
  toIso: string,
): { from: string; to: string; label: string } {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const priorFrom = new Date(from.getFullYear() - 1, from.getMonth(), from.getDate());
  const priorTo = new Date(to.getFullYear() - 1, to.getMonth(), to.getDate());
  return {
    from: isoDate(priorFrom),
    to: isoDate(priorTo),
    label: "same range, last year",
  };
}
