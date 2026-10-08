"use client";

import { Maximize2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { Legend, LegendItem, LegendLabel, LegendProgress, LegendValue } from "@/components/charts/legend";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { Ga4EventUsersRow, Ga4Metrics, Ga4PageMetrics, Ga4PageSourceRow, Ga4SourceRow } from "@/lib/ga4-types";
import { formatCurrency, formatDuration, formatInteger, formatPercent } from "@/lib/format";

import { CART_COLOR, CHECKOUT_COLOR, ChartCard, SOLD_COLOR } from "./charts";
import { SourceSearch, SourceTable, sumOf, type SourceColumn } from "./source-table";

const integer = (value: number | null) => (value === null ? "—" : formatInteger(value));

const COMPACT_ROWS = 8;

/** Full table in a modal: header, optional stats, search and every row. */
function TableModal({
  open,
  onOpenChange,
  title,
  description,
  query,
  onQueryChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  query: string;
  onQueryChange: (query: string) => void;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-4 p-5 sm:max-w-5xl">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-base">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <SourceSearch value={query} onChange={onQueryChange} />
        {/* Vertical scroll only, flush with the modal edge; the padding absorbs the table's -mx-2 bleed. */}
        <div className="scrollbar-thin -mx-5 min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-5 [scrollbar-gutter:stable]">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExpandButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} className="gap-1.5">
      <Maximize2 className="size-3.5" aria-hidden />
      Expandir
    </Button>
  );
}

function MoreRows({ total, onExpand }: { total: number; onExpand: () => void }) {
  if (total <= COMPACT_ROWS) return null;
  return (
    <button
      type="button"
      onClick={onExpand}
      className="mt-2 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      Mostrando {COMPACT_ROWS} de {formatInteger(total)} origens · ver todas
    </button>
  );
}

export function SourcesTable({
  rows,
  totals,
  currency,
  className,
}: {
  rows: Ga4SourceRow[] | null;
  totals: Ga4Metrics | null;
  currency: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const columns = useMemo<SourceColumn<Ga4SourceRow>[]>(
    () => [
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
  const compactColumns = columns.filter((column) => column.key !== "itemsAddedToCart");
  const title = "Origem / mídia · ingresso";
  const description = "Origem da sessão em que o ingresso foi adicionado ao carrinho ou comprado";

  return (
    <ChartCard
      title={title}
      description={description}
      className={className}
      button={<ExpandButton onClick={() => setOpen(true)} />}
    >
      <SourceTable
        rows={rows}
        columns={compactColumns}
        totals={totals}
        defaultSort="itemRevenue"
        maxRows={COMPACT_ROWS}
      />
      {rows && <MoreRows total={rows.length} onExpand={() => setOpen(true)} />}
      <TableModal
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        query={query}
        onQueryChange={setQuery}
      >
        <SourceTable rows={rows} columns={columns} totals={totals} query={query} defaultSort="itemRevenue" />
      </TableModal>
    </ChartCard>
  );
}

// Rates are recomputed from the rows' sums (weighted by sessions), never averaged.
const engagementColumn: SourceColumn<Ga4PageSourceRow> = {
  key: "engagementRate",
  label: "Engajamento",
  mobileLabel: "engajamento",
  format: formatPercent,
  total: (rows) => {
    const sessions = sumOf<Ga4PageSourceRow>("sessions")(rows);
    return sessions > 0 ? sumOf<Ga4PageSourceRow>("engagedSessions")(rows) / sessions : null;
  },
};
const sessionsColumn: SourceColumn<Ga4PageSourceRow> = {
  key: "sessions",
  label: "Sessões",
  mobileLabel: "sessões",
  format: integer,
  total: sumOf("sessions"),
  primary: true,
};
const pageColumns: SourceColumn<Ga4PageSourceRow>[] = [
  sessionsColumn,
  // Users can arrive through more than one source, so a filtered sum may slightly overcount.
  { key: "users", label: "Usuários", mobileLabel: "usuários", format: integer, total: sumOf("users") },
  {
    key: "newUsers",
    label: "Novos usuários",
    mobileLabel: "novos",
    format: integer,
    total: sumOf("newUsers"),
    wideOnly: true,
  },
  engagementColumn,
  {
    key: "engagementSecondsPerSession",
    label: "Tempo por sessão",
    mobileLabel: "por sessão",
    format: formatDuration,
    wideOnly: true,
    total: (rows) => {
      const sessions = sumOf<Ga4PageSourceRow>("sessions")(rows);
      return sessions > 0 ? sumOf<Ga4PageSourceRow>("engagementSeconds")(rows) / sessions : null;
    },
  },
];
const compactPageColumns = [sessionsColumn, engagementColumn];

function PageStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold tracking-tight">{value}</span>
    </div>
  );
}

function PageStats({ totals, full }: { totals: Ga4PageMetrics | undefined; full: boolean }) {
  const stats = totals
    ? [
        { label: "Sessões", value: formatInteger(totals.sessions) },
        { label: "Usuários", value: formatInteger(totals.users) },
        ...(full ? [{ label: "Novos usuários", value: formatInteger(totals.newUsers) }] : []),
        { label: "Engajamento", value: formatPercent(totals.engagementRate) },
        ...(full ? [{ label: "Tempo por sessão", value: formatDuration(totals.engagementSecondsPerSession) }] : []),
      ]
    : null;
  return (
    <div className={`grid grid-cols-3 gap-x-6 gap-y-3 ${full ? "sm:grid-cols-5" : ""}`}>
      {stats
        ? stats.map((stat) => <PageStat key={stat.label} {...stat} />)
        : Array.from({ length: full ? 5 : 3 }, (_, i) => <Skeleton key={i} className="h-11 w-full" />)}
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const totals = page?.totals;
  const rows = page?.sources ?? null;
  const title = "Página do evento · origem / mídia";
  const description = "Tráfego em sales.ticketsforfun.com.br/#/event/jorja-smith (identificada pelo título da página)";

  return (
    <ChartCard
      title={title}
      description={description}
      className={className}
      button={<ExpandButton onClick={() => setOpen(true)} />}
    >
      <div className="flex flex-col gap-5">
        <PageStats totals={totals} full={false} />
        <div>
          <SourceTable
            rows={rows}
            columns={compactPageColumns}
            totals={totals ?? null}
            defaultSort="sessions"
            maxRows={COMPACT_ROWS}
          />
          {rows && <MoreRows total={rows.length} onExpand={() => setOpen(true)} />}
        </div>
      </div>
      <TableModal
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        query={query}
        onQueryChange={setQuery}
      >
        <div className="flex flex-col gap-5">
          <PageStats totals={totals} full />
          <SourceTable rows={rows} columns={pageColumns} totals={totals ?? null} query={query} defaultSort="sessions" />
        </div>
      </TableModal>
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
