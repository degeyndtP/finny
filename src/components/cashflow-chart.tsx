"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export interface CashflowPoint {
  /** ISO date `YYYY-MM-DD` */
  date: string;
  balance: number;
}

const chartConfig = {
  balance: {
    label: "Balance",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

interface Props {
  data: CashflowPoint[];
  currency: string;
  locale?: string;
}

export function CashflowChart({ data, currency, locale = "nl-BE" }: Props) {
  const moneyShort = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  });

  const dateShort = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { day: "2-digit", month: "short" });

  // Range-based Y-axis padding: 8% top / 8% bottom of the visible range.
  // Multiplicative padding on dataMin alone looks fine for big balances but
  // collapses to nothing when the low point is near zero.
  const values = data.map((d) => d.balance);
  const lo = values.length ? Math.min(...values) : 0;
  const hi = values.length ? Math.max(...values) : 1;
  const range = hi - lo || Math.abs(hi) || 1;
  const yDomain: [number, number] = [
    Math.floor(lo - range * 0.08),
    Math.ceil(hi + range * 0.08),
  ];

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
      <AreaChart data={data} margin={{ left: 12, right: 12, top: 16, bottom: 8 }}>
        <defs>
          <linearGradient id="cashflowFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-balance)" stopOpacity={0.4} />
            <stop offset="95%" stopColor="var(--color-balance)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={32}
          tickFormatter={dateShort}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={60}
          tickFormatter={(v: number) => moneyShort.format(v)}
          domain={yDomain}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              indicator="line"
              labelFormatter={(label) => dateShort(label as string)}
              formatter={(value) => (
                <span className="tabular-nums">
                  {new Intl.NumberFormat(locale, {
                    style: "currency",
                    currency,
                  }).format(Number(value))}
                </span>
              )}
            />
          }
        />
        <Area
          dataKey="balance"
          type="natural"
          stroke="var(--color-balance)"
          strokeWidth={2}
          fill="url(#cashflowFill)"
        />
      </AreaChart>
    </ChartContainer>
  );
}
