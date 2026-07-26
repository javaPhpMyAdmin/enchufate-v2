/**
 * useNotificationPreferences — fetch and update the current user's
 * push notification preferences.
 *
 * On first access, inserts a default row (all true) if none exists,
 * then returns the preferences. Updates are optimistic via
 * `useMutation` and invalidate the query on success.
 *
 * The Edge Function `send-push` reads this table to decide whether
 * to deliver a push to a given user and notification type.
 */
import { useEffect } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';

import { AppError, normalizeSupabaseError } from '@/lib/error';
import { isFeatureEnabled } from '@/lib/features';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/features/auth/hooks/useSession';

export interface NotificationPreferences {
  user_id: string;
  reservations: boolean;
  messages: boolean;
  reviews: boolean;
  promotions: boolean;
  created_at: string | null;
  updated_at: string | null;
}

const PREFS_KEY = ['notification-preferences'] as const;

/**
 * Fetch or create the current user's notification preferences.
 *
 * Returns the same `UseQueryResult` shape as other hooks, plus
 * `updatePreferences` to toggle individual flags.
 */
export function useNotificationPreferences() {
  const { user } = useSession();
  const qc = useQueryClient();
  const enabled = Boolean(user?.id) && isFeatureEnabled('PUSH_NOTIFICATIONS');

  const query = useQuery<NotificationPreferences, AppError>({
    queryKey: user?.id ? [...PREFS_KEY, user.id] : ['notification-preferences', 'none'],
    enabled,
    queryFn: async () => {
      if (!user?.id) {
        throw new AppError({
          code: 'no_user',
          message: 'useNotificationPreferences called without authed user',
          userMessage: 'Necesitás iniciar sesión.',
          isAuthError: true,
          retryable: false,
        });
      }

      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        // PGRST116 = no rows found → insert defaults
        if (error.code === 'PGRST116') {
          const { data: inserted, error: insertErr } = await supabase
            .from('notification_preferences')
            .insert({ user_id: user.id })
            .select()
            .single();
          if (insertErr) throw normalizeSupabaseError(insertErr);
          return inserted as NotificationPreferences;
        }
        throw normalizeSupabaseError(error);
      }

      return data as NotificationPreferences;
    },
    staleTime: 60_000,
  });

  const updateMutation = useMutation<
    void,
    AppError,
    Partial<Pick<NotificationPreferences, 'reservations' | 'messages' | 'reviews' | 'promotions'>>
  >({
    mutationFn: async (patch) => {
      if (!user?.id) {
        throw new AppError({
          code: 'no_user',
          message: 'useNotificationPreferences.update called without authed user',
          userMessage: 'Necesitás iniciar sesión.',
          isAuthError: true,
          retryable: false,
        });
      }

      const { error } = await supabase
        .from('notification_preferences')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (error) throw normalizeSupabaseError(error);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...PREFS_KEY, user?.id ?? ''] });
    },
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    updatePreferences: (patch: Partial<Pick<NotificationPreferences, 'reservations' | 'messages' | 'reviews' | 'promotions'>>) =>
      updateMutation.mutateAsync(patch),
    isUpdating: updateMutation.isPending,
  };
}
