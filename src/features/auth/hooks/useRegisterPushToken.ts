import { useEffect } from 'react';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { registerForPushNotificationsAsync } from '@/lib/notifications';
import { isFeatureEnabled } from '@/lib/features';
import { useSession } from './useSession';

/**
 * On mount (when user is authenticated), register for push notifications
 * and upsert the token into push_tokens. Runs once per session.
 */
export function useRegisterPushToken() {
  const { session } = useSession();

  useEffect(() => {
    if (!isFeatureEnabled('PUSH_NOTIFICATIONS')) return;
    if (!session?.user) return;

    let cancelled = false;

    (async () => {
      const token = await registerForPushNotificationsAsync();
      if (cancelled || !token) return;

      const { error } = await supabase.from('push_tokens').upsert(
        {
          user_id: session.user.id,
          token,
          platform: Platform.OS as 'ios' | 'android',
        },
        { onConflict: 'token' },
      );

      if (error) console.warn('[Push] Failed to save token:', error.message);
    })();

    return () => {
      cancelled = true;
    };
  }, [session]);
}
