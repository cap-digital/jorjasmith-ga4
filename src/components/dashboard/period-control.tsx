"use client";

import { CalendarDays, RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { ptBR } from "react-day-picker/locale";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsWide } from "@/hooks/use-is-wide";
import type { Ga4DateRange } from "@/lib/ga4-types";
import { formatDayMonth, formatFullDate, toLocalDate } from "@/lib/format";

const PRESETS = [
  { id: "yesterday", label: "Ontem", ariaLabel: "Ontem" },
  { id: "7", label: "7d", ariaLabel: "Últimos 7 dias" },
  { id: "14", label: "14d", ariaLabel: "Últimos 14 dias" },
  { id: "30", label: "30d", ariaLabel: "Últimos 30 dias" },
  { id: "all", label: "Todo período", ariaLabel: "Todo o período" },
] as const;

type PresetId = (typeof PRESETS)[number]["id"];

export type DateSelection = { kind: "preset"; preset: PresetId } | { kind: "custom"; range: Ga4DateRange };

export const DEFAULT_SELECTION: DateSelection = { kind: "preset", preset: "all" };

/** Query-string dates for /api/ga4. Presets stay relative so the server resolves them in the property's time zone. */
export function selectionToRange(selection: DateSelection): Ga4DateRange {
  if (selection.kind === "custom") return selection.range;
  if (selection.preset === "yesterday") return { startDate: "yesterday", endDate: "yesterday" };
  // "all" starts at the item's first day with data (resolved by the API).
  if (selection.preset === "all") return { startDate: "all", endDate: "yesterday" };
  return { startDate: `${selection.preset}daysAgo`, endDate: "yesterday" };
}

function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatRange({ startDate, endDate }: Ga4DateRange): string {
  if (startDate === endDate) return formatFullDate(startDate);
  return `${formatDayMonth(startDate)} – ${formatDayMonth(endDate)}`;
}

function PresetControl({
  value,
  onChange,
}: {
  value: DateSelection;
  onChange: (selection: DateSelection) => void;
}) {
  const active = value.kind === "preset" ? value.preset : null;
  return (
    <ToggleGroup
      aria-label="Período"
      value={active ? [active] : []}
      onValueChange={(next) => {
        const preset = PRESETS.find((p) => p.id === next[0]);
        if (preset) onChange({ kind: "preset", preset: preset.id });
      }}
      spacing={0}
      className="rounded-lg bg-muted/60 p-0.5 ring-1 ring-foreground/10"
    >
      {PRESETS.map((preset) => (
        <ToggleGroupItem
          key={preset.id}
          value={preset.id}
          aria-label={preset.ariaLabel}
          className="relative h-7 min-w-10 rounded-md! px-2.5 text-xs text-muted-foreground tabular-nums hover:bg-transparent aria-pressed:bg-transparent aria-pressed:text-foreground"
        >
          {preset.id === active && (
            <motion.span
              layoutId="period-indicator"
              className="absolute inset-0 rounded-md bg-background shadow-sm ring-1 ring-foreground/10"
              transition={{ type: "spring", stiffness: 500, damping: 38 }}
            />
          )}
          <span className="relative">{preset.label}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function DateRangePicker({
  value,
  shownRange,
  onChange,
}: {
  value: DateSelection;
  /** The resolved range currently on screen (labels the trigger). */
  shownRange: Ga4DateRange | null;
  onChange: (selection: DateSelection) => void;
}) {
  const wide = useIsWide();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>();
  // Read the clock only when the picker opens, never during render (Cache Components prerenders this).
  const [today, setToday] = useState<Date | null>(null);
  const custom = value.kind === "custom";

  const openWith = (next: boolean) => {
    if (next) {
      setToday(new Date());
      setDraft(
        shownRange ? { from: toLocalDate(shownRange.startDate), to: toLocalDate(shownRange.endDate) } : undefined,
      );
    }
    setOpen(next);
  };

  const apply = () => {
    if (!draft?.from) return;
    const from = toIsoDate(draft.from);
    const to = toIsoDate(draft.to ?? draft.from);
    onChange({ kind: "custom", range: { startDate: from, endDate: to } });
    setOpen(false);
  };

  // With two months visible, show the end month on the right.
  const defaultMonth = draft?.to
    ? new Date(draft.to.getFullYear(), draft.to.getMonth() - (wide ? 1 : 0), 1)
    : draft?.from;

  return (
    <Popover open={open} onOpenChange={openWith}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            aria-label="Escolher período personalizado"
            className={`h-8 gap-1.5 tabular-nums ${custom ? "border-foreground/30 bg-muted text-foreground" : "text-muted-foreground"}`}
          />
        }
      >
        <CalendarDays className="size-3.5" aria-hidden />
        {shownRange ? formatRange(shownRange) : "Período"}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <Calendar
          mode="range"
          locale={ptBR}
          numberOfMonths={wide ? 2 : 1}
          selected={draft}
          onSelect={setDraft}
          defaultMonth={defaultMonth}
          disabled={today ? { after: today } : undefined}
          endMonth={today ?? undefined}
          className="p-3"
        />
        <div className="flex items-center justify-between gap-3 border-t border-foreground/10 px-3 py-2.5">
          <span className="text-xs text-muted-foreground tabular-nums">
            {draft?.from
              ? formatRange({ startDate: toIsoDate(draft.from), endDate: toIsoDate(draft.to ?? draft.from) })
              : "Selecione o início"}
          </span>
          <div className="flex gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={apply} disabled={!draft?.from}>
              Aplicar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function PeriodControl({
  value,
  shownRange,
  loading,
  onChange,
  onRefresh,
}: {
  value: DateSelection;
  shownRange: Ga4DateRange | null;
  loading: boolean;
  onChange: (selection: DateSelection) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <PresetControl value={value} onChange={onChange} />
      <DateRangePicker value={value} shownRange={shownRange} onChange={onChange} />
      <Button
        variant="outline"
        size="icon-sm"
        className="size-8"
        onClick={onRefresh}
        disabled={loading}
        aria-label="Atualizar dados"
        title="Atualizar dados"
      >
        <RefreshCw className={`size-3.5 ${loading ? "motion-safe:animate-spin" : ""}`} aria-hidden />
      </Button>
    </div>
  );
}
