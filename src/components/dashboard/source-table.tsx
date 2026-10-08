"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatInteger } from "@/lib/format";

const COLLAPSED_ROWS = 8;

const SOURCE_LABELS: Record<string, string> = {
  "(data not available)": "(dados indisponíveis)",
  "(not set)": "(não definido)",
};

export function sourceLabel(sourceMedium: string): string {
  return SOURCE_LABELS[sourceMedium] ?? sourceMedium;
}

type SourceRow = { sourceMedium: string };
type NumericKey<Row> = { [K in keyof Row]: Row[K] extends number | null ? K : never }[keyof Row] & string;

export type SourceColumn<Row extends SourceRow> = {
  key: NumericKey<Row>;
  label: string;
  /** Short label for the mobile subline, e.g. "sessões". */
  mobileLabel: string;
  format: (value: number | null) => string;
  /** Total over the given rows (the filtered ones while searching). */
  total: (rows: Row[]) => number | null;
  /** Shown as a column on mobile too; the others move to a subline under the source. */
  primary?: boolean;
};

type SortKey<Row extends SourceRow> = "sourceMedium" | NumericKey<Row>;
type Sort<Row extends SourceRow> = { key: SortKey<Row>; direction: "asc" | "desc" };

const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

/** Case- and accent-insensitive, so "GOOGLE" still matches "google / cpc". */
function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** Sums a numeric field, for additive columns' totals. */
export function sumOf<Row>(key: { [K in keyof Row]: Row[K] extends number ? K : never }[keyof Row]) {
  return (rows: Row[]) => rows.reduce((sum, row) => sum + (row[key] as number), 0);
}

function SortableHead({
  active,
  direction,
  onSort,
  align = "right",
  className = "",
  children,
}: {
  active: boolean;
  direction: "asc" | "desc";
  onSort: () => void;
  align?: "left" | "right";
  className?: string;
  children: ReactNode;
}) {
  const Icon = !active ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className={`text-xs ${align === "right" ? "text-right" : ""} ${className}`}
    >
      <button
        type="button"
        onClick={onSort}
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

export function SourceSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="relative w-full sm:w-60">
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Filtrar origem / mídia"
        aria-label="Filtrar origem / mídia"
        className="h-8 pr-8 pl-8 text-sm [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Limpar filtro"
          className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

/**
 * Source / medium table with click-to-sort headers, a text filter and a footer that follows the filter:
 * `totals` (GA4's own, deduplicated) for everything, each column's `total()` over the matches while searching.
 */
export function SourceTable<Row extends SourceRow>({
  rows,
  columns,
  totals,
  query,
  defaultSort,
}: {
  rows: Row[] | null;
  columns: SourceColumn<Row>[];
  totals: Partial<Record<NumericKey<Row>, number | null>> | null;
  query: string;
  defaultSort: NumericKey<Row>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [sort, setSort] = useState<Sort<Row>>({ key: defaultSort, direction: "desc" });
  const term = normalize(query);
  const searching = term.length > 0;

  const sorted = useMemo(() => {
    if (!rows) return null;
    const sign = sort.direction === "asc" ? 1 : -1;
    const byName = (a: Row, b: Row) => collator.compare(sourceLabel(a.sourceMedium), sourceLabel(b.sourceMedium));
    return [...rows].sort((a, b) => {
      if (sort.key === "sourceMedium") return byName(a, b) * sign;
      const key = sort.key as NumericKey<Row>;
      const primary = ((a[key] as number | null) ?? -Infinity) - ((b[key] as number | null) ?? -Infinity);
      // Ties keep the default order, then A→Z.
      const fallback = ((b[defaultSort] as number | null) ?? 0) - ((a[defaultSort] as number | null) ?? 0);
      return (primary || 0) * sign || fallback || byName(a, b);
    });
  }, [rows, sort, defaultSort]);

  const matches = useMemo(
    () =>
      sorted && searching
        ? sorted.filter((row) => normalize(`${row.sourceMedium} ${sourceLabel(row.sourceMedium)}`).includes(term))
        : sorted,
    [sorted, searching, term],
  );
  // While searching, show every match; otherwise collapse to the top rows.
  const visible = matches && !searching && !expanded ? matches.slice(0, COLLAPSED_ROWS) : matches;
  const hidden = !searching && rows ? rows.length - COLLAPSED_ROWS : 0;

  const footerValue = (column: SourceColumn<Row>) =>
    searching && matches ? column.total(matches) : (totals?.[column.key] ?? column.total(rows ?? []));

  // Same column flips direction; a new column starts A→Z for text and highest-first for numbers.
  const onSort = (key: SortKey<Row>) =>
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "sourceMedium" ? "asc" : "desc" },
    );

  const secondary = columns.filter((column) => !column.primary);
  const subline = (value: (column: SourceColumn<Row>) => number | null) =>
    secondary.map((column) => `${column.format(value(column))} ${column.mobileLabel}`).join(" · ");
  const hideOnMobile = (column: SourceColumn<Row>) => (column.primary ? "" : "hidden sm:table-cell");

  if (!visible) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="-mx-2 flex flex-col gap-2">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <SortableHead
              active={sort.key === "sourceMedium"}
              direction={sort.direction}
              onSort={() => onSort("sourceMedium")}
              align="left"
            >
              Origem / mídia
            </SortableHead>
            {columns.map((column) => (
              <SortableHead
                key={column.key}
                active={sort.key === column.key}
                direction={sort.direction}
                onSort={() => onSort(column.key)}
                className={hideOnMobile(column)}
              >
                {column.label}
              </SortableHead>
            ))}
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
                  {subline((column) => row[column.key] as number | null)}
                </span>
              </TableCell>
              {columns.map((column) => (
                <TableCell key={column.key} className={`text-right tabular-nums ${hideOnMobile(column)}`}>
                  {column.format(row[column.key] as number | null)}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {visible.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length + 1} className="text-center text-muted-foreground">
                {searching ? `Nenhuma origem / mídia contém “${query.trim()}”` : "Sem dados no período"}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        <TableFooter className="bg-transparent">
          <TableRow className="hover:bg-transparent">
            <TableCell>
              <span className="block font-medium">{searching ? "Total filtrado" : "Total"}</span>
              <span className="block text-xs font-normal text-muted-foreground tabular-nums sm:hidden">
                {subline(footerValue)}
              </span>
            </TableCell>
            {columns.map((column) => (
              <TableCell key={column.key} className={`text-right font-medium tabular-nums ${hideOnMobile(column)}`}>
                {column.format(footerValue(column))}
              </TableCell>
            ))}
          </TableRow>
        </TableFooter>
      </Table>
      {hidden > 0 && (
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setExpanded((open) => !open)}>
          {expanded ? "Mostrar menos" : `Mostrar todas (${formatInteger(rows!.length)})`}
        </Button>
      )}
    </div>
  );
}
