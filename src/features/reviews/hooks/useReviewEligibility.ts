/**
 * useReviewEligibility — check if the current user can leave a
 * review for a given reservation.
 *
 * Conditions:
 *   1. Reservation status is `completada`
 *   2. No existing review for this reservation from the current user
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { AppError, normalizeSupabaseError } from '@/lib/error';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/features/auth/hooks/useSession';

export interface ReviewEligibility {
  canReview: boolean;
  /** If a review already exists, its id. */
  existingReviewId?: string;
}

export const REVIEW_ELIGIBILITY_KEY = (reservationId: string) =>
  ['review-eligibility', reservationId] as const;

/**
 * Determine whether the current user can leave a review for a
 * reservation.
 *
 *   const { data } = useReviewEligibility(reservationId);
 *   // data.canReview → true | false
 */
export function useReviewEligibility(
  reservationId: string | null | undefined,
): UseQueryResult<ReviewEligibility, AppError> {
  const { user } = useSession();

  return useQuery<ReviewEligibility, AppError>({
    queryKey:
      reservationId && user?.id
        ? REVIEW_ELIGIBILITY_KEY(reservationId)
        : ['review-eligibility', 'none'],
    enabled: Boolean(reservationId && user?.id),
    queryFn: async () => {
      if (!reservationId || !user?.id) {
        throw new AppError({
          code: 'no_user',
          message: 'useReviewEligibility called without reservation or user',
          userMessage: 'Necesitás iniciar sesión.',
          isAuthError: true,
          retryable: false,
        });
      }

      // 1. Fetch the reservation status + renter_id
      const { data: reservation, error: resError } = await supabase
        .from('reservations')
        .select('status, renter_id')
        .eq('id', reservationId)
        .single();

      if (resError) throw normalizeSupabaseError(resError);

      // Must be completada and the renter
      if (reservation.status !== 'completada' || reservation.renter_id !== user.id) {
        return { canReview: false };
      }

      // 2. Check if a review already exists for this reservation
      const { data: existing, error: revError } = await supabase
        .from('reviews')
        .select('id')
        .eq('reservation_id', reservationId)
        .eq('reviewer_id', user.id)
        .maybeSingle();

      if (revError) throw normalizeSupabaseError(revError);

      if (existing) {
        return { canReview: false, existingReviewId: existing.id };
      }

      return { canReview: true };
    },
    staleTime: 30_000,
  });
}
