import type { NextRequest } from "next/server";

import { protos } from "@google-analytics/data";

import { getGa4Client, getGa4Property } from "@/lib/ga4";
import type {
  Ga4DailyRow,
  Ga4DateRange,
  Ga4EventUsersRow,
  Ga4MetricKey,
  Ga4Metrics,
  Ga4Report,
  Ga4SourceRow,
} from "@/lib/ga4-types";

// Fixed on the server: the item filter is never taken from the client.
const ITEM_NAME = "Jorja Smith";
const ITEM_FILTER = {
  filter: {
    fieldName: "itemName",
    stringFilter: { matchType: "EXACT" as const, value: ITEM_NAME },
  },
};

const METRICS = ["itemsAddedToCart", "itemsCheckedOut", "itemsPurchased", "itemRevenue"] as const;
type MetricName = (typeof METRICS)[number];
type MetricValues = Record<MetricName, number>;

const DEFAULT_START_DATE = "28daysAgo";
const DEFAULT_END_DATE = "yesterday";

// Formats accepted by the GA4 Data API: YYYY-MM-DD, today, yesterday, NdaysAgo.
const DATE_PATTERN = /^(\d{4}-\d{2}-\d{2}|today|yesterday|\d+daysAgo)$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
// startDate=all means "since the item's first data"; GA4's Data API accepts nothing earlier than this.
const ALL_TIME = "all";
const GA4_MIN_DATE = "2015-08-14";
const DAY_MS = 24 * 60 * 60 * 1000;

// The property's time zone, learned from the first report. Needed to resolve
// relative dates before querying the previous period.
let cachedTimeZone: string | undefined;

function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  if (!ISO_DATE_PATTERN.test(value)) return true;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function addDays(isoDate: string, days: number): string {
  const time = new Date(`${isoDate}T00:00:00Z`).getTime() + days * DAY_MS;
  return new Date(time).toISOString().slice(0, 10);
}

function daysBetween(startDate: string, endDate: string): number {
  return Math.round((Date.parse(endDate) - Date.parse(startDate)) / DAY_MS);
}

// Resolves relative GA4 dates against "today" in the property's time zone.
function resolveDate(value: string, timeZone: string): string {
  if (ISO_DATE_PATTERN.test(value)) return value;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
  if (value === "today") return today;
  if (value === "yesterday") return addDays(today, -1);
  return addDays(today, -Number.parseInt(value, 10));
}

function resolveRange(range: Ga4DateRange, timeZone: string): Ga4DateRange {
  return { startDate: resolveDate(range.startDate, timeZone), endDate: resolveDate(range.endDate, timeZone) };
}

