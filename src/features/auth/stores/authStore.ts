/**
 * Auth store — Zustand-backed shadow of the Supabase session.
 *
 * Why a shadow store when `useSession()` already holds the canonical
 * session in React state? Two reasons:
 *
 *   1. **Non-React readers** — any module outside the React tree
 *      (logger, network interceptor, Supabase client wrapper) can
 *      read the current user without subscribing to a hook. The
 *      `getState()` accessor is the single sync read.
 *   2. **Reactivity for non-screen code** — a Zustand selector lets
 *      side-effectful listeners (e.g. an analytics tagger) react
 *      to sign-in / sign-out without us wiring a custom event bus.
 *
 * `useSession()` is still the canonical source for React code; the
 * store is a mirror that stays in sync via `onAuthStateChange`.
 * The mutation actions are `setSession` and `clearSession` — they
 * do NOT call Supabase. Mutations live in the `useSignIn` /
 * `useSignOut` hooks; the store is write-only from React-land.
 */
import { create } from 'zustand';

import type { Session, User } from '../types';

export interface AuthStoreState {
  session: Session | null;
  user: User | null;
  /** Replace the current session + user in one call. */
  setSession: (session: Session | null) => void;
  /** Reset to logged-out state without touching Supabase. */
  clearSession: () => void;
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  session: null,
  user: null,
  setSession: (session) => set({ session, user: session?.user ?? null }),
  clearSession: () => set({ session: null, user: null }),
}));

/**
 * Sync read of the current user for non-React callers. Returns
 * `null` if no session is active. Use this from logger, error
 * boundaries, or Supabase wrappers that need the user id.
 */
export function getCurrentUser(): User | null {
  return useAuthStore.getState().user;
}
