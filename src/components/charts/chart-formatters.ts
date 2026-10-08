// Localized to pt-BR for this project (dates as dd/mm, numbers with "." thousands).

export const shortDateFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
});

export const weekdayDateFmt = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
});

export const hmsTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

// `Intl.NumberFormat.prototype.format` is a bound getter — safe to extract.
export const intFmt = new Intl.NumberFormat("pt-BR").format;
