/**
 * useRespondToReview — mutation for a charger owner to respond to
 * a review on their charger.
 *
 * Sets `response` and `responded_at` on the review row. RLS
 * enforces that only the charger owner can respond (via
 * `is_charger_owner`).
 *
 * On success: invalidates charger-reviews so the ReviewCard picks
 * up the response.
 */
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { AppError, normalizeSupabaseError } from '@/lib/error';
import { isFeatureEnabled } from '@/lib/features';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/features/auth/hooks/useSession';

import { REVIEWS_KEY } from './useReviews';

export interface RespondToReviewInput {
  reviewId: string;
  chargerId: string;
  response: string;
}

export function useRespondToReview() {
  const { user } = useSession();
  const qc = useQueryClient();

  const mutation: UseMutationResult<void, AppError, RespondToReviewInput> = useMutation<
    void,
    AppError,
    RespondToReviewInput
  >({
    mutationFn: async ({ reviewId, chargerId: _chargerId, response }) => {
      if (!isFeatureEnabled('CHARGER_REVIEWS')) {
        throw new AppError({
          code: 'feature_disabled',
          message: 'CHARGER_REVIEWS feature flag is off',
          userMessage: 'Las reseñas no están disponibles.',
          retryable: false,
        });
      }

      if (!user?.id) {
        throw new AppError({
          code: 'no_user',
          message: 'useRespondToReview called without authed user',
          userMessage: 'Necesitás iniciar sesión para responder.',
          isAuthError: true,
          retryable: false,
        });
      }

      if (!response.trim()) {
        throw new AppError({
          code: 'empty_response',
          message: 'Response text is empty',
          userMessage: 'La respuesta no puede estar vacía.',
          retryable: false,
        });
      }

      // RLS enforces: is_charger_owner(charger_id) = true
      const { error } = await supabase
        .from('reviews')
        .update({
          response: response.trim(),
          responded_at: new Date().toISOString(),
        })
        .eq('id', reviewId);

      if (error) throw normalizeSupabaseError(error);
    },
    onSuccess: (_void, vars) => {
      void Promise.all([
        qc.invalidateQueries({ queryKey: REVIEWS_KEY(vars.chargerId) }),
        qc.invalidateQueries({ queryKey: ['charger', vars.chargerId] }),
      ]);
    },
  });

  return {
    respondToReview: (input: RespondToReviewInput) => mutation.mutateAsync(input),
    isPending: mutation.isPending,
    error: mutation.error ? normalizeSupabaseError(mutation.error) : null,
    reset: mutation.reset,
  };
}
