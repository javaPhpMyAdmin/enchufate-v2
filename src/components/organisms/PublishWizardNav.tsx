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
 * is valid" — all 7 validators are in place.
 *
 * **Navigation**: steps 1–6 call `nextStep()` / `prevStep()`,
 * which mutate `step`. The publish layout (see
 * `app/publish/_layout.tsx`) watches `step` and routes the user to
 * the matching `/publish/N-{name}` screen. The layout also
 * handles the auth gate, so this component stays purely
 * presentational.
 *
 * **"Publicar" + mutation on step 7**: at step 7 the primary
 * button reads "Publicar" and on press calls
 * `usePublishCharger().publish()` instead of `nextStep()`. While
 * the mutation is in flight the button shows a loading spinner
 * and stays disabled. On success the mutation navigates to
 * `/publish/success` (handled inside the hook via
 * `router.replace`); on error the typed `AppError` is exposed
 * via `error.userMessage` for the step 7 screen to surface.
 */
import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/atoms/Button';
import { usePublishCharger } from '@/features/chargers/hooks/usePublishCharger';
import type { ChargerSchedule } from '@/features/chargers/types';
import { colors, radius, spacing, typography } from '@/theme';

import {
  usePublishStore,
  validateStep1,
  validateStep2,
  validateStep3,
  validateStep4,
  validateStep5,
  validateStep6,
  validateStep7,
  type PublishStep,
  type PublishConnectorType,
  type PublishLocation,
  type PublishPricing,
} from '@/stores/publishStore';

const TOTAL_STEPS = 7;

/**
 * The state slice consumed by `validateCurrentStep`. Mirrors the
 * relevant fields of `PublishStoreState` so the validators get the
 * exact shapes they expect (without `as never` casts).
 */
interface NavStateSlice {
  name: string;
  description: string;
  location: PublishLocation | null;
  connector_type: PublishConnectorType | null;
  power_kw: number | null;
  photos: string[];
  pricing: PublishPricing;
  schedule: ChargerSchedule;
  rules: string;
}

/**
 * Dispatches to the right `validateStepN` for the current step.
 * All 7 validators are in place; PR-D's commit 1 added 5 and 6,
 * commit 2 will wire the final publish on step 7.
 */
function validateCurrentStep(step: PublishStep, state: NavStateSlice): boolean {
  switch (step) {
    case 1:
      return validateStep1(state).valid;
    case 2:
      return validateStep2(state).valid;
    case 3:
      return validateStep3(state).valid;
    case 4:
      return validateStep4(state).valid;
    case 5:
      return validateStep5(state).valid;
    case 6:
      return validateStep6(state).valid;
    case 7:
      return validateStep7(state).valid;
    default:
      return false;
  }
}

export function PublishWizardNav(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const step = usePublishStore((s) => s.step);
  const name = usePublishStore((s) => s.name);
  const description = usePublishStore((s) => s.description);
  const location = usePublishStore((s) => s.location);
  const connector_type = usePublishStore((s) => s.connector_type);
  const power_kw = usePublishStore((s) => s.power_kw);
  const photos = usePublishStore((s) => s.photos);
  const pricing = usePublishStore((s) => s.pricing);
  const schedule = usePublishStore((s) => s.schedule);
  const rules = usePublishStore((s) => s.rules);
  const nextStep = usePublishStore((s) => s.nextStep);
  const prevStep = usePublishStore((s) => s.prevStep);

  const { publish, isPending } = usePublishCharger();

  const canAdvance = validateCurrentStep(step, {
    name,
    description,
    location,
    connector_type,
    power_kw,
    photos,
    pricing,
    schedule,
    rules,
  });
  const isFirstStep = step === 1;
  const isFinalStep = step === 7;
  const ctaLabel = isFinalStep ? 'Publicar' : 'Siguiente';

  const onPrimaryPress = useCallback(() => {
    if (isFinalStep) {
      // `publish` is fire-and-forget here: the mutation handles
      // navigation to /publish/success on success and surfaces the
      // typed AppError via `error.userMessage` for the screen to
      // render. We intentionally don't await — the user is already
      // staring at a loading spinner on the CTA.
      void publish();
      return;
    }
    nextStep();
  }, [isFinalStep, publish, nextStep]);

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
          onPress={onPrimaryPress}
          disabled={!canAdvance}
          loading={isFinalStep && isPending}
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
