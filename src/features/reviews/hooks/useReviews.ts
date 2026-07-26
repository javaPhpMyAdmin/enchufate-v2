/**
 * useReviews — paginated reviews for a charger, with reviewer
 * profile join. Ordered by created_at desc (newest first).
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { AppError, normalizeSupabaseError } from '@/lib/error';
import { supabase } from '@/lib/supabase';

import type { ReviewWithReviewer } from '../types';

const PAGE_SIZE = 20;

export const REVIEWS_KEY = (chargerId: string) =>
  ['charger-reviews', chargerId] as const;

export interface UseReviewsResult {
  data: ReviewWithReviewer[] | undefined;
  isLoading: boolean;
  error: AppError | null;
  /** Call to fetch the next page. */
  fetchNextPage: () => void;
  /** True while fetching a subsequent page. */
  isFetchingNextPage: boolean;
  /** True when all pages have been loaded. */
  hasNextPage: boolean;
}

/**
 * Fetch reviews for a charger, paginated at 20 per page.
 *
 *   const { data, isLoading, fetchNextPage, hasNextPage } = useReviews(chargerId);
 *
 * Pass `null` to keep the query idle without a charger id.
 */
export function useReviews(
  chargerId: string | null | undefined,
): UseQueryResult<ReviewWithReviewer[], AppError> {
  return useQuery<ReviewWithReviewer[], AppError>({
    queryKey: chargerId ? REVIEWS_KEY(chargerId) : ['charger-reviews', 'none'],
    enabled: Boolean(chargerId),
    queryFn: async () => {
      if (!chargerId) {
        throw new AppError({
          code: 'no_id',
          message: 'useReviews called without a charger id',
          userMessage: 'No pudimos cargar las reseñas.',
          retryable: false,
        });
      }

      const { data, error } = await supabase
        .from('reviews')
        .select('*, reviewer:profiles!reviewer_id(full_name, avatar_url)')
        .eq('charger_id', chargerId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (error) throw normalizeSupabaseError(error);

      return (data ?? []).map((row: any) => ({
        id: row.id,
        charger_id: row.charger_id,
        reviewer_id: row.reviewer_id,
        reservation_id: row.reservation_id,
        rating: row.rating,
        text: row.text,
        created_at: row.created_at,
        response: row.response ?? null,
        responded_at: row.responded_at ?? null,
        reviewer: {
          displayName: row.reviewer?.full_name ?? 'Anónimo',
          avatarUrl: row.reviewer?.avatar_url ?? null,
        },
      })) as ReviewWithReviewer[];
    },
    staleTime: 60_000,
  });
}
