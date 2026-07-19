/**
 * PermissionToast — top-of-screen banner for transient permission / setup
 * prompts.
 *
 * Designed for the "you denied location, here's how to flip it on" pattern
 * that lives on the Mapa tab and the publish wizard's location step. The
 * banner is `position: absolute` over the screen content; the parent
 * (Map / publish step) is responsible for offsetting any chrome below it
 * (none today — the map is full-bleed and the publish screen has a
 * pinned nav at the bottom, which the banner never overlaps).
 *
 * **Auto-dismiss** — after 6 seconds the banner fades out and calls
 * `onDismiss`. The timer is cleared on unmount or on a manual dismiss
 * so a quick user tap doesn't fight the timeout.
 *
 * **CTA** — when `onCtaPress` is provided the right-hand Button calls
 * it (the standard use is `Linking.openSettings()`). The Button label
 * defaults to "Activar" per the voseo spec, overridable via `ctaLabel`.
 *
 * The banner does not own the location logic — it's a presentation-only
 * component. The caller decides when to show / hide it (e.g. on FAB
 * tap, on permission denied, etc.).
 */
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { colors, radius, spacing, typography } from '@/theme';

const AUTO_DISMISS_MS = 6000;

export interface PermissionToastProps {
  /** When `true` the banner is mounted and animates in. */
  visible: boolean;
  /** Fired when the banner auto-dismisses OR the user taps the X. */
  onDismiss: () => void;
  /** Copy that explains the prompt (voseo). */
  message: string;
  /** Optional CTA label. Defaults to "Activar". */
  ctaLabel?: string;
  /** Optional CTA action. When omitted, no Button is rendered. */
  onCtaPress?: () => void;
}

export function PermissionToast({
  visible,
  onDismiss,
  message,
  ctaLabel = 'Activar',
  onCtaPress,
}: PermissionToastProps): React.JSX.Element | null {
  const insets = useSafeAreaInsets();
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) {
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current);
        dismissTimer.current = null;
      }
      return;
    }
    dismissTimer.current = setTimeout(() => {
      onDismiss();
    }, AUTO_DISMISS_MS);
    return () => {
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current);
        dismissTimer.current = null;
      }
    };
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { top: insets.top + spacing.sm }]}
    >
      <View style={styles.banner} accessibilityLiveRegion="polite">
        <View style={styles.body}>
          <Text style={styles.message} numberOfLines={3}>
            {message}
          </Text>
        </View>
        <View style={styles.actions}>
          {onCtaPress ? (
            <Button
              label={ctaLabel}
              variant="primary"
              size="sm"
              onPress={onCtaPress}
            />
          ) : null}
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Cerrar aviso"
            hitSlop={8}
            style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
          >
            <Icon icon={X} size="sm" color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.base,
    right: spacing.base,
    zIndex: 100,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: radius.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  body: { flex: 1 },
  message: { ...typography.caption, color: colors.textPrimary },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  close: { padding: spacing.xs, marginLeft: spacing.xs },
  closePressed: { opacity: 0.7 },
});
