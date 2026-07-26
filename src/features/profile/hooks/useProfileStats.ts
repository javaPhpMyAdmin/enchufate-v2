/**
 * useProfileStats — aggregate rating stats across all chargers
 * owned by the current user. Used by the profile screen to display
 * live stat cards replacing hardcoded values.
 *
 * Query: select avg(avg_rating) and sum(review_count) from chargers
 * where owner_id = current user. A single query is sufficient since
 * hosts typically have few chargers.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { AppError, normalizeSupabaseError } from '@/lib/error';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/features/auth/hooks/useSession';

export interface ProfileStats {
  /** Average of all charger avg_ratings (1 decimal). */
  avgRating: number;
  /** Total review count across all chargers. */
  reviewCount: number;
}

export const PROFILE_STATS_KEY = ['profile-stats'] as const;

/**
 * Fetch aggregated rating stats for the current user's chargers.
 *
 *   const { data } = useProfileStats();
 *   // data.avgRating  → 4.3
 *   // data.reviewCount → 12
 */
export function useProfileStats(): UseQueryResult<ProfileStats, AppError> {
  const { user } = useSession();

  return useQuery<ProfileStats, AppError>({
    queryKey: user?.id
      ? [...PROFILE_STATS_KEY, user.id]
      : [...PROFILE_STATS_KEY, 'anonymous'],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user?.id) {
        throw new AppError({
          code: 'no_user',
          message: 'useProfileStats called without a user id',
          userMessage: 'Necesitás iniciar sesión.',
          isAuthError: true,
          retryable: false,
        });
      }

      const { data, error } = await supabase
        .from('chargers')
        .select('avg_rating, review_count')
        .eq('owner_id', user.id);

      if (error) throw normalizeSupabaseError(error);

      const chargers = data ?? [];
      const totalReviews = chargers.reduce(
        (sum, c) => sum + (c.review_count ?? 0),
        0,
      );
      const avgRating =
        totalReviews > 0
          ? chargers.reduce(
              (sum, c) =>
                sum + (c.avg_rating ?? 0) * (c.review_count ?? 0),
              0,
            ) / totalReviews
          : 0;

      return {
        avgRating: Math.round(avgRating * 10) / 10,
        reviewCount: totalReviews,
      };
    },
    staleTime: 60_000,
  });
}
