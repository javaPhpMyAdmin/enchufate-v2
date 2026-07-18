/**
 * TanStack Query — single shared QueryClient.
 *
 * Per `design.md §11.1` (Performance & resilience), these are the
 * APP-WIDE defaults. Per-query overrides (stale time, refetch
 * interval) are applied in the feature hooks themselves; this file
 * only sets the policy that every query inherits unless it opts out.
 *
 * Defaults rationale:
 *
 * - `staleTime: 30_000` — charger list view can show stale data for
 *   30s before refetching. Matches the `useChargers` per-query
 *   stale time. Hooks that need longer (e.g. `useCharger` at 5 min)
 *   override per-query; hooks that need realtime (e.g. `useMessages`)
 *   set staleTime: 0 so invalidations from the Realtime channel are
 *   the only source of truth.
 * - `retry: 1` — one automatic retry on transient failure. Anything
 *   that fails twice is shown to the user via `<ErrorState />`.
 * - `refetchOnWindowFocus: false` — Expo/RN apps don't have a
 *   well-defined "window focus" event; the default `true` causes
 *   spurious refetches when the user backgrounds and resumes the
 *   app. The pattern in `useReservations` and `useConversations` is
 *   to refetch on `useFocusEffect()` from `expo-router` instead.
 *
 * TanStack Query v5 typing: we extend `QueryClientConfig` so callers
 * get autocomplete on the `defaultOptions` shape.
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Mutations should not retry by default — the user is waiting
      // on a click, and silently retrying can mask logic bugs in
      // optimistic-rollback. Hooks that want retry (e.g. background
      // message sends) opt in explicitly.
      retry: 0,
    },
  },
});

export type AppQueryClient = typeof queryClient;
