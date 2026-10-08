"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { Legend, LegendItem, LegendLabel, LegendProgress, LegendValue } from "@/components/charts/legend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Ga4EventUsersRow, Ga4Metrics, Ga4SourceRow } from "@/lib/ga4-types";
import { formatCurrency, formatInteger, formatPercent } from "@/lib/format";

import { CART_COLOR, CHECKOUT_COLOR, ChartCard, SOLD_COLOR } from "./charts";

const COLLAPSED_ROWS = 8;

const SOURCE_LABELS: Record<string, string> = {
  "(data not available)": "(dados indisponíveis)",
  "(not set)": "(não definido)",
};

type SortKey = keyof Ga4SourceRow;
type Sort = { key: SortKey; direction: "asc" | "desc" };

// Matches the API order: revenue first, so the default view is unchanged.
const DEFAULT_SORT: Sort = { key: "itemRevenue", direction: "desc" };
const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

function sourceLabel(sourceMedium: string): string {
  return SOURCE_LABELS[sourceMedium] ?? sourceMedium;
}

/** Case- and accent-insensitive, so "googlé" or "GOOGLE" still match "google / cpc". */
function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

function compareRows(a: Ga4SourceRow, b: Ga4SourceRow, { key, direction }: Sort): number {
  const sign = direction === "asc" ? 1 : -1;
  const primary =
    key === "sourceMedium"
      ? collator.compare(sourceLabel(a.sourceMedium), sourceLabel(b.sourceMedium))
      : a[key] - b[key];
  if (primary !== 0) return primary * sign;
  // Stable tie-break: revenue, then cart adds, then name.
  return (
    b.itemRevenue - a.itemRevenue ||
    b.itemsAddedToCart - a.itemsAddedToCart ||
    collator.compare(sourceLabel(a.sourceMedium), sourceLabel(b.sourceMedium))
  );
}

