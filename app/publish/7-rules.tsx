/**
 * Publish wizard — step 7: rules (free-text house rules).
 *
 * Single optional `Input` field, configured multiline via
 * `multiline + numberOfLines`. The `Input` atom doesn't expose
 * `maxLength`, so we truncate client-side in `onChangeText` to
 * keep the user from typing past the schema's 300-char ceiling
 * (same pattern as step 1 and step 3).
 *
 * **Live counter**: `0/300` under the field updates as the user
 * types. The counter is informational only — the field accepts
 * any length up to 300; the Siguiente CTA stays enabled because
 * rules are optional per the spec (an empty value round-trips
 * to `null` server-side).
 *
 * **"Publicar" CTA on the wizard nav**: the primary button label
 * flips to "Publicar" at step 7. On press it calls
 * `usePublishCharger().publish()` (via `<PublishWizardNav />`),
 * which uploads the photos and inserts the charger row. While
 * the mutation is in flight the button shows a loading spinner.
 */
import { useCallback } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePublishStore, PUBLISH_RULES_MAX, type PublishStep } from '@/stores/publishStore';
import { colors, radius, spacing, typography } from '@/theme';

export default function PublishStep7Rules(): React.JSX.Element {
  const insets = useSafeAreaInsets();

  // On mount, make sure the store's `step` matches the route. The
  // layout's useEffect also does this; the screen-level sync keeps
  // things correct if the user lands here via a stale deep link.
  const step = usePublishStore((s) => s.step);
  const setStep = usePublishStore((s) => s.setStep);
  if (step !== (7 as PublishStep)) setStep(7);

  const rules = usePublishStore((s) => s.rules);
  const setRules = usePublishStore((s) => s.setRules);

  // Truncate at the schema's ceiling so the user can't type past
  // it. Empty string is valid (rules are optional).
  const onChangeRules = useCallback(
    (next: string) => setRules(next.slice(0, PUBLISH_RULES_MAX)),
    [setRules],
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + spacing.lg },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Sumá reglas o indicaciones para los huéspedes</Text>
          <Text style={styles.subtitle}>
            Por ejemplo: "Dejá el cargador en su lugar después de usarlo" o "Tocá el timbre al llegar".
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Reglas del propietario (opcional)</Text>
          <View style={styles.textarea}>
            <TextInput
              value={rules}
              onChangeText={onChangeRules}
              placeholder="Contá lo que necesitás que sepan los huéspedes…"
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              autoCapitalize="sentences"
              style={styles.input}
            />
          </View>
          <Text style={styles.counter}>
            {rules.length}/{PUBLISH_RULES_MAX}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: {
    padding: spacing.base,
    gap: spacing.base,
  },
  header: { gap: spacing.xs },
  title: { ...typography.title, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textSecondary },
  field: { gap: spacing.xs },
  label: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },
  textarea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 160,
  },
  input: {
    ...typography.body,
    color: colors.textPrimary,
    minHeight: 140,
  },
  counter: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'right',
  },
});
