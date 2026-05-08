// =============================================================================
// Recurring transaction detection
// =============================================================================
// Pure helpers — no DB, no React. Operate on transactions plus the list of
// already-saved planned cashflows so we don't suggest patterns the user has
// already accepted.
// =============================================================================

import type { MinTx } from "./cashflow";

export type Cadence = "weekly" | "monthly" | "quarterly" | "yearly";

export interface RecurringPattern {
  /** Lower-case normalised key used to dedupe across casings. */
  key: string;
  /** Original counterparty casing (first occurrence) for display. */
  display: string;
  cadence: Cadence;
  averageAmount: number; // signed (negative = recurring expense)
  occurrences: number;
  lastDate: string; // ISO yyyy-mm-dd
  nextPredicted: string; // ISO yyyy-mm-dd
  /** Most-common category id across the cluster (or null). */
  category_id: string | null;
}

const MIN_OCCURRENCES: Record<Cadence, number> = {
  weekly: 4,
  monthly: 3,
  quarterly: 2,
  yearly: 2,
};

const GAP_RANGES: Record<Cadence, [number, number]> = {
  weekly: [6, 8],
  monthly: [26, 35],
  quarterly: [85, 95],
  yearly: [350, 380],
};

const AMOUNT_TOLERANCE = 0.15; // 15% around median

function normaliseKey(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase();
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function mostCommon<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  const counts = new Map<T, number>();
  for (const it of items) counts.set(it, (counts.get(it) ?? 0) + 1);
  let best: T | null = null;
  let bestN = -1;
  for (const [k, v] of counts) {
    if (v > bestN) {
      bestN = v;
      best = k;
    }
  }
  return best;
}

function dayDiff(aIso: string, bIso: string): number {
  return Math.round(
    (new Date(bIso).getTime() - new Date(aIso).getTime()) /
      (24 * 60 * 60 * 1000),
  );
}

function classifyCadence(gaps: number[]): Cadence | null {
  if (gaps.length === 0) return null;
  const m = median(gaps);
  for (const c of ["weekly", "monthly", "quarterly", "yearly"] as const) {
    const [lo, hi] = GAP_RANGES[c];
    if (m >= lo && m <= hi) return c;
  }
  return null;
}

function predictNext(lastIso: string, cadence: Cadence): string {
  const d = new Date(lastIso);
  switch (cadence) {
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Detect recurring patterns over a window of transactions.
 *
 * Heuristic:
 *   1. Group by counterparty name (case-insensitive).
 *   2. Skip groups with < min occurrences for any cadence.
 *   3. Cluster around the median amount (±15%).
 *   4. Compute pairwise day gaps; classify by median gap.
 *   5. Emit one pattern per (counterparty, amount-cluster) match.
 *
 * The caller supplies `excludeKeys` so already-planned items don't reappear
 * as suggestions.
 */
export function detectRecurring(
  txs: MinTx[],
  opts: { excludeKeys?: Set<string> } = {},
): RecurringPattern[] {
  const groups = new Map<string, MinTx[]>();
  for (const tx of txs) {
    if (tx.is_internal_transfer) continue;
    const key = normaliseKey(tx.counterparty_name);
    if (!key) continue;
    const arr = groups.get(key) ?? [];
    arr.push(tx);
    groups.set(key, arr);
  }

  const out: RecurringPattern[] = [];
  for (const [key, group] of groups) {
    if (opts.excludeKeys?.has(key)) continue;

    // Need enough occurrences to classify ANY cadence.
    if (group.length < MIN_OCCURRENCES.monthly) continue;

    // Cluster around median amount.
    const amounts = group.map((t) => Number(t.amount));
    const med = median(amounts);
    const tolerance = Math.max(Math.abs(med) * AMOUNT_TOLERANCE, 1); // €1 floor for tiny numbers
    const cluster = group.filter(
      (t) => Math.abs(Number(t.amount) - med) <= tolerance,
    );
    if (cluster.length < MIN_OCCURRENCES.monthly) continue;

    // Sort by date and compute gaps.
    cluster.sort((a, b) => a.booking_date.localeCompare(b.booking_date));
    const gaps: number[] = [];
    for (let i = 1; i < cluster.length; i++) {
      gaps.push(dayDiff(cluster[i - 1].booking_date, cluster[i].booking_date));
    }
    const cadence = classifyCadence(gaps);
    if (!cadence) continue;
    if (cluster.length < MIN_OCCURRENCES[cadence]) continue;

    const avgAmount =
      cluster.reduce((s, t) => s + Number(t.amount), 0) / cluster.length;
    const lastDate = cluster[cluster.length - 1].booking_date;
    const display =
      group.find((t) => normaliseKey(t.counterparty_name) === key)
        ?.counterparty_name ?? key;
    const categoryId = mostCommon(
      cluster.map((t) => t.category_id).filter((c): c is string => !!c),
    );

    out.push({
      key,
      display,
      cadence,
      averageAmount: avgAmount,
      occurrences: cluster.length,
      lastDate,
      nextPredicted: predictNext(lastDate, cadence),
      category_id: categoryId,
    });
  }

  // Largest absolute amount first — bills first, dribbles later.
  out.sort((a, b) => Math.abs(b.averageAmount) - Math.abs(a.averageAmount));
  return out;
}
