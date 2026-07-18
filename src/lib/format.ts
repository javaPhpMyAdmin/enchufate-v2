/**
 * Pure formatters — no React, no Supabase, no side effects.
 *
 * All output is Rioplatense voseo where the string is user-facing
 * copy ("hace 5 min", "ayer", "$ 15,50"). Pure data formatters
 * (currency, date) use the `es-UY` Intl locale so the output matches
 * the Uruguay market and stays consistent across iOS / Android / web.
 */

/**
 * Format a price in the local currency using Uruguay conventions
 * (comma as decimal separator, dot as thousands separator).
 *
 * Examples (es-UY):
 *   formatPrice(15.5, 'UYU')  → '$ 15,50'
 *   formatPrice(1500, 'UYU') → '$ 1.500,00'
 *   formatPrice(0, 'UYU')    → '$ 0,00'
 *   formatPrice(9.99, 'USD') → 'US$ 9,99'
 *
 * For UYU we use a literal `$` prefix to match the conventions of
 * local wallets (Mercado Pago, BROU, etc.) rather than the ISO 4217
 * symbol "UYU" that Intl would emit.
 */
export function formatPrice(price: number, currency: string): string {
  const numeric = new Intl.NumberFormat('es-UY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
  if (currency === 'UYU') return `$ ${numeric}`;
  if (currency === 'USD') return `US$ ${numeric}`;
  return `${currency} ${numeric}`;
}

/**
 * Format a distance in meters. Below 1 km we render meters with no
 * decimal; from 1 km up we render kilometers with 1 decimal.
 *
 * Examples:
 *   formatDistance(500)   → '500 m'
 *   formatDistance(999)   → '999 m'
 *   formatDistance(1000)  → '1,0 km'
 *   formatDistance(2340)  → '2,3 km'
 *   formatDistance(12500) → '12,5 km'
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const km = meters / 1000;
  return new Intl.NumberFormat('es-UY', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(km).concat(' km');
}

/**
 * Format an ISO timestamp as a short, locale-correct date+time string.
 *
 * Example:
 *   formatDateTime('2026-07-18T14:30:00Z') → '18 jul, 14:30'
 *
 * The wall-clock time is rendered in the device's local timezone
 * (matches what the user sees on the charger detail / reservation
 * card). The date is the local-date of the same instant.
 */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  // es-UY short month renders with a trailing period ("jul."). Strip
  // it so the output matches the design spec ("18 jul, 14:30").
  const datePart = new Intl.DateTimeFormat('es-UY', {
    day: 'numeric',
    month: 'short',
  })
    .format(date)
    .replace(/\u00a0/g, ' ')
    .replace(/\.$/, '');
  const timePart = new Intl.DateTimeFormat('es-UY', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return `${datePart}, ${timePart}`;
}

/**
 * Format an ISO timestamp as a relative-time string suitable for
 * chat and reservation list UIs.
 *
 * Output buckets (Rioplatense voseo):
 *   - < 30s      → 'recién'
 *   - < 60s      → 'hace un momento'
 *   - < 60min    → 'hace N min'
 *   - < 24h      → 'hace N h'
 *   - exactly 1d → 'ayer'
 *   - < 7d       → 'hace N d'
 *   - otherwise  → '18 jul' (short date, no year)
 *
 * Uses `Intl.RelativeTimeFormat('es-UY', { numeric: 'always' })` to
 * get the "hace N" prefix and Spanish agreement, then post-processes
 * the unit to the abbreviated form ('min', 'h', 'd') for tight list
 * rows. Future dates fall back to a short date.
 */
export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const now = Date.now();
  const diffMs = date.getTime() - now;
  const diffSec = Math.round(diffMs / 1000);

  if (diffSec > 0) {
    // Future timestamp — show absolute date.
    return formatDateTime(iso).split(',')[0]?.trim() ?? iso;
  }
  const pastSec = Math.abs(diffSec);
  if (pastSec < 30) return 'recién';
  if (pastSec < 60) return 'hace un momento';

  const rtf = new Intl.RelativeTimeFormat('es-UY', { numeric: 'always' });

  if (pastSec < 3600) {
    const m = Math.round(pastSec / 60);
    return rtf
      .format(-m, 'minute')
      .replace('minutos', 'min')
      .replace('minuto', 'min');
  }
  if (pastSec < 86400) {
    const h = Math.round(pastSec / 3600);
    return rtf
      .format(-h, 'hour')
      .replace('horas', 'h')
      .replace('hora', 'h');
  }
  if (pastSec < 86400 * 7) {
    const d = Math.round(pastSec / 86400);
    if (d === 1) return 'ayer';
    return rtf
      .format(-d, 'day')
      .replace('días', 'd')
      .replace('día', 'd');
  }
  return formatDateTime(iso).split(',')[0]?.trim() ?? iso;
}
