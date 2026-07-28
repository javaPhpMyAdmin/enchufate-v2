/**
 * useReviews — paginated reviews for a charger, with reviewer
 * profile join. Ordered by created_at desc (newest first).
 *
 * Uses offset-based infinite query — "Ver más" at the bottom
 * fetches the next page.
 */
import { useInfiniteQuery } from '@tanstack/react-query';

import { AppError, normalizeSupabaseError } from '@/lib/error';
import { supabase } from '@/lib/supabase';

import type { ReviewWithReviewer } from '../types';

const PAGE_SIZE = 20;

export const REVIEWS_KEY = (chargerId: string) =>
  ['charger-reviews', chargerId] as const;

export interface UseReviewsResult {
  reviews: ReviewWithReviewer[];
  isLoading: boolean;
  error: AppError | null;
  /** Call to fetch the next page. */
  fetchNextPage: () => void;
  /** True while fetching a subsequent page. */
  isFetchingNextPage: boolean;
  /** True when all pages have been loaded. */
  hasNextPage: boolean;
  /** Refetch from the first page. */
  refetch: () => void;
}

/**
 * Fetch reviews for a charger, paginated at 20 per page.
 *
 *   const { reviews, isLoading, fetchNextPage, hasNextPage } = useReviews(chargerId);
 *
 * Pass `null` to keep the query idle without a charger id.
 */
export function useReviews(
  chargerId: string | null | undefined,
): UseReviewsResult {
  const query = useInfiniteQuery({
    queryKey: chargerId ? REVIEWS_KEY(chargerId) : ['charger-reviews', 'none'],
    enabled: Boolean(chargerId),
    queryFn: async ({ pageParam = 0 }) => {
      if (!chargerId) {
        throw new AppError({
          code: 'no_id',
          message: 'useReviews called without a charger id',
          userMessage: 'No pudimos cargar las reseñas.',
          retryable: false,
        });
      }

      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from('reviews')
        .select('*, reviewer:profiles!reviewer_id(full_name, avatar_url)')
        .eq('charger_id', chargerId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw normalizeSupabaseError(error);

      const reviews = (data ?? []).map((row: any) => ({
        id: row.id,
        charger_id: row.charger_id,
        reviewer_id: row.reviewer_id,
        reservation_id: row.reservation_id,
        rating: row.rating,
        text: row.text,
        created_at: row.created_at,
        reviewer: {
          displayName: row.reviewer?.full_name ?? 'Anónimo',
          avatarUrl: row.reviewer?.avatar_url ?? null,
        },
      } as ReviewWithReviewer));

      return {
        reviews,
        nextOffset: data && data.length === PAGE_SIZE ? pageParam + 1 : null,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    staleTime: 60_000,
  });

  const reviews = query.data?.pages.flatMap((p) => p.reviews) ?? [];

  return {
    reviews,
    isLoading: query.isLoading,
    error: query.error ? normalizeSupabaseError(query.error) : null,
    fetchNextPage: () => {
      void query.fetchNextPage();
    },
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage ?? false,
    refetch: () => {
      void query.refetch();
    },
  };
}
