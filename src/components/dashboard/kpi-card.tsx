"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { motion } from "motion/react";
import { useMemo } from "react";

import { AreaChart, Area } from "@/components/charts/area-chart";
import { chartCssVars } from "@/components/charts/chart-context";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatSignedPercent } from "@/lib/format";

import { AnimatedNumber } from "./animated-number";
import { fadeUp } from "./motion";

export type KpiData = {
  value: number | null;
  change: number | null;
  /** Daily values for the sparkline, oldest first. */
  trend: { date: Date; value: number }[];
};

// Keeps touch scrolling working over charts (Bklit sets touch-action: none).
const SCROLLABLE: React.CSSProperties = { touchAction: "pan-y" };

export type Comparison = { kind: "previous" | "since"; label: string };

function Delta({ change, comparison }: { change: number | null; comparison: Comparison }) {
  // No previous period (all time): just say where the numbers start.
  if (comparison.kind === "since") {
    return <p className="text-xs text-muted-foreground">{comparison.label}</p>;
  }
  if (change === null) {
    return <p className="text-xs text-muted-foreground">Sem base de comparação</p>;
  }
  const direction = change > 0 ? "up" : change < 0 ? "down" : "flat";
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;
  const tone =
    direction === "up" ? "text-emerald-400" : direction === "down" ? "text-red-400" : "text-muted-foreground";
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-xs">
      <span className={`inline-flex items-center gap-0.5 font-medium tabular-nums ${tone}`}>
        <Icon className="size-3.5" aria-hidden />
        {formatSignedPercent(change)}
      </span>
      <span className="text-muted-foreground">{comparison.label}</span>
    </p>
  );
}

export function KpiCard({
  label,
  data,
  format,
  comparison,
}: {
  label: string;
  data: KpiData | null;
  format: (value: number) => string;
  /** "vs 7 dias anteriores" / "vs dia anterior", or "desde 12/08/2026" when there's no previous period. */
  comparison: Comparison;
}) {
  const trend = useMemo(() => data?.trend ?? [], [data]);

  return (
    <motion.div variants={fadeUp}>
      <Card size="sm" className="h-full gap-2">
        <CardContent className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          {data ? (
            <>
              <p className="text-xl font-semibold tracking-tight sm:text-2xl">
                {data.value === null ? "—" : <AnimatedNumber value={data.value} format={format} />}
              </p>
              <Delta change={data.change} comparison={comparison} />
            </>
          ) : (
            <>
              <Skeleton className="h-7 w-28 sm:h-8" />
              <Skeleton className="h-4 w-36" />
            </>
          )}
        </CardContent>
        <div className="h-10 px-1" aria-hidden>
          {trend.length > 1 ? (
            <AreaChart
              data={trend}
              aspectRatio="auto"
              className="h-full"
              style={SCROLLABLE}
              margin={{ top: 4, right: 0, bottom: 2, left: 0 }}
              animationDuration={900}
            >
              <Area
                dataKey="value"
                fill={chartCssVars.linePrimary}
                fillOpacity={0.25}
                strokeWidth={1.5}
                showHighlight={false}
              />
            </AreaChart>
          ) : data ? null : (
            // A single day has no trend to draw; only show the placeholder while loading.
            <Skeleton className="h-full w-full rounded-sm opacity-50" />
          )}
        </div>
      </Card>
    </motion.div>
  );
}
