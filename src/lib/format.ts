/**
 * Locale-aware money formatter. Defaults to nl-BE for the Belgian author,
 * but honours the currency code passed by the caller.
 */
export function formatMoney(amount: number, currency = "EUR", locale = "nl-BE") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(value: string | Date, locale = "nl-BE") {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
