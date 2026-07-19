/**
 * ConfirmModal — controlled modal with title + body + two actions.
 *
 * **Phase 7 (this commit)**: wires the atom that was deferred
 * from Phase 2 (see `tasks.md` line 244). The first consumer is
 * the reservation cancel flow on
 * `app/reservation/[id].tsx`; future consumers (sign-out in
 * Phase 5 PR-A re-pass, publish-wizard exit in Phase 8) will
 * drop in as the same `visible` / `onClose` / `onConfirm` API.
 *
 * Built on top of `react-native`'s built-in `Modal` (no extra
 * native dep). The two actions render as full-width Buttons:
 *   - Cancel (ghost variant) closes the modal via `onClose`.
 *   - Confirm (primary or danger variant) calls `onConfirm`.
 *
 * The `variant` prop controls the destructive confirm's tone:
 *   - `'default'` → primary orange (e.g. "Confirmar reserva").
 *   - `'danger'`  → red (e.g. "Cancelar y volver").
 *
 * Voseo copy: default labels are "Cancelar" + "Confirmar";
 * override with `cancelLabel` / `confirmLabel` for context-specific
 * copy ("Volver" / "Salir y perder los datos", etc.).
 */
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Button } from '@/components/atoms/Button';
import { colors, radius, spacing, typography } from '@/theme';

export type ConfirmModalVariant = 'default' | 'danger';

export interface ConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmModalVariant;
  /** Show a loading spinner on the confirm action while a mutation is in flight. */
  loading?: boolean;
  /** Disable the confirm action (e.g. when the form is invalid). */
  confirmDisabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ConfirmModal({
  visible,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'default',
  loading = false,
  confirmDisabled = false,
  style,
}: ConfirmModalProps): React.JSX.Element {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      {/* Backdrop — tap to close */}
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Cerrar"
        style={styles.backdrop}
      >
        {/* Card — stop propagation so taps inside don't dismiss */}
        <Pressable
          onPress={() => {
            /* swallow tap */
          }}
          style={[styles.card, style]}
          accessibilityRole="alert"
          accessibilityLabel={title}
        >
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {body ? <Text style={styles.body}>{body}</Text> : null}
          <View style={styles.actions}>
            <Button
              label={cancelLabel}
              variant="ghost"
              fullWidth
              onPress={onClose}
              accessibilityLabel={`${cancelLabel} y volver`}
            />
            <Button
              label={confirmLabel}
              variant={variant === 'danger' ? 'danger' : 'primary'}
              fullWidth
              loading={loading}
              disabled={confirmDisabled}
              onPress={onConfirm}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 20, 25, 0.55)', // colors.textPrimary with alpha
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    width: '100%',
    maxWidth: 420,
    gap: spacing.base,
  },
  title: { ...typography.title, color: colors.textPrimary },
  body: { ...typography.body, color: colors.textSecondary },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
