// =============================================================================
// Cashflow forecasting
// =============================================================================
// Given a set of planned cashflows (with optional recurrence) and a starting
// balance, produce a daily balance series for charting.
// =============================================================================

export type Recurrence = "none" | "weekly" | "monthly" | "quarterly" | "yearly";

export interface PlannedCashflow {
  id: string;
  description: string;
  amount: number;
  due_date: string; // ISO yyyy-mm-dd
  recurrence: Recurrence;
  recurrence_until: string | null;
}

export interface Occurrence {
  /** ISO yyyy-mm-dd */
  date: string;
  amount: number;
  planned_id: string;
  description: string;
}

const MAX_ITER = 1000;

function advance(d: Date, recurrence: Exclude<Recurrence, "none">): Date {
  const next = new Date(d);
  switch (recurrence) {
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    case "quarterly":
      next.setMonth(next.getMonth() + 3);
      break;
    case "yearly":
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}

function isoOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Generate every occurrence of a planned cashflow within [fromIso, toIso],
 * inclusive. For non-recurring rows we emit at most one entry on `due_date`.
 */
export function generateOccurrences(
  pc: PlannedCashflow,
  fromIso: string,
  toIso: string,
): Occurrence[] {
  const out: Occurrence[] = [];
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const stop = pc.recurrence_until ? new Date(pc.recurrence_until) : to;
  const upper = stop < to ? stop : to;

  let cursor = new Date(pc.due_date);

  // Skip ahead if due_date is before our window.
  if (pc.recurrence !== "none") {
    let safety = 0;
    while (cursor < from && safety++ < MAX_ITER) {
      cursor = advance(cursor, pc.recurrence);
    }
  }

  let safety = 0;
  while (cursor <= upper && safety++ < MAX_ITER) {
    if (cursor >= from) {
      out.push({
        date: isoOf(cursor),
        amount: pc.amount,
        planned_id: pc.id,
        description: pc.description,
      });
    }
    if (pc.recurrence === "none") break;
    cursor = advance(cursor, pc.recurrence);
  }

  return out;
}

export interface ForecastPoint {
  date: string; // ISO yyyy-mm-dd
  balance: number;
}

/**
 * Walk forward day-by-day from `from` to `to`, applying all occurrences and
 * returning a balance at the close of each day.
 */
export function projectBalance(opts: {
  startingBalance: number;
  plans: PlannedCashflow[];
  fromIso: string;
  toIso: string;
}): { points: ForecastPoint[]; occurrences: Occurrence[] } {
  const allOccurrences: Occurrence[] = [];
  for (const p of opts.plans) {
    allOccurrences.push(...generateOccurrences(p, opts.fromIso, opts.toIso));
  }

  const dailyDelta = new Map<string, number>();
  for (const o of allOccurrences) {
    dailyDelta.set(o.date, (dailyDelta.get(o.date) ?? 0) + o.amount);
  }

  const points: ForecastPoint[] = [];
  const start = new Date(opts.fromIso);
  const end = new Date(opts.toIso);
  let bal = opts.startingBalance;
  for (
    let t = start.getTime();
    t <= end.getTime();
    t += 24 * 60 * 60 * 1000
  ) {
    const iso = new Date(t).toISOString().slice(0, 10);
    bal += dailyDelta.get(iso) ?? 0;
    points.push({ date: iso, balance: Math.round(bal * 100) / 100 });
  }

  // Sort occurrences chronologically for any UI list.
  allOccurrences.sort((a, b) => a.date.localeCompare(b.date));

  return { points, occurrences: allOccurrences };
}
