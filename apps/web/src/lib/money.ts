const LOCALE = 'en-US'

/** Common home currencies for the sign-up and settings forms. */
export const CURRENCIES = [
  'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'JPY', 'CHF', 'SEK', 'NOK',
  'DKK', 'PLN', 'CZK', 'SGD', 'HKD', 'INR', 'BRL', 'MXN', 'ZAR', 'KRW',
] as const

export function currencyName(code: string): string {
  return new Intl.DisplayNames(LOCALE, { type: 'currency' }).of(code) ?? code
}

/** Digits after the decimal point: 2 for USD and EUR, 0 for JPY. */
export function fractionDigits(currency: string): number {
  return new Intl.NumberFormat(LOCALE, { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2
}

export function fromMinor(minor: number, currency: string): number {
  return minor / 10 ** fractionDigits(currency)
}

export function toMinor(amount: number, currency: string): number {
  return Math.round(amount * 10 ** fractionDigits(currency))
}

/** Money is stored in minor units (cents), so sums stay exact. */
export function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat(LOCALE, { style: 'currency', currency }).format(fromMinor(minor, currency))
}

/** Short amounts for charts, such as $191 or $1.2K. */
export function formatMoneyCompact(minor: number, currency: string): string {
  const amount = fromMinor(minor, currency)
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: Math.abs(amount) >= 1000 ? 1 : 0,
  }).format(amount)
}

export function currencySymbol(currency: string): string {
  const parts = new Intl.NumberFormat(LOCALE, { style: 'currency', currency }).formatToParts(0)
  return parts.find((part) => part.type === 'currency')?.value ?? currency
}

/** Reads "1,142.60" or "44.5" typed by a person. Returns null for anything else. */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[,\s]/g, '')
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null
  return Number(cleaned)
}

export function isCurrencyCode(value: string): boolean {
  return /^[A-Z]{3}$/.test(value) && Intl.supportedValuesOf('currency').includes(value)
}