function previousRange({ startDate, endDate }: Ga4DateRange): Ga4DateRange {
  const length = daysBetween(startDate, endDate) + 1;
  return { startDate: addDays(startDate, -length), endDate: addDays(startDate, -1) };
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function ratio(numerator: number, denominator: number, decimals: number): number | null {
  return denominator > 0 ? round(numerator / denominator, decimals) : null;
}

function toMetricValues(values: { value?: string | null }[] | null | undefined): MetricValues {
  return Object.fromEntries(
    METRICS.map((name, i) => [name, Number(values?.[i]?.value ?? 0)]),
  ) as MetricValues;
}

function withDerived(values: MetricValues): Ga4Metrics {
  return {
    itemsAddedToCart: values.itemsAddedToCart,
    itemsCheckedOut: values.itemsCheckedOut,
    itemsPurchased: values.itemsPurchased,
    itemRevenue: round(values.itemRevenue, 2),
    cartToPurchaseRate: ratio(values.itemsPurchased, values.itemsAddedToCart, 4),
    averageTicket: ratio(values.itemRevenue, values.itemsPurchased, 2),
  };
}

function relativeChange(current: Ga4Metrics, previous: Ga4Metrics): Record<Ga4MetricKey, number | null> {
  const keys = Object.keys(current) as Ga4MetricKey[];
  return Object.fromEntries(
    keys.map((key) => {
      const now = current[key];
      const before = previous[key];
      if (now === null || before === null || before === 0) return [key, null];
      return [key, round((now - before) / before, 4)];
    }),
  ) as Record<Ga4MetricKey, number | null>;
}

function noChange(current: Ga4Metrics): Record<Ga4MetricKey, number | null> {
  return Object.fromEntries(Object.keys(current).map((key) => [key, null])) as Record<Ga4MetricKey, number | null>;
}

async function fetchRange(range: Ga4DateRange) {
  const [report] = await getGa4Client().runReport({
    property: getGa4Property(),
    dateRanges: [range],
    dimensions: [{ name: "date" }],
    metrics: METRICS.map((name) => ({ name })),
    dimensionFilter: ITEM_FILTER,
    metricAggregations: [protos.google.analytics.data.v1beta.MetricAggregation.TOTAL],
    orderBys: [{ dimension: { dimensionName: "date" } }],
    limit: 10000,
  });

  const byDate = new Map<string, MetricValues>();
  for (const row of report.rows ?? []) {
    const raw = row.dimensionValues?.[0]?.value ?? "";
    byDate.set(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`, toMetricValues(row.metricValues));
  }

  return {
    byDate,
    totals: withDerived(toMetricValues(report.totals?.[0]?.metricValues)),
    timeZone: report.metadata?.timeZone || "UTC",
    currencyCode: report.metadata?.currencyCode || "BRL",
  };
}

async function fetchSources(range: Ga4DateRange): Promise<Ga4SourceRow[]> {
  const [report] = await getGa4Client().runReport({
    property: getGa4Property(),
    dateRanges: [range],
    dimensions: [{ name: "sessionSourceMedium" }],
    metrics: [{ name: "itemsAddedToCart" }, { name: "itemsPurchased" }, { name: "itemRevenue" }],
    dimensionFilter: ITEM_FILTER,
    orderBys: [
      { metric: { metricName: "itemRevenue" }, desc: true },
      { metric: { metricName: "itemsAddedToCart" }, desc: true },
    ],
    limit: 500,
  });
  return (report.rows ?? []).map((row) => ({
    sourceMedium: row.dimensionValues?.[0]?.value ?? "",
    itemsAddedToCart: Number(row.metricValues?.[0]?.value ?? 0),
    itemsPurchased: Number(row.metricValues?.[1]?.value ?? 0),
    itemRevenue: round(Number(row.metricValues?.[2]?.value ?? 0), 2),
  }));
}

// eventCount can't be filtered by itemName in GA4, so this counts distinct users per event instead.
async function fetchEventUsers(range: Ga4DateRange): Promise<Ga4EventUsersRow[]> {
  const [report] = await getGa4Client().runReport({
    property: getGa4Property(),
    dateRanges: [range],
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "totalUsers" }],
    dimensionFilter: ITEM_FILTER,
    orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
    limit: 100,
  });
  return (report.rows ?? []).map((row) => ({
    eventName: row.dimensionValues?.[0]?.value ?? "",
    users: Number(row.metricValues?.[0]?.value ?? 0),
  }));
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const requested: Ga4DateRange = {
    startDate: params.get("startDate") || DEFAULT_START_DATE,
    endDate: params.get("endDate") || DEFAULT_END_DATE,
  };

  const allTime = requested.startDate === ALL_TIME;
  if ((!allTime && !isValidDate(requested.startDate)) || !isValidDate(requested.endDate)) {
    return Response.json(
      { error: "startDate must be YYYY-MM-DD, today, yesterday, NdaysAgo or all; endDate the same except all" },
      { status: 400 },
    );
  }
  if (
    ISO_DATE_PATTERN.test(requested.startDate) &&
    ISO_DATE_PATTERN.test(requested.endDate) &&
    requested.startDate > requested.endDate
  ) {
    return Response.json({ error: "startDate must be on or before endDate" }, { status: 400 });
  }

  const query: Ga4DateRange = { startDate: allTime ? GA4_MIN_DATE : requested.startDate, endDate: requested.endDate };
  // All time has no earlier period to compare against.
  const fetchPrevious = (range: Ga4DateRange) => (allTime ? Promise.resolve(null) : fetchRange(previousRange(range)));

  try {
    let current: Awaited<ReturnType<typeof fetchRange>>;
    let previous: Awaited<ReturnType<typeof fetchRange>> | null;
    let range: Ga4DateRange;
    let sources: Ga4SourceRow[];
    let eventUsers: Ga4EventUsersRow[];

    if (cachedTimeZone) {
      range = resolveRange(query, cachedTimeZone);
      if (range.startDate > range.endDate) {
        return Response.json({ error: "startDate must be on or before endDate" }, { status: 400 });
      }
      [current, previous, sources, eventUsers] = await Promise.all([
        fetchRange(range),
        fetchPrevious(range),
        fetchSources(range),
        fetchEventUsers(range),
      ]);
    } else {
      current = await fetchRange(query);
      cachedTimeZone = current.timeZone;
      range = resolveRange(query, current.timeZone);
      if (range.startDate > range.endDate) {
        return Response.json({ error: "startDate must be on or before endDate" }, { status: 400 });
      }
      [previous, sources, eventUsers] = await Promise.all([
        fetchPrevious(range),
        fetchSources(range),
        fetchEventUsers(range),
      ]);
    }

    if (allTime) {
      // Start the series at the item's first day with data instead of 2015.
      const firstDate = [...current.byDate.keys()].sort()[0];
      range = { startDate: firstDate && firstDate <= range.endDate ? firstDate : range.endDate, endDate: range.endDate };
    }

    // GA4 omits days without events for the item; fill them with zeros.
    const daily: Ga4DailyRow[] = [];
    for (let date = range.startDate; date <= range.endDate; date = addDays(date, 1)) {
      daily.push({ date, ...withDerived(current.byDate.get(date) ?? toMetricValues(null)) });
    }

    const body: Ga4Report = {
      itemName: ITEM_NAME,
      dateRange: range,
      totals: current.totals,
      daily,
      previous: previous && { dateRange: previousRange(range), totals: previous.totals },
      change: previous ? relativeChange(current.totals, previous.totals) : noChange(current.totals),
      sources,
      eventUsers,
      currencyCode: current.currencyCode,
      timeZone: current.timeZone,
    };
    return Response.json(body);
  } catch (error) {
    console.error("[api/ga4] runReport failed", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: "Failed to fetch GA4 report", detail: message }, { status: 502 });
  }
}