function SortableHead({
  sortKey,
  sort,
  onSort,
  align = "right",
  className = "",
  children,
}: {
  sortKey: SortKey;
  sort: Sort;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
  className?: string;
  children: ReactNode;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
      className={`text-xs ${align === "right" ? "text-right" : ""} ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`-mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 ${
          align === "right" ? "flex-row-reverse" : ""
        } ${active ? "text-foreground" : "text-muted-foreground"}`}
      >
        {children}
        <Icon className={`size-3.5 shrink-0 ${active ? "" : "opacity-40"}`} aria-hidden />
      </button>
    </TableHead>
  );
}

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
  const [expanded, setExpanded] = useState(false);
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);
  const [query, setQuery] = useState("");
  const term = normalize(query);
  const searching = term.length > 0;

  const sorted = useMemo(() => (rows ? [...rows].sort((a, b) => compareRows(a, b, sort)) : null), [rows, sort]);
  const matches = useMemo(
    () =>
      sorted && searching
        ? sorted.filter((row) => normalize(`${row.sourceMedium} ${sourceLabel(row.sourceMedium)}`).includes(term))
        : sorted,
    [sorted, searching, term],
  );
  // While searching, show every match; otherwise collapse to the top rows.
  const visible = matches && !searching && !expanded ? matches.slice(0, COLLAPSED_ROWS) : matches;

  // The footer follows the filter: GA4's totals for everything, the matching rows' sum while searching.
  const footer = useMemo(() => {
    if (!totals) return null;
    if (!searching || !matches) {
      return {
        label: "Total",
        sessions: totalSessions,
        itemsAddedToCart: totals.itemsAddedToCart,
        itemsPurchased: totals.itemsPurchased,
        itemRevenue: totals.itemRevenue,
      };
    }
    return matches.reduce(
      (sum, row) => ({
        ...sum,
        sessions: sum.sessions + row.sessions,
        itemsAddedToCart: sum.itemsAddedToCart + row.itemsAddedToCart,
        itemsPurchased: sum.itemsPurchased + row.itemsPurchased,
        itemRevenue: sum.itemRevenue + row.itemRevenue,
      }),
      { label: "Total filtrado", sessions: 0, itemsAddedToCart: 0, itemsPurchased: 0, itemRevenue: 0 },
    );
  }, [totals, totalSessions, searching, matches]);

  // Same column flips direction; a new column starts A→Z for text and highest-first for numbers.
  const onSort = (key: SortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "sourceMedium" ? "asc" : "desc" },
    );
  const hidden = !searching && rows ? rows.length - COLLAPSED_ROWS : 0;

  return (
    <ChartCard
      title="Origem / mídia"
      description="Origem da sessão · sessões com interação com o ingresso (carrinho, checkout ou compra)"
      className={className}
      action={
        <div className="relative w-full sm:w-60">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filtrar origem / mídia"
            aria-label="Filtrar origem / mídia"
            className="h-8 pr-8 pl-8 text-sm [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpar filtro"
              className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          )}
        </div>
      }
    >
      {visible && footer ? (
        <div className="-mx-2 flex flex-col gap-2">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <SortableHead sortKey="sourceMedium" sort={sort} onSort={onSort} align="left">
                  Origem / mídia
                </SortableHead>
                <SortableHead sortKey="sessions" sort={sort} onSort={onSort} className="hidden sm:table-cell">
                  Sessões
                </SortableHead>
                <SortableHead sortKey="itemsAddedToCart" sort={sort} onSort={onSort} className="hidden sm:table-cell">
                  Adições ao carrinho
                </SortableHead>
                <SortableHead sortKey="itemsPurchased" sort={sort} onSort={onSort} className="hidden sm:table-cell">
                  Itens comprados
                </SortableHead>
                <SortableHead sortKey="itemRevenue" sort={sort} onSort={onSort}>
                  Receita
                </SortableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => (
                <TableRow key={row.sourceMedium}>
                  <TableCell className="max-w-48 sm:max-w-56">
                    <span className="block truncate font-medium" title={row.sourceMedium}>
                      {sourceLabel(row.sourceMedium)}
                    </span>
                    <span className="block text-xs text-muted-foreground tabular-nums sm:hidden">
                      {formatInteger(row.sessions)} sessões · {formatInteger(row.itemsAddedToCart)} adições ·{" "}
                      {formatInteger(row.itemsPurchased)} comprados
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {formatInteger(row.sessions)}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {formatInteger(row.itemsAddedToCart)}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {formatInteger(row.itemsPurchased)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(row.itemRevenue, currency)}</TableCell>
                </TableRow>
              ))}
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {searching ? `Nenhuma origem / mídia contém “${query.trim()}”` : "Sem dados no período"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter className="bg-transparent">
              <TableRow className="hover:bg-transparent">
                <TableCell>
                  <span className="block font-medium">{footer.label}</span>
                  <span className="block text-xs font-normal text-muted-foreground tabular-nums sm:hidden">
                    {formatInteger(footer.sessions)} sessões · {formatInteger(footer.itemsAddedToCart)} adições ·{" "}
                    {formatInteger(footer.itemsPurchased)} comprados
                  </span>
                </TableCell>
                <TableCell className="hidden text-right font-medium tabular-nums sm:table-cell">
                  {formatInteger(footer.sessions)}
                </TableCell>
                <TableCell className="hidden text-right font-medium tabular-nums sm:table-cell">
                  {formatInteger(footer.itemsAddedToCart)}
                </TableCell>
                <TableCell className="hidden text-right font-medium tabular-nums sm:table-cell">
                  {formatInteger(footer.itemsPurchased)}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatCurrency(footer.itemRevenue, currency)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
          {hidden > 0 && (
            <Button variant="ghost" size="sm" className="self-start" onClick={() => setExpanded((open) => !open)}>
              {expanded ? "Mostrar menos" : `Mostrar todas (${formatInteger(rows!.length)})`}
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      )}
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
