/**
 * Publish wizard — step 1: name + description.
 *
 * Two `Input` fields with live character counters. The "Siguiente"
 * CTA lives in `<PublishWizardNav />` (rendered by the layout), so
 * this screen only manages the form state. We mirror the limits
 * from `chargerSchema` (title 1–80, description ≤500) and truncate
 * on input so the user can't type past the schema's ceiling.
 *
 * **Why no local state**: the wizard's whole point is the draft
 * survives an app kill, so every keystroke goes straight to the
 * persisted `usePublishStore`. The component re-renders are
 * cheap — Zustand only re-renders the components that read the
 * changed field (via the selector).
 */
import { useCallback } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Input } from '@/components/atoms/Input';
import {
  usePublishStore,
  validateStep1,
  type PublishStep,
} from '@/stores/publishStore';
import { colors, spacing, typography } from '@/theme';

/** chargerSchema title limit — must stay in sync with src/lib/schemas/charger.ts. */
const TITLE_MAX = 80;
/** chargerSchema description limit — must stay in sync with src/lib/schemas/charger.ts. */
const DESCRIPTION_MAX = 500;

export default function PublishStep1Name(): React.JSX.Element {
  const insets = useSafeAreaInsets();

  // On mount, make sure the store's `step` matches the route. The
  // layout's useEffect also does this, but a second sync here keeps
  // the screen correct if the user lands on it via a stale link
  // (e.g. notification tap from a previous session).
  const step = usePublishStore((s) => s.step);
  const setStep = usePublishStore((s) => s.setStep);
  if (step !== (1 as PublishStep)) setStep(1);

  const name = usePublishStore((s) => s.name);
  const description = usePublishStore((s) => s.description);
  const setName = usePublishStore((s) => s.setName);
  const setDescription = usePublishStore((s) => s.setDescription);

  // Truncate at the ceiling so the user can't type past the schema.
  // The schema check is the source of truth — these constants just
  // mirror it client-side.
  const onNameChange = useCallback(
    (next: string) => setName(next.slice(0, TITLE_MAX)),
    [setName],
  );
  const onDescriptionChange = useCallback(
    (next: string) => setDescription(next.slice(0, DESCRIPTION_MAX)),
    [setDescription],
  );

  const validation = validateStep1({ name, description });

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
          <Text style={styles.title}>Dale un nombre a tu cargador</Text>
          <Text style={styles.subtitle}>
            Contale a los demás qué hace especial a tu cargador.
          </Text>
        </View>

        <View style={styles.field}>
          <Input
            label="Nombre del cargador"
            value={name}
            onChangeText={onNameChange}
            placeholder="Ej: Cargador rápido del garage"
            autoCapitalize="sentences"
          />
          <Text style={styles.counter}>
            {name.length}/{TITLE_MAX}
          </Text>
        </View>

        <View style={styles.field}>
          <Input
            label="Descripción"
            value={description}
            onChangeText={onDescriptionChange}
            placeholder="Contá detalles útiles: tipo de conector, si hay estacionamiento techado, etc."
            autoCapitalize="sentences"
          />
          <Text style={styles.counter}>
            {description.length}/{DESCRIPTION_MAX}
          </Text>
        </View>

        {!validation.valid && (name.length > 0 || description.length > 0) ? (
          <View style={styles.hint}>
            {validation.errors.map((msg) => (
              <Text key={msg} style={styles.hintText}>
                {msg}
              </Text>
            ))}
          </View>
        ) : null}
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
  counter: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  hint: {
    backgroundColor: colors.dangerSurface,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.xs,
  },
  hintText: { ...typography.caption, color: colors.danger },
});
