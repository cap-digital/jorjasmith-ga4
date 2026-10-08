// Shape of the /api/ga4 response, shared by the route handler and the dashboard.

export type Ga4Metrics = {
  itemsAddedToCart: number;
  /** Items in begin_checkout events. Can exceed itemsAddedToCart when checkout starts without a cart add. */
  itemsCheckedOut: number;
  itemsPurchased: number;
  /** Rounded to 2 decimals. */
  itemRevenue: number;
  /** itemsPurchased / itemsAddedToCart as a ratio (0.1234 = 12,34%); null when there were no cart adds. */
  cartToPurchaseRate: number | null;
  /** itemRevenue / itemsPurchased; null when nothing was purchased. */
  averageTicket: number | null;
};

export type Ga4MetricKey = keyof Ga4Metrics;

export type Ga4DailyRow = Ga4Metrics & {
  /** YYYY-MM-DD in the property's time zone. */
  date: string;
};

export type Ga4DateRange = { startDate: string; endDate: string };

export type Ga4SourceRow = {
  /** GA4 sessionSourceMedium, e.g. "google / cpc". */
  sourceMedium: string;
  itemsAddedToCart: number;
  itemsPurchased: number;
  itemRevenue: number;
};

export type Ga4EventUsersRow = {
  eventName: string;
  /** Distinct users who triggered the event with the item. */
  users: number;
};

export type Ga4Report = {
  itemName: string;
  dateRange: Ga4DateRange;
  totals: Ga4Metrics;
  daily: Ga4DailyRow[];
  /** Same-length period immediately before `dateRange`; null for all time (startDate=all). */
  previous: { dateRange: Ga4DateRange; totals: Ga4Metrics } | null;
  /** Relative change vs the previous period (0.12 = +12%); null when there is no previous period or its value is 0. */
  change: Record<Ga4MetricKey, number | null>;
  /** Sorted by revenue, then cart adds. */
  sources: Ga4SourceRow[];
  /** Sorted by users. */
  eventUsers: Ga4EventUsersRow[];
  currencyCode: string;
  timeZone: string;
};

export type Ga4Error = {
  error: string;
  detail?: string;
};
