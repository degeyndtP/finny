"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export interface ForecastPoint {
  date: string;
  balance: number;
}

const chartConfig = {
  balance: { label: "Projected balance", color: "var(--chart-3)" },
} satisfies ChartConfig;

interface Props {
  data: ForecastPoint[];
  /** Today's ISO date — drawn as a reference line if inside the range. */
  today: string;
  currency: string;
  locale?: string;
}

export function ForecastChart({ data, today, currency, locale = "nl-BE" }: Props) {
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

  const dateShort = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { day: "2-digit", month: "short" });

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
      <AreaChart data={data} margin={{ left: 12, right: 12, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1">
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
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              indicator="line"
              labelFormatter={(label) => dateShort(label as string)}
              formatter={(value) => (
                <span className="tabular-nums">{moneyExact.format(Number(value))}</span>
              )}
            />
          }
        />
        <ReferenceLine
          x={today}
          stroke="var(--muted-foreground)"
          strokeDasharray="3 3"
          label={{
            value: "today",
            position: "insideTopLeft",
            fill: "var(--muted-foreground)",
            fontSize: 11,
          }}
        />
        <Area
          dataKey="balance"
          type="monotone"
          stroke="var(--color-balance)"
          strokeWidth={2}
          fill="url(#forecastFill)"
        />
      </AreaChart>
    </ChartContainer>
  );
}
