/**
 * PublishWizardNav — bottom footer for every step in the Publicar wizard.
 *
 * Renders a 7-segment progress bar (the current step is highlighted
 * in `colors.primary`, future steps are muted) and a sticky action
 * row with "Atrás" (secondary) + "Siguiente" (primary) buttons.
 *
 * **Validation**: the Siguiente CTA stays disabled until the current
 * step's `validateStepN` returns `valid: true`. The validator
 * dispatcher below is the single source of truth for "which step
 * is valid" — PR-C and PR-D add validators 3–7 as those steps land.
 *
 * **Navigation**: both buttons call the store's `nextStep()` /
 * `prevStep()` actions, which mutate `step`. The publish layout
 * (see `app/publish/_layout.tsx`) watches `step` and routes the
 * user to the matching `/publish/N-{name}` screen. The layout
 * also handles the auth gate, so this component stays purely
 * presentational.
 *
 * **"Publicar" label**: at step 7 the Siguiente button reads
 * "Publicar" instead. The actual submit lives behind
 * `usePublishCharger` (PR-D) — PR-B just lays the label down so
 * the visual contract is consistent across PRs.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/atoms/Button';
import { colors, radius, spacing, typography } from '@/theme';

import {
  usePublishStore,
  validateStep1,
  validateStep2,
  type PublishStep,
} from '@/stores/publishStore';

const TOTAL_STEPS = 7;

/**
 * Dispatches to the right `validateStepN` for the current step.
 * Steps 3–7 don't have a PR-B validator yet; we return `valid: false`
 * so the Siguiente stays disabled. PR-C and PR-D add validators as
 * those steps land.
 */
function validateCurrentStep(
  step: PublishStep,
  state: { name: string; description: string; location: { lat: number | null; lng: number | null; address: string } | null },
): boolean {
  switch (step) {
    case 1:
      return validateStep1(state).valid;
    case 2:
      return validateStep2(state).valid;
    default:
      // No validator yet — keep the CTA disabled to prevent advancing
      // into a step that doesn't exist in this PR.
      return false;
  }
}

export function PublishWizardNav(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const step = usePublishStore((s) => s.step);
  const name = usePublishStore((s) => s.name);
  const description = usePublishStore((s) => s.description);
  const location = usePublishStore((s) => s.location);
  const nextStep = usePublishStore((s) => s.nextStep);
  const prevStep = usePublishStore((s) => s.prevStep);

  const canAdvance = validateCurrentStep(step, { name, description, location });
  const isFirstStep = step === 1;
  const isFinalStep = step === 7;
  const ctaLabel = isFinalStep ? 'Publicar' : 'Siguiente';

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + spacing.sm }]}>
      <View style={styles.bar} accessibilityRole="progressbar" accessibilityLabel={`Paso ${step} de ${TOTAL_STEPS}`}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => {
          const segmentIndex = (i + 1) as PublishStep;
          const isActive = segmentIndex === step;
          const isComplete = segmentIndex < step;
          return (
            <View
              key={segmentIndex}
              style={[
                styles.segment,
                {
                  backgroundColor: isActive || isComplete ? colors.primary : colors.border,
                },
              ]}
            />
          );
        })}
      </View>
      <Text style={styles.stepLabel}>Paso {step} de {TOTAL_STEPS}</Text>
      <View style={styles.row}>
        {isFirstStep ? (
          <View style={styles.spacer} />
        ) : (
          <Button label="Atrás" variant="secondary" onPress={prevStep} style={styles.flex} />
        )}
        <Button
          label={ctaLabel}
          variant="primary"
          onPress={nextStep}
          disabled={!canAdvance}
          style={styles.flex}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  bar: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: radius.chip,
  },
  stepLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flex: { flex: 1 },
  spacer: { flex: 1 },
});
