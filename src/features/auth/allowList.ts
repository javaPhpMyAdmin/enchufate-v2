/**
 * Return-to allow-list — gate for the `?returnTo=` query param on
 * the login screen.
 *
 * The login screen reads `?returnTo=<path>` from the URL so a deep
 * link to /profile, /reservations, etc. can bounce through auth
 * without losing the user's intended destination. But we MUST
 * validate the path before navigating to it — otherwise an attacker
 * could craft a link like `/login?returnTo=https://evil.com` and
 * the post-login `router.replace(returnTo)` would either navigate
 * to an external URL (Expo Router rejects) or, in a less hardened
 * stack, redirect the user to a phishing page.
 *
 * The allow-list is the only source of truth for "where login can
 * send the user". Every protected route in the app MUST be added
 * here. The glob `*` segment matches a single path segment only
 * (not nested children) — this is intentional; it limits the blast
 * radius if a wildcard is later added to a malicious path.
 */
const ALLOWED_EXACT = new Set<string>([
  '/profile',
  '/reservations',
  '/messages',
  '/publish/1-name',
]);

const ALLOWED_PREFIXES = ['/charger/'] as const;

/**
 * Returns `true` when `path` is a safe post-login destination.
 * The check is path-only — query strings and fragments are stripped
 * before comparison so `?returnTo=/profile?foo=bar` still validates
 * as `/profile`. External URLs (`http://...`) always fail.
 */
export function isAllowedReturnTo(path: string): boolean {
  if (typeof path !== 'string' || path.length === 0) return false;

  // External URLs are never allowed.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path)) return false;

  // Strip query string and hash; only the pathname is gated.
  const pathname = path.split('?')[0]?.split('#')[0] ?? '';

  if (ALLOWED_EXACT.has(pathname)) return true;

  return ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
