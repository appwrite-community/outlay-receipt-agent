/** Digits after the decimal point: 2 for USD and EUR, 0 for JPY, 3 for BHD. */
export function fractionDigits(currency) {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
    .maximumFractionDigits;
}

export function isCurrencyCode(code) {
  return typeof code === 'string' && Intl.supportedValuesOf('currency').includes(code);
}

/** 44.49 USD becomes 4449. Integer minor units keep sums and comparisons exact. */
export function toMinor(amount, currency) {
  return Math.round(amount * 10 ** fractionDigits(currency));
}

export function fromMinor(minor, currency) {
  return minor / 10 ** fractionDigits(currency);
}

export function formatMoney(minor, currency) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
    fromMinor(minor, currency),
  );
}

/** "2026-09-18T00:00:00.000+00:00" becomes "Sep 18, 2026". Receipt dates are stored at UTC midnight. */
export function formatDate(isoDate) {
  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
