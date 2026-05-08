// =============================================================================
// Pure helpers for cashflow analytics — no React, no Supabase.
// Lives outside src/lib/banking so it can be reused by future workers/cron.
// =============================================================================

export interface MinTx {
  booking_date: string; // YYYY-MM-DD
  amount: number;
  counterparty_name: string | null;
  counterparty_iban: string | null;
  category_id: string | null;
  is_internal_transfer: boolean;
}

export type Granularity = "day" | "week" | "month";

export interface Bucket {
  /** ISO key — `YYYY-MM-DD` for day/week (week = Monday), `YYYY-MM` for month. */
  key: string;
  /** Human label for axis ticks. */
  label: string;
  income: number;
  expense: number; // stored as positive magnitude
  net: number; // signed
}

export interface CategorySum {
  category_id: string | null; // null = uncategorised
  total: number; // signed: income > 0, expense < 0
}

export interface CounterpartySum {
  /** display key — counterparty_name, falls back to iban, else "(unknown)". */
  key: string;
  total: number; // signed
  count: number;
}

/**
 * Pick a sensible bucket size given the date span.
 *  ≤ 45 days → daily
 *  ≤ 6 months → weekly
 *  else → monthly
 */
export function pickGranularity(fromIso: string, toIso: string): Granularity {
  const days = Math.max(
    1,
    Math.round(
      (new Date(toIso).getTime() - new Date(fromIso).getTime()) /
        (24 * 60 * 60 * 1000),
    ) + 1,
  );
  if (days <= 45) return "day";
  if (days <= 186) return "week"; // ~6 months
  return "month";
}

function startOfIsoWeek(d: Date): Date {
  // Monday-based week. JS Sunday=0 .. Saturday=6.
  const day = d.getDay();
  const diff = (day + 6) % 7; // distance back to Monday
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
  return r;
}

function bucketKey(date: string, granularity: Granularity): string {
  if (granularity === "day") return date;
  const d = new Date(date);
  if (granularity === "week") {
    const monday = startOfIsoWeek(d);
    return monday.toISOString().slice(0, 10);
  }
  // month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function bucketLabel(
  key: string,
  granularity: Granularity,
  locale = "nl-BE",
): string {
  if (granularity === "month") {
    const [y, m] = key.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString(locale, { month: "short", year: "2-digit" });
  }
  const d = new Date(key);
  if (granularity === "week") {
    return d.toLocaleDateString(locale, { day: "2-digit", month: "short" });
  }
  return d.toLocaleDateString(locale, { day: "2-digit", month: "short" });
}

/**
 * Aggregate transactions into time buckets within [fromIso, toIso].
 * Empty buckets are filled with zeros so the chart has a continuous axis.
 */
export function bucketTransactions(
  txs: MinTx[],
  opts: {
    fromIso: string;
    toIso: string;
    granularity?: Granularity;
    locale?: string;
  },
): { buckets: Bucket[]; granularity: Granularity } {
  const granularity = opts.granularity ?? pickGranularity(opts.fromIso, opts.toIso);
  const map = new Map<string, Bucket>();

  // Pre-seed empty buckets across the range.
  const start = new Date(opts.fromIso);
  const end = new Date(opts.toIso);
  if (granularity === "day") {
    for (let t = start.getTime(); t <= end.getTime(); t += 24 * 60 * 60 * 1000) {
      const iso = new Date(t).toISOString().slice(0, 10);
      map.set(iso, {
        key: iso,
        label: bucketLabel(iso, "day", opts.locale),
        income: 0,
        expense: 0,
        net: 0,
      });
    }
  } else if (granularity === "week") {
    let cursor = startOfIsoWeek(start);
    const stop = end.getTime();
    while (cursor.getTime() <= stop) {
      const iso = cursor.toISOString().slice(0, 10);
      map.set(iso, {
        key: iso,
        label: bucketLabel(iso, "week", opts.locale),
        income: 0,
        expense: 0,
        net: 0,
      });
      cursor = new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  } else {
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const stopY = end.getFullYear();
    const stopM = end.getMonth();
    while (
      cursor.getFullYear() < stopY ||
      (cursor.getFullYear() === stopY && cursor.getMonth() <= stopM)
    ) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      map.set(key, {
        key,
        label: bucketLabel(key, "month", opts.locale),
        income: 0,
        expense: 0,
        net: 0,
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  }

  for (const tx of txs) {
    if (tx.is_internal_transfer) continue;
    const key = bucketKey(tx.booking_date, granularity);
    const b = map.get(key);
    if (!b) continue;
    const amount = Number(tx.amount);
    if (amount >= 0) b.income += amount;
    else b.expense += -amount;
    b.net += amount;
  }

  const buckets = Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  return { buckets, granularity };
}

/** Sum totals for the whole period: income, expense (positive magnitude), net. */
export function periodTotals(txs: MinTx[]): {
  income: number;
  expense: number;
  net: number;
} {
  let income = 0;
  let expense = 0;
  for (const tx of txs) {
    if (tx.is_internal_transfer) continue;
    const a = Number(tx.amount);
    if (a >= 0) income += a;
    else expense += -a;
  }
  return { income, expense, net: income - expense };
}

/** Sum signed amounts grouped by category_id (null = uncategorised). */
export function totalsByCategory(txs: MinTx[]): CategorySum[] {
  const map = new Map<string | null, number>();
  for (const tx of txs) {
    if (tx.is_internal_transfer) continue;
    const a = Number(tx.amount);
    map.set(tx.category_id, (map.get(tx.category_id) ?? 0) + a);
  }
  return Array.from(map.entries()).map(([category_id, total]) => ({
    category_id,
    total,
  }));
}

/**
 * Group by counterparty_name (falls back to iban, then `(unknown)`).
 * Returns rows sorted by absolute amount desc.
 */
export function totalsByCounterparty(txs: MinTx[]): CounterpartySum[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const tx of txs) {
    if (tx.is_internal_transfer) continue;
    const key =
      tx.counterparty_name?.trim() ||
      tx.counterparty_iban?.trim() ||
      "(unknown)";
    const cur = map.get(key) ?? { total: 0, count: 0 };
    cur.total += Number(tx.amount);
    cur.count += 1;
    map.set(key, cur);
  }
  const out = Array.from(map.entries()).map(([key, v]) => ({
    key,
    total: v.total,
    count: v.count,
  }));
  out.sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  return out;
}
