/**
 * Profile — the canonical TypeScript shape for a user profile record.
 *
 * Mirrors the `public.profiles` table that will be created in the
 * auth-related migration (Phase 6 of `mvp-bootstrap`). The hook
 * returns a concrete `Profile` interface so the screen can render
 * the avatar, display name, "Miembro desde", and stat cards today
 * (with mocks) without waiting for the migration.
 *
 * The `created_at` timestamp is what drives the "Miembro desde
 * {month} de {year}" header line (per the profile spec scenario).
 */
export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  /** ISO 8601 timestamp; the screen formats it with `Intl.DateTimeFormat`. */
  created_at: string;
  /** ISO 8601 timestamp; reserved for v2.1 profile-edit flows. */
  updated_at: string;
}
