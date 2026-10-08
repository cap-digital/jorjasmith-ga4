"use client";

import { useMemo, useState } from "react";

import { Legend, LegendItem, LegendLabel, LegendProgress, LegendValue } from "@/components/charts/legend";
import { Skeleton } from "@/components/ui/skeleton";
import type { Ga4EventUsersRow, Ga4Metrics, Ga4PageMetrics, Ga4PageSourceRow, Ga4SourceRow } from "@/lib/ga4-types";
import { formatCurrency, formatDuration, formatInteger, formatPercent } from "@/lib/format";

import { CART_COLOR, CHECKOUT_COLOR, ChartCard, SOLD_COLOR } from "./charts";
import { SourceSearch, SourceTable, sumOf, type SourceColumn } from "./source-table";

const integer = (value: number | null) => (value === null ? "—" : formatInteger(value));

export function SourcesTable({
  rows,
  totals,
  totalSessions,
  currency,
  className,
}: {
  rows: Ga4SourceRow[] | null;
  totals: Ga4Metrics | null;
  totalSessions: number;
  currency: string;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const columns = useMemo<SourceColumn<Ga4SourceRow>[]>(
    () => [
      { key: "sessions", label: "Sessões", mobileLabel: "sessões", format: integer, total: sumOf("sessions") },
      {
        key: "itemsAddedToCart",
        label: "Adições ao carrinho",
        mobileLabel: "adições",
        format: integer,
        total: sumOf("itemsAddedToCart"),
      },
      {
        key: "itemsPurchased",
        label: "Itens comprados",
        mobileLabel: "comprados",
        format: integer,
        total: sumOf("itemsPurchased"),
      },
      {
        key: "itemRevenue",
        label: "Receita",
        mobileLabel: "receita",
        format: (value) => formatCurrency(value, currency),
        total: sumOf("itemRevenue"),
        primary: true,
      },
    ],
    [currency],
  );

  return (
    <ChartCard
      title="Origem / mídia · ingresso"
      description="Origem da sessão · sessões com interação com o ingresso (carrinho, checkout ou compra)"
      className={className}
      action={<SourceSearch value={query} onChange={setQuery} />}
    >
      <SourceTable
        rows={rows}
        columns={columns}
        totals={totals && { ...totals, sessions: totalSessions }}
        query={query}
        defaultSort="itemRevenue"
      />
    </ChartCard>
  );
}

// Rates are recomputed from the rows' sums (weighted by sessions), never averaged.
const pageColumns: SourceColumn<Ga4PageSourceRow>[] = [
  { key: "sessions", label: "Sessões", mobileLabel: "sessões", format: integer, total: sumOf("sessions"), primary: true },
  // Users can arrive through more than one source, so a filtered sum may slightly overcount.
  { key: "users", label: "Usuários", mobileLabel: "usuários", format: integer, total: sumOf("users") },
  { key: "newUsers", label: "Novos usuários", mobileLabel: "novos", format: integer, total: sumOf("newUsers") },
  {
    key: "engagementRate",
    label: "Engajamento",
    mobileLabel: "engajamento",
    format: formatPercent,
    total: (rows) => {
      const sessions = sumOf<Ga4PageSourceRow>("sessions")(rows);
      return sessions > 0 ? sumOf<Ga4PageSourceRow>("engagedSessions")(rows) / sessions : null;
    },
  },
  {
    key: "engagementSecondsPerSession",
    label: "Tempo por sessão",
    mobileLabel: "por sessão",
    format: formatDuration,
    total: (rows) => {
      const sessions = sumOf<Ga4PageSourceRow>("sessions")(rows);
      return sessions > 0 ? sumOf<Ga4PageSourceRow>("engagementSeconds")(rows) / sessions : null;
    },
  },
];

function PageStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold tracking-tight">{value}</span>
    </div>
  );
}

export function PageTraffic({
  page,
  className,
}: {
  page: { totals: Ga4PageMetrics; sources: Ga4PageSourceRow[] } | null;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const totals = page?.totals;

  return (
    <ChartCard
      title="Página do evento · origem / mídia"
      description="Tráfego em sales.ticketsforfun.com.br/#/event/jorja-smith (identificada pelo título da página)"
      className={className}
      action={<SourceSearch value={query} onChange={setQuery} />}
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-5">
          {totals ? (
            <>
              <PageStat label="Sessões" value={formatInteger(totals.sessions)} />
              <PageStat label="Usuários" value={formatInteger(totals.users)} />
              <PageStat label="Novos usuários" value={formatInteger(totals.newUsers)} />
              <PageStat label="Engajamento" value={formatPercent(totals.engagementRate)} />
              <PageStat label="Tempo por sessão" value={formatDuration(totals.engagementSecondsPerSession)} />
            </>
          ) : (
            Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-11 w-full" />)
          )}
        </div>
        <SourceTable
          rows={page?.sources ?? null}
          columns={pageColumns}
          totals={totals ?? null}
          query={query}
          defaultSort="sessions"
        />
      </div>
    </ChartCard>
  );
}

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  view_item: { label: "Visualizou o item", color: CART_COLOR },
  add_to_cart: { label: "Adicionou ao carrinho", color: CART_COLOR },
  begin_checkout: { label: "Iniciou o checkout", color: CHECKOUT_COLOR },
  add_payment_info: { label: "Informou pagamento", color: CHECKOUT_COLOR },
  purchase: { label: "Comprou", color: SOLD_COLOR },
};

export function EventUsers({ rows, className }: { rows: Ga4EventUsersRow[] | null; className?: string }) {
  const max = rows?.[0]?.users ?? 0;
  const items =
    rows?.map((row) => ({
      label: EVENT_LABELS[row.eventName]?.label ?? row.eventName,
      value: row.users,
      maxValue: max,
      color: EVENT_LABELS[row.eventName]?.color ?? CART_COLOR,
    })) ?? [];

  return (
    <ChartCard
      title="Usuários por evento"
      description="Pessoas que dispararam cada evento com o item"
      className={className}
    >
      {rows ? (
        items.length > 0 ? (
          <Legend items={items} className="gap-4">
            <LegendItem className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <LegendLabel className="text-sm" />
                <LegendValue
                  className="text-sm font-medium tabular-nums text-foreground"
                  showPercentage
                  percentageClassName="text-xs font-normal text-muted-foreground"
                  formatValue={formatInteger}
                  formatPercentage={(pct) => formatPercent(pct / 100)}
                />
              </div>
              <LegendProgress height="h-1.5" />
            </LegendItem>
          </Legend>
        ) : (
          <p className="text-sm text-muted-foreground">Sem eventos no período</p>
        )
      ) : (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      )}
    </ChartCard>
  );
}
