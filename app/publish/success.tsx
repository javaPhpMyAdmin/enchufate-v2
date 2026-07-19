/**
 * Publish wizard — success screen.
 *
 * Reached via `router.replace('/publish/success')` from
 * `usePublishCharger.publish()` once the mutation completes. The
 * publish store is already wiped at that point (the mutation's
 * `onSuccess` calls `resetWizard()`), so navigating away to
 * `/profile` is safe — the new charger is now in the `chargers`
 * cache and `useMyChargers` (Phase 5) picks it up on the next
 * render.
 *
 * The screen is intentionally minimal: a check icon, a "Cargador
 * publicado" headline, the voseo body copy from the spec, and a
 * single "Ir a Mis cargadores" CTA that pushes to `/profile`. We
 * don't render a custom back arrow — `useRouter` lives outside a
 * Stack, so the user uses the bottom tab bar to leave.
 */
import { useRouter } from 'expo-router';
import { CheckCircle2 } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/atoms/Button';
import { colors, spacing, typography } from '@/theme';

export default function PublishSuccess(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const onGoToMyChargers = () => {
    router.replace('/(tabs)/profile' as never);
  };

  return (
    <View
      style={[
        styles.flex,
        styles.center,
        { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xxl },
      ]}
    >
      <CheckCircle2 size={88} color={colors.success} strokeWidth={2} />
      <Text style={styles.title}>¡Cargador publicado!</Text>
      <Text style={styles.body}>
        Tu cargador ya está visible para los huéspedes cerca de tu zona.
      </Text>
      <View style={styles.cta}>
        <Button label="Ir a Mis cargadores" variant="primary" onPress={onGoToMyChargers} fullWidth />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  title: {
    ...typography.display,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  cta: {
    width: '100%',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xxl,
  },
});
