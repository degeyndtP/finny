"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { PRESETS, matchPreset, rangeForPreset, type Preset } from "./period-presets";

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
