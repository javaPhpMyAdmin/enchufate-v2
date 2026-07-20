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

  // Manual Spanish relative-time strings — Intl.RelativeTimeFormat
  // is NOT available in Hermes on Android, so we build the "hace N"
  // prefix by hand. The abbreviations (min, h, d) match the design
  // spec for tight list rows.
  if (pastSec < 3600) {
    const m = Math.round(pastSec / 60);
    return m === 1 ? 'hace 1 min' : `hace ${m} min`;
  }
  if (pastSec < 86400) {
    const h = Math.round(pastSec / 3600);
    return h === 1 ? 'hace 1 h' : `hace ${h} h`;
  }
  if (pastSec < 86400 * 7) {
    const d = Math.round(pastSec / 86400);
    if (d === 1) return 'ayer';
    return `hace ${d} d`;
  }
  return formatDateTime(iso).split(',')[0]?.trim() ?? iso;
}

/**
 * Format an ISO timestamp as a long relative-time string with full
 * Spanish words (no abbreviations). Same bucketing rules as
 * `formatRelativeTime` but the output is meant for "wide" contexts:
 * inbox tooltips, reservation detail meta, and any place where the
 * text doesn't need to fit inside a 60px list-row trailing column.
 *
 * Output buckets (Rioplatense voseo):
 *   - < 30s      → 'recién'
 *   - < 60s      → 'hace un momento'
 *   - < 60min    → 'hace N minutos' / 'hace 1 minuto'
 *   - < 24h      → 'hace N horas'   / 'hace 1 hora'
 *   - exactly 1d → 'ayer'
 *   - < 7d       → 'hace N días'    / 'hace 1 día'
 *   - otherwise  → '18 jul' (short date, no year)
 *
 * Future dates fall back to a short date the same way
 * `formatRelativeTime` does.
 */
export function formatRelativeTimeLong(iso: string | Date): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return typeof iso === 'string' ? iso : '';
  }
  const now = Date.now();
  const diffMs = date.getTime() - now;
  const diffSec = Math.round(diffMs / 1000);

  if (diffSec > 0) {
    return formatDateTime(typeof iso === 'string' ? iso : iso.toISOString())
      .split(',')[0]
      ?.trim() ?? '';
  }
  const pastSec = Math.abs(diffSec);
  if (pastSec < 30) return 'recién';
  if (pastSec < 60) return 'hace un momento';

  // Manual Spanish relative-time strings — Intl.RelativeTimeFormat
  // is NOT available in Hermes on Android (see formatRelativeTime).
  // This long variant uses full words (minutos, horas, días) instead
  // of abbreviations, for wider contexts like tooltips.
  if (pastSec < 3600) {
    const m = Math.round(pastSec / 60);
    return m === 1 ? 'hace 1 minuto' : `hace ${m} minutos`;
  }
  if (pastSec < 86400) {
    const h = Math.round(pastSec / 3600);
    return h === 1 ? 'hace 1 hora' : `hace ${h} horas`;
  }
  if (pastSec < 86400 * 7) {
    const d = Math.round(pastSec / 86400);
    if (d === 1) return 'ayer';
    return d === 1 ? 'hace 1 día' : `hace ${d} días`;
  }
  return formatDateTime(typeof iso === 'string' ? iso : iso.toISOString())
    .split(',')[0]
    ?.trim() ?? '';
}

/**
 * Format a date range for reservation cards and inbox previews.
 *
 * Behaviour:
 *   - **Same day**: `18 jul, 14:30 — 16:00` (date once, both times)
 *   - **Different days, same month**: `18 jul — 20 jul` (no times when
 *     the range crosses midnight; the spec treats the all-day block
 *     as a span)
 *   - **Different months**: `18 jul — 2 ago` (no year)
 *   - **Different years**: `28 dic 2025 — 2 ene 2026` (year appended)
 *
 * Strings `start` and `end` accept either an ISO string or a `Date`.
 * Missing / invalid input returns an empty string (callers fall back
 * to a free-form label).
 */
export function formatDateRange(
  start: string | Date,
  end: string | Date,
): string {
  const s = start instanceof Date ? start : new Date(start);
  const e = end instanceof Date ? end : new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
    return '';
  }
  const sameDay =
    s.getFullYear() === e.getFullYear() &&
    s.getMonth() === e.getMonth() &&
    s.getDate() === e.getDate();

  const dateFmt = new Intl.DateTimeFormat('es-UY', {
    day: 'numeric',
    month: 'short',
  })
    .format(s)
    .replace(/\u00a0/g, ' ')
    .replace(/\.$/, '');

  if (sameDay) {
    const timeFmt = new Intl.DateTimeFormat('es-UY', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${dateFmt}, ${timeFmt.format(s)} — ${timeFmt.format(e)}`;
  }

  const endDateFmt = new Intl.DateTimeFormat('es-UY', {
    day: 'numeric',
    month: 'short',
  })
    .format(e)
    .replace(/\u00a0/g, ' ')
    .replace(/\.$/, '');
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  if (sameMonth) {
    return `${dateFmt} — ${endDateFmt}`;
  }
  const sameYear = s.getFullYear() === e.getFullYear();
  if (sameYear) {
    return `${dateFmt} — ${endDateFmt}`;
  }
  // Different years — append the year to both ends.
  const longFmt = (d: Date): string =>
    new Intl.DateTimeFormat('es-UY', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
      .format(d)
      .replace(/\u00a0/g, ' ')
      .replace(/\.$/, '');
  return `${longFmt(s)} — ${longFmt(e)}`;
}
