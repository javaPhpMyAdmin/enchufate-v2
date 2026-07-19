/**
 * Auth feature — public types.
 *
 * `Session` and `User` are the canonical Supabase types re-exported
 * here so feature code imports from a single place. Callers should
 * never import directly from `@supabase/supabase-js` for these
 * shapes — that keeps the public surface stable if we ever swap
 * the auth backend.
 *
 * `AuthError` is an alias for our `AppError`; we keep the
 * feature-facing name so call sites read as auth-domain code
 * (e.g. `useSignIn()` returns `error: AuthError`).
 */
import type { Session, User } from '@supabase/supabase-js';

import type { AppError } from '@/lib/error';

export type { Session, User };

/** Auth-domain error — same shape as `AppError`, just an alias. */
export type AuthError = AppError;

/** Flat shape exposed by `useSession()` for the UI layer. */
export interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
}
