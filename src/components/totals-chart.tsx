"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export interface TotalsBucket {
  /** machine key — used by Recharts as dataKey */
  key: string;
  label: string;
  income: number;
  expense: number; // positive magnitude
}

const chartConfig = {
  income: { label: "Income", color: "var(--chart-2)" },
  expense: { label: "Expenses", color: "var(--chart-5)" },
} satisfies ChartConfig;

interface Props {
  data: TotalsBucket[];
  currency: string;
  locale?: string;
}

export function TotalsChart({ data, currency, locale = "nl-BE" }: Props) {
  const moneyShort = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  });
  const moneyExact = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  });

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
      <BarChart data={data} margin={{ left: 12, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={60}
          tickFormatter={(v: number) => moneyShort.format(v)}
        />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", opacity: 0.4 }}
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <div className="flex w-full items-center justify-between gap-3">
                  <span className="capitalize text-muted-foreground">{String(name)}</span>
                  <span className="tabular-nums font-medium">
                    {moneyExact.format(Number(value))}
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar dataKey="income" fill="var(--color-income)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expense" fill="var(--color-expense)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
