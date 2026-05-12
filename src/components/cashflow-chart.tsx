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

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
      <AreaChart data={data} margin={{ left: 12, right: 12, top: 16, bottom: 0 }}>
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
          domain={[
            (dataMin: number) =>
              dataMin >= 0 ? Math.floor(dataMin * 0.95) : Math.floor(dataMin * 1.05),
            (dataMax: number) =>
              dataMax >= 0 ? Math.ceil(dataMax * 1.08) : Math.ceil(dataMax * 0.92),
          ]}
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
