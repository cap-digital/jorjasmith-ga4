// pt-BR formatters shared by the dashboard. Dates come from the API as YYYY-MM-DD.

const integerFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const percentFormat = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const signedPercentFormat = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});
const currencyFormats = new Map<string, Intl.NumberFormat>();

const EMPTY = "—";

export function formatInteger(value: number): string {
  return integerFormat.format(value);
}

/** 26567.5 → "R$ 26.567,50" */
export function formatCurrency(value: number | null, currency = "BRL"): string {
  if (value === null) return EMPTY;
  let format = currencyFormats.get(currency);
  if (!format) {
    format = new Intl.NumberFormat("pt-BR", { style: "currency", currency });
    currencyFormats.set(currency, format);
  }
  return format.format(value);
}

/** 0.1611 → "16,1%" */
export function formatPercent(ratio: number | null): string {
  return ratio === null ? EMPTY : percentFormat.format(ratio);
}

/** 0.129 → "+12,9%", -0.45 → "-45,0%" */
export function formatSignedPercent(ratio: number): string {
  return signedPercentFormat.format(ratio);
}

/** "2026-09-09" → "09/09" */
export function formatDayMonth(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${day}/${month}`;
}

/** "2026-09-09" → "09/09/2026" */
export function formatFullDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

/** "2026-09-09" → local-midnight Date, so charts never shift a day across time zones. */
export function toLocalDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}
