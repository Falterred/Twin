/**
 * Formatting helpers for Currency, Percentages, and Identifiers
 *
 * Enforces Indian numbering style (₹1,50,000) and consistent handling of NaN
 * "not enough data" sentinels throughout UI components.
 */

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/**
 * Formats a numeric rupee amount into Indian currency format (e.g. ₹1,50,000).
 * Preserves negative sign if negative.
 */
export function formatRupees(amount: number): string {
  if (Number.isNaN(amount) || !Number.isFinite(amount)) {
    return '₹0';
  }
  return inrFormatter.format(amount);
}

/**
 * Formats a percentage value (0-100). Returns "N/A" if value is NaN.
 */
export function formatPct(value: number, fractionDigits = 0): string {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return 'N/A';
  }
  return `${value.toFixed(fractionDigits)}%`;
}

/**
 * Formats a signed delta percentage (e.g. "+12%", "-5%", "0%"). Returns "N/A" if value is NaN.
 */
export function formatSignedDeltaPct(delta: number, fractionDigits = 0): string {
  if (Number.isNaN(delta) || !Number.isFinite(delta)) {
    return 'N/A';
  }
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(fractionDigits)}%`;
}

/**
 * Compact rupee label for dense chart axes (e.g. ₹1.5L, ₹12k). Tooltips and narrative
 * text always use the full formatRupees output; only axis ticks abbreviate.
 */
export function formatRupeesCompact(amount: number): string {
  if (Number.isNaN(amount) || !Number.isFinite(amount)) {
    return '₹0';
  }
  if (Math.abs(amount) >= 100000) {
    return '₹' + Number((amount / 100000).toFixed(1)) + 'L';
  }
  if (Math.abs(amount) >= 1000) {
    return '₹' + Number((amount / 1000).toFixed(1)) + 'k';
  }
  return '₹' + amount;
}

/**
 * Freshly generated id for a new income source, debt or expense row. Uses Web Crypto,
 * which is available in every target runtime (browsers under Vite and Node tests).
 */
export function generateId(): string {
  return globalThis.crypto.randomUUID();
}
