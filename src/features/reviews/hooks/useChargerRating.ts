/**
 * useChargerRating — read the denormalized avg_rating + review_count
 * directly from the charger row. No separate query needed; derive
 * from useCharger data.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { AppError, normalizeSupabaseError } from '@/lib/error';
import { supabase } from '@/lib/supabase';

export interface ChargerRating {
  avg_rating: number;
  review_count: number;
}

export const CHARGER_RATING_KEY = (chargerId: string) =>
  ['charger-rating', chargerId] as const;

/**
 * Fetch the denormalized rating aggregates for a single charger.
 *
 *   const { data } = useChargerRating(chargerId);
 *   // data.avg_rating  → 4.2
 *   // data.review_count → 7
 */
export function useChargerRating(
  chargerId: string | null | undefined,
): UseQueryResult<ChargerRating, AppError> {
  return useQuery<ChargerRating, AppError>({
    queryKey: chargerId ? CHARGER_RATING_KEY(chargerId) : ['charger-rating', 'none'],
    enabled: Boolean(chargerId),
    queryFn: async () => {
      if (!chargerId) {
        throw new AppError({
          code: 'no_id',
          message: 'useChargerRating called without a charger id',
          userMessage: 'No pudimos cargar la calificación.',
          retryable: false,
        });
      }

      const { data, error } = await supabase
        .from('chargers')
        .select('avg_rating, review_count')
        .eq('id', chargerId)
        .single();

      if (error) throw normalizeSupabaseError(error);

      return {
        avg_rating: data.avg_rating ?? 0,
        review_count: data.review_count ?? 0,
      };
    },
    staleTime: 60_000,
  });
}
