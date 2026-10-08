"use client";

import { motion } from "motion/react";
import { useCallback, useMemo, type ReactNode } from "react";

import { AreaChart, Area } from "@/components/charts/area-chart";
import { Bar } from "@/components/charts/bar";
import { BarChart } from "@/components/charts/bar-chart";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { chartCssVars } from "@/components/charts/chart-context";
import { FunnelChart } from "@/components/charts/funnel-chart";
import { Grid } from "@/components/charts/grid";
import { Legend, LegendItem, LegendLabel, LegendMarker, LegendValue } from "@/components/charts/legend";
import { ChartTooltip, TooltipContent } from "@/components/charts/tooltip";
import { XAxis } from "@/components/charts/x-axis";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsWide } from "@/hooks/use-is-wide";
import { GRANULARITY_LABELS, type Bucket, type Granularity } from "@/lib/buckets";
import { formatCurrency, formatInteger, formatPercent } from "@/lib/format";

import { fadeUp } from "./motion";

export type ChartRow = Pick<Bucket, "date" | "label" | "title" | "itemsAddedToCart" | "itemsPurchased" | "itemRevenue">;

type ChartStatus = "loading" | "ready";

// Keeps touch scrolling working over charts (Bklit sets touch-action: none).
const SCROLLABLE: React.CSSProperties = { touchAction: "pan-y" };
export const CART_COLOR = chartCssVars.lineSecondary;
export const CHECKOUT_COLOR = `color-mix(in oklch, ${chartCssVars.lineSecondary}, white 30%)`;
export const SOLD_COLOR = chartCssVars.linePrimary;

export function ChartCard({
  title,
  description,
  action,
  className,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <motion.div variants={fadeUp} className={className}>
      <Card className="h-full">
        <CardHeader className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="grid gap-1">
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {action}
        </CardHeader>
        <CardContent className="flex-1">{children}</CardContent>
      </Card>
    </motion.div>
  );
}

export function CartVsSalesChart({
  data,
  granularity,
  totals,
  status,
}: {
  data: ChartRow[];
  granularity: Granularity;
  totals: { itemsAddedToCart: number; itemsPurchased: number } | null;
  status: ChartStatus;
}) {
  const wide = useIsWide();
  // Weeks and months get their own labels ("12/05/25", "mai/25"); days keep Bklit's dd/mm.
  const labelByTime = useMemo(() => new Map(data.map((row) => [row.date.getTime(), row.label])), [data]);
  const formatXLabel = useCallback(
    (date: Date) => labelByTime.get(date.getTime()) ?? date.toLocaleDateString("pt-BR"),
    [labelByTime],
  );
  const rows = (point: Record<string, unknown>) => [
    { color: CART_COLOR, label: "Adições ao carrinho", value: formatInteger(Number(point.itemsAddedToCart)) },
    { color: SOLD_COLOR, label: "Ingressos vendidos", value: formatInteger(Number(point.itemsPurchased)) },
  ];
  const legendItems = [
    { label: "Adições ao carrinho", value: totals?.itemsAddedToCart ?? 0, color: CART_COLOR },
    { label: "Ingressos vendidos", value: totals?.itemsPurchased ?? 0, color: SOLD_COLOR },
  ];

  return (
    <ChartCard
      title="Adições ao carrinho × Ingressos vendidos"
      description={GRANULARITY_LABELS[granularity].per}
      className="lg:col-span-2"
      action={
        <Legend items={legendItems} className="flex-row flex-wrap gap-x-4 gap-y-1">
          <LegendItem className="flex items-center gap-2">
            <LegendMarker />
            <LegendLabel className="text-xs text-muted-foreground" />
            <LegendValue className="text-xs font-medium tabular-nums" formatValue={formatInteger} />
          </LegendItem>
        </Legend>
      }
    >
      <AreaChart
        data={data}
        status={status}
        aspectRatio="auto"
        className="h-56 sm:h-64"
        style={SCROLLABLE}
        margin={{ top: 16, right: 12, bottom: 32, left: 12 }}
        formatXLabel={granularity === "day" ? undefined : formatXLabel}
      >
        <Grid horizontal strokeDasharray="0" />
        <Area dataKey="itemsAddedToCart" fill={CART_COLOR} fillOpacity={0.18} />
        <Area dataKey="itemsPurchased" fill={SOLD_COLOR} fillOpacity={0.35} />
        <XAxis numTicks={wide ? 6 : 4} />
        {granularity === "day" ? (
          <ChartTooltip rows={rows} />
        ) : (
          <ChartTooltip content={({ point }) => <TooltipContent title={String(point.title)} rows={rows(point)} />} />
        )}
      </AreaChart>
    </ChartCard>
  );
}

export function CartFunnel({
  totals,
}: {
  totals: { itemsAddedToCart: number; itemsCheckedOut: number; itemsPurchased: number } | null;
}) {
  const checkoutExceedsCart = totals !== null && totals.itemsCheckedOut > totals.itemsAddedToCart;

  return (
    <ChartCard
      title="Carrinho → Checkout → Compra"
      description={
        totals
          ? `${formatInteger(totals.itemsPurchased)} de ${formatInteger(totals.itemsAddedToCart)} adições viraram compra`
          : "Itens em cada etapa"
      }
    >
      {totals ? (
        <div className="flex h-full flex-col gap-3">
          <FunnelChart
            data={[
              { label: "Carrinho", value: totals.itemsAddedToCart, color: CART_COLOR },
              { label: "Checkout", value: totals.itemsCheckedOut, color: CHECKOUT_COLOR },
              { label: "Compra", value: totals.itemsPurchased, color: SOLD_COLOR },
            ]}
            className="h-48 sm:h-56"
            formatValue={formatInteger}
            formatPercentage={(pct) => formatPercent(pct / 100)}
            layers={3}
          />
          {checkoutExceedsCart && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              O checkout conta itens do <code className="text-foreground/80">begin_checkout</code>, que pode disparar mais
              de uma vez por pessoa, por isso passa do carrinho.
            </p>
          )}
        </div>
      ) : (
        <Skeleton className="h-48 w-full sm:h-56" />
      )}
    </ChartCard>
  );
}

export function RevenueChart({
  data,
  granularity,
  total,
  currency,
  status,
  className,
}: {
  data: ChartRow[];
  granularity: Granularity;
  total: number | null;
  currency: string;
  status: ChartStatus;
  className?: string;
}) {
  const wide = useIsWide();
  return (
    <ChartCard
      title={GRANULARITY_LABELS[granularity].revenueTitle}
      description={total === null ? "Receita no período" : `${formatCurrency(total, currency)} no período`}
      className={className}
    >
      <BarChart
        data={data}
        // Category labels must be unique, so bars key on our label ("dd/mm", "12/05/25", "mai/25"), not the Date.
        xDataKey="label"
        status={status}
        aspectRatio="auto"
        className="h-48 sm:h-56"
        margin={{ top: 16, right: 12, bottom: 32, left: 12 }}
        barGap={0.3}
      >
        <Grid horizontal strokeDasharray="0" />
        <Bar dataKey="itemRevenue" fill={SOLD_COLOR} lineCap={4} />
        <BarXAxis maxLabels={wide ? 10 : 5} />
        <ChartTooltip
          rows={(point) => [
            { color: SOLD_COLOR, label: "Receita", value: formatCurrency(Number(point.itemRevenue), currency) },
            { color: CART_COLOR, label: "Ingressos", value: formatInteger(Number(point.itemsPurchased)) },
          ]}
        />
      </BarChart>
    </ChartCard>
  );
}
