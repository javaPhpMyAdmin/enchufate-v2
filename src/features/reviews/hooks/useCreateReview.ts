/**
 * useCreateReview — mutation that inserts a new review for a
 * completed reservation.
 *
 * Guards:
 *   - Feature flag: CHARGER_REVIEWS must be enabled
 *   - Auth check: user must be signed in
 *   - Validation: rating 1–5, text optional
 *   - Server-side: RLS enforces renter of completada reservation + one per reservation
 *
 * On success: invalidates charger-reviews, charger-rating, and profile-stats keys
 * so the UI picks up the new data on next render.
 */
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { AppError, normalizeSupabaseError } from '@/lib/error';
import { isFeatureEnabled } from '@/lib/features';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/features/auth/hooks/useSession';

import { CHARGER_RATING_KEY } from './useChargerRating';
import { REVIEWS_KEY } from './useReviews';
import type { CreateReviewInput } from '../types';

export function useCreateReview() {
  const { user } = useSession();
  const qc = useQueryClient();

  const mutation: UseMutationResult<void, AppError, CreateReviewInput> = useMutation<
    void,
    AppError,
    CreateReviewInput
  >({
    mutationFn: async ({ reservationId, chargerId, rating, text }) => {
      if (!isFeatureEnabled('CHARGER_REVIEWS')) {
        throw new AppError({
          code: 'feature_disabled',
          message: 'CHARGER_REVIEWS feature flag is off',
          userMessage: 'Las reseñas no están disponibles en este momento.',
          retryable: false,
        });
      }

      if (!user?.id) {
        throw new AppError({
          code: 'no_user',
          message: 'useCreateReview called without an authed user',
          userMessage: 'Necesitás iniciar sesión para dejar una reseña.',
          isAuthError: true,
          retryable: false,
        });
      }

      // Client-side validation: rating must be 1–5
      if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
        throw new AppError({
          code: 'invalid_rating',
          message: `Rating must be an integer between 1 and 5, got ${rating}`,
          userMessage: 'La calificación debe ser un número entero del 1 al 5.',
          retryable: false,
        });
      }

      // Server-side insert — RLS enforces:
      //   - reviewer_id = auth.uid()
      //   - reservation exists with status = completada
      //   - renter_id matches
      //   - unique(reservation_id) prevents duplicates
      const { error } = await supabase.from('reviews').insert({
        charger_id: chargerId,
        reviewer_id: user.id,
        reservation_id: reservationId,
        rating,
        text: text ?? null,
      });

      if (error) throw normalizeSupabaseError(error);
    },
    onSuccess: (_void, vars) => {
      void Promise.all([
        qc.invalidateQueries({ queryKey: REVIEWS_KEY(vars.chargerId) }),
        qc.invalidateQueries({ queryKey: CHARGER_RATING_KEY(vars.chargerId) }),
        qc.invalidateQueries({ queryKey: ['charger', vars.chargerId] }),
        qc.invalidateQueries({ queryKey: ['chargers'] }),
        qc.invalidateQueries({ queryKey: ['profile-stats'] }),
      ]);
    },
  });

  return {
    createReview: (input: CreateReviewInput) => mutation.mutateAsync(input),
    isPending: mutation.isPending,
    error: mutation.error ? normalizeSupabaseError(mutation.error) : null,
    reset: mutation.reset,
  };
}
