"use client";

import { MotionConfig, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { bucketize, granularityFor, type Bucket } from "@/lib/buckets";
import type { Ga4Error, Ga4MetricKey, Ga4Report } from "@/lib/ga4-types";
import { formatCurrency, formatFullDate, formatInteger, formatPercent } from "@/lib/format";

import { EventUsers, PageTraffic, SourcesTable } from "./breakdowns";
import { CartFunnel, CartVsSalesChart, RevenueChart, type ChartRow } from "./charts";
import { KpiCard, type Comparison, type KpiData } from "./kpi-card";
import { fadeUp, staggerContainer } from "./motion";
import {
  DEFAULT_SELECTION,
  PeriodControl,
  selectionToRange,
  type DateSelection,
} from "./period-control";

type Settled = { key: string; attempt: number; error: string | null };

const timeFormat = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

const KPIS: { key: Ga4MetricKey; label: string; format: (value: number, currency: string) => string }[] = [
  { key: "itemsPurchased", label: "Ingressos vendidos", format: (v) => formatInteger(Math.round(v)) },
  { key: "itemRevenue", label: "Receita", format: (v, currency) => formatCurrency(v, currency) },
  { key: "cartToPurchaseRate", label: "Conversão carrinho→compra", format: (v) => formatPercent(v) },
  { key: "averageTicket", label: "Ticket médio", format: (v, currency) => formatCurrency(v, currency) },
];

/** Sparkline series; buckets without a defined ratio carry the last known value. */
function trendFor(buckets: Bucket[], key: Ga4MetricKey) {
  let last = 0;
  return buckets.map((bucket) => {
    const value = bucket[key];
    if (value !== null) last = value;
    return { date: bucket.date, value: last };
  });
}

export function Dashboard() {
  const [selection, setSelection] = useState<DateSelection>(DEFAULT_SELECTION);
  // The last successful report stays on screen while the next period loads.
  const [report, setReport] = useState<Ga4Report | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [settled, setSettled] = useState<Settled | null>(null);
  // Bumped by "Atualizar" / "Tentar de novo" to refetch the same period.
  const [attempt, setAttempt] = useState(0);
  const { startDate, endDate } = selectionToRange(selection);
  const key = `${startDate}:${endDate}`;

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ startDate, endDate });
    fetch(`/api/ga4?${query}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as Ga4Report | Ga4Error;
        if (!response.ok || "error" in body) {
          throw new Error("error" in body ? (body.detail ?? body.error) : `HTTP ${response.status}`);
        }
        setReport(body);
        setFetchedAt(new Date());
        setSettled({ key, attempt, error: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setSettled({ key, attempt, error: error instanceof Error ? error.message : "Erro desconhecido" });
      });
    return () => controller.abort();
  }, [startDate, endDate, key, attempt]);

  const loading = settled?.key !== key || settled.attempt !== attempt;
  const error = loading ? null : settled.error;

  const granularity = granularityFor(report?.daily.length ?? 0);
  // Charts and sparklines share the same buckets so long periods (e.g. all time) stay readable.
  const buckets = useMemo(() => (report ? bucketize(report.daily, granularity) : []), [report, granularity]);
  const chartRows: ChartRow[] = buckets;

  const kpis = useMemo(
    () =>
      KPIS.map((kpi) => ({
        ...kpi,
        data: report
          ? ({
              value: report.totals[kpi.key],
              change: report.change[kpi.key],
              trend: trendFor(buckets, kpi.key),
            } satisfies KpiData)
          : null,
      })),
    [report, buckets],
  );

  const refetch = useCallback(() => setAttempt((n) => n + 1), []);

  const currency = report?.currencyCode ?? "BRL";
  const days = report?.daily.length ?? 0;
  const comparison: Comparison =
    report && !report.previous
      ? { kind: "since", label: `desde ${formatFullDate(report.dateRange.startDate)}` }
      : { kind: "previous", label: days === 1 ? "vs dia anterior" : `vs ${days} dias anteriores` };
  const chartStatus = loading || !report ? "loading" : "ready";

  return (
    <MotionConfig reducedMotion="user">
      <motion.main
        className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:gap-5 sm:px-6 sm:py-10"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        <motion.header variants={fadeUp} className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid gap-1">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Jorja Smith</h1>
            <p className="text-sm text-muted-foreground">
              Vendas de ingressos · Tickets for Fun
              {fetchedAt && (
                <span className="tabular-nums" aria-live="polite">
                  {" "}
                  · atualizado às {timeFormat.format(fetchedAt)}
                </span>
              )}
            </p>
          </div>
          <PeriodControl
            value={selection}
            shownRange={report?.dateRange ?? null}
            loading={loading}
            onChange={setSelection}
            onRefresh={refetch}
          />
        </motion.header>

        {error && (
          <motion.div variants={fadeUp}>
            <Card size="sm" className="ring-destructive/40">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span>
                  Não foi possível carregar os dados do GA4. <span className="text-muted-foreground">{error}</span>
                </span>
                <Button variant="outline" size="sm" onClick={refetch}>
                  Tentar de novo
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <motion.section
          variants={staggerContainer}
          aria-label="Indicadores"
          className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
        >
          {kpis.map((kpi) => (
            <KpiCard
              key={kpi.key}
              label={kpi.label}
              data={kpi.data}
              format={(value) => kpi.format(value, currency)}
              comparison={comparison}
            />
          ))}
        </motion.section>

        <motion.section
          variants={staggerContainer}
          aria-label="Gráficos"
          className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3"
        >
          <CartVsSalesChart data={chartRows} granularity={granularity} totals={report?.totals ?? null} status={chartStatus} />
          <CartFunnel totals={report?.totals ?? null} />
        </motion.section>

        {/* Users by event (35%) beside revenue (65%) on large screens; stacked below. */}
        <motion.section
          variants={staggerContainer}
          aria-label="Usuários e receita"
          className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-[minmax(0,35fr)_minmax(0,65fr)]"
        >
          <EventUsers rows={report?.eventUsers ?? null} />
          <RevenueChart
            data={chartRows}
            granularity={granularity}
            total={report?.totals.itemRevenue ?? null}
            currency={currency}
            status={chartStatus}
          />
        </motion.section>

        <motion.section variants={staggerContainer} aria-label="Origem / mídia" className="grid gap-3 sm:gap-4">
          <PageTraffic page={report?.page ?? null} />
          <SourcesTable
            rows={report?.sources ?? null}
            totals={report?.totals ?? null}
            totalSessions={report?.sourcesTotalSessions ?? 0}
            currency={currency}
          />
        </motion.section>
      </motion.main>
    </MotionConfig>
  );
}
