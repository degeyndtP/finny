"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Preset = "mtd" | "last30" | "ytd" | "lastyear" | "custom";

const PRESETS: { id: Preset; label: string }[] = [
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
 * Given a preset id, return the [from, to] dates (inclusive ISO strings).
 * Today's date is the upper bound for everything except `lastyear`.
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
 * Inverse: figure out which preset matches the current from/to (if any)
 * so we can highlight the active button.
 */
function matchPreset(from: string, to: string): Preset {
  for (const p of ["mtd", "last30", "ytd", "lastyear"] as const) {
    const r = rangeForPreset(p);
    if (r.from === from && r.to === to) return p;
  }
  return "custom";
}

interface Props {
  from: string;
  to: string;
}

export function PeriodSelector({ from, to }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);

  const active = matchPreset(from, to);

  function pushRange(nextFrom: string, nextTo: string) {
    const params = new URLSearchParams(searchParams);
    params.set("from", nextFrom);
    params.set("to", nextTo);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function applyPreset(p: Preset) {
    if (p === "custom") return; // requires inputs
    const r = rangeForPreset(p);
    pushRange(r.from, r.to);
  }

  function applyCustom(e: React.FormEvent) {
    e.preventDefault();
    if (!customFrom || !customTo) return;
    if (customFrom > customTo) return;
    pushRange(customFrom, customTo);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p.id}
            type="button"
            size="sm"
            variant={active === p.id ? "default" : "outline"}
            onClick={() => applyPreset(p.id)}
            disabled={pending}
          >
            {p.label}
          </Button>
        ))}
      </div>
      {active === "custom" ? (
        <form
          onSubmit={applyCustom}
          className="flex flex-wrap items-end gap-2 rounded-md border p-3"
        >
          <div className="space-y-1">
            <Label htmlFor="period-from" className="text-xs">From</Label>
            <Input
              id="period-from"
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              max={customTo}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="period-to" className="text-xs">To</Label>
            <Input
              id="period-to"
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              min={customFrom}
              className="w-40"
            />
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            Apply
          </Button>
        </form>
      ) : null}
    </div>
  );
}
