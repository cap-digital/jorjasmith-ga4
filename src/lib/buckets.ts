// Groups the API's daily rows into days, weeks or months so long periods stay readable.

import type { Ga4DailyRow } from "@/lib/ga4-types";
import { toLocalDate } from "@/lib/format";

export type Granularity = "day" | "week" | "month";

export type Bucket = {
  /** Local-midnight start of the bucket. */
  date: Date;
  /** Short, unique-within-the-period label for axes and bar categories: "09/09", "12/05/25", "mai/25". */
  label: string;
  /** Long label for tooltips: "09/09/2026", "Semana de 12/05/2025", "maio de 2025". */
  title: string;
  itemsAddedToCart: number;
  itemsCheckedOut: number;
  itemsPurchased: number;
  itemRevenue: number;
  cartToPurchaseRate: number | null;
  averageTicket: number | null;
};

export const GRANULARITY_LABELS: Record<Granularity, { per: string; revenueTitle: string }> = {
  day: { per: "Por dia", revenueTitle: "Receita diária" },
  week: { per: "Por semana", revenueTitle: "Receita semanal" },
  month: { per: "Por mês", revenueTitle: "Receita mensal" },
};

/** Daily up to ~3 months, weekly up to a year, monthly beyond. */
export function granularityFor(days: number): Granularity {
  if (days <= 92) return "day";
  if (days <= 366) return "week";
  return "month";
}

const pad = (n: number) => String(n).padStart(2, "0");
const monthShort = new Intl.DateTimeFormat("pt-BR", { month: "short" });
const monthLong = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

function startOf(date: Date, granularity: Granularity): Date {
  if (granularity === "month") return new Date(date.getFullYear(), date.getMonth(), 1);
  if (granularity === "week") {
    // Weeks start on Monday.
    const offset = (date.getDay() + 6) % 7;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset);
  }
  return date;
}

function labelsFor(date: Date, granularity: Granularity): { label: string; title: string } {
  const dayMonth = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
  const year = date.getFullYear();
  if (granularity === "month") {
    return {
      label: `${monthShort.format(date).replace(".", "")}/${String(year).slice(2)}`,
      title: monthLong.format(date),
    };
  }
  if (granularity === "week") {
    return { label: `${dayMonth}/${String(year).slice(2)}`, title: `Semana de ${dayMonth}/${year}` };
  }
  return { label: dayMonth, title: `${dayMonth}/${year}` };
}

export function bucketize(daily: Ga4DailyRow[], granularity: Granularity): Bucket[] {
  const buckets = new Map<number, Bucket>();
  for (const row of daily) {
    const start = startOf(toLocalDate(row.date), granularity);
    let bucket = buckets.get(start.getTime());
    if (!bucket) {
      bucket = {
        date: start,
        ...labelsFor(start, granularity),
        itemsAddedToCart: 0,
        itemsCheckedOut: 0,
        itemsPurchased: 0,
        itemRevenue: 0,
        cartToPurchaseRate: null,
        averageTicket: null,
      };
      buckets.set(start.getTime(), bucket);
    }
    bucket.itemsAddedToCart += row.itemsAddedToCart;
    bucket.itemsCheckedOut += row.itemsCheckedOut;
    bucket.itemsPurchased += row.itemsPurchased;
    bucket.itemRevenue += row.itemRevenue;
  }
  // Ratios are recomputed from the bucket's sums, never averaged across days.
  return [...buckets.values()].map((bucket) => ({
    ...bucket,
    itemRevenue: Math.round(bucket.itemRevenue * 100) / 100,
    cartToPurchaseRate: bucket.itemsAddedToCart > 0 ? bucket.itemsPurchased / bucket.itemsAddedToCart : null,
    averageTicket: bucket.itemsPurchased > 0 ? bucket.itemRevenue / bucket.itemsPurchased : null,
  }));
}
