/**
 * useCharger — fetch a single charger by id, joined with the host
 * profile.
 *
 * **Phase 6 PR-A (this commit)**: looks up the matching charger
 * from `MOCK_CHARGERS` and joins the host profile from
 * `MOCK_HOSTS` by `owner_id`. The `ChargerWithHost` shape is
 * `{ ...Charger, host: { id, displayName, avatarUrl, createdAt } }`
 * — same as the real Supabase join `select('*, host:profiles!owner_id(*)')`
 * will return in Phase 7. The hook signature, query key, and
 * `staleTime: 5 * 60_000` per `design.md §4.3` stay identical so
 * the screen does not change when the real `queryFn` lands.
 *
 * Validation note: the returned object is typed as `ChargerWithHost`
 * via TypeScript. The Zod `chargerSchema` is wired in a follow-up
 * commit (Phase 6 PR-A commit 3 — the schemas) and parses the
 * mock on read so a bad fixture surfaces immediately rather than
 * blowing up the screen render.
 *
 * Throws an `AppError` with `code: 'not_found'` when the charger
 * doesn't exist so the screen can render its "Cargador no
 * encontrado" error state. The "no id" path mirrors the pattern
 * in `useReservation` and `useProfile`.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { AppError } from '@/lib/error';

import { MOCK_CHARGERS } from '../data/mockChargers';
import { MOCK_HOSTS, type MockHost } from '../data/mockHosts';
import type { Charger } from '../types';

/**
 * Public host shape returned by the hook. Matches the columns
 * selected from `public.profiles` by the real Phase 7 query.
 */
export interface ChargerHost {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  /** ISO 8601 — `profiles.created_at`. */
  createdAt: string;
}

/**
 * Charger joined with its host profile. The hook always returns
 * this shape (never the bare `Charger`) so the screen reads a
 * single object without a second round-trip.
 */
export interface ChargerWithHost extends Charger {
  host: ChargerHost;
}

const QUERY_KEY = (id: string) => ['charger', id] as const;

export interface UseChargerResult {
  data: ChargerWithHost | undefined;
  isLoading: boolean;
  error: AppError | null;
}

/**
 * Single charger lookup with the host profile inlined.
 *
 *   const { data, isLoading, error, refetch } = useCharger(id);
 *
 * Pass `null` or `undefined` to render the screen's "missing id"
 * state without firing a query (the `enabled` gate is `false` in
 * that case).
 */
export function useCharger(
  id: string | null | undefined,
): UseQueryResult<ChargerWithHost, AppError> {
  return useQuery<ChargerWithHost, AppError>({
    queryKey: id ? QUERY_KEY(id) : ['charger', 'anonymous'],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) {
        throw new AppError({
          code: 'no_id',
          message: 'useCharger called without an id',
          userMessage: 'No encontramos este cargador.',
          retryable: false,
        });
      }
      // Simulate network latency so the LoadingState is visible
      // when navigating from a list / map pin.
      await new Promise((r) => setTimeout(r, 200));
      const charger = MOCK_CHARGERS.find((c) => c.id === id);
      if (!charger) {
        throw new AppError({
          code: 'not_found',
          message: `Charger ${id} not found`,
          userMessage: 'No encontramos este cargador.',
          retryable: false,
        });
      }
      const host = MOCK_HOSTS[charger.owner_id];
      if (!host) {
        // Defensive: every mock charger has a matching host entry,
        // but a bad fixture would surface here. Throw a typed error
        // so the screen renders its error state rather than crashing.
        throw new AppError({
          code: 'host_not_found',
          message: `Host ${charger.owner_id} not found for charger ${charger.id}`,
          userMessage: 'No encontramos la información del anfitrión.',
          retryable: false,
        });
      }
      return { ...charger, host: toPublicHost(host) };
    },
    staleTime: 5 * 60_000,
  });
}

/** Map the internal `MockHost` shape onto the public `ChargerHost`. */
function toPublicHost(host: MockHost): ChargerHost {
  return {
    id: host.id,
    displayName: host.displayName,
    avatarUrl: host.avatarUrl,
    createdAt: host.createdAt,
  };
}
