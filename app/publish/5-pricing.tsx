/**
 * Publish wizard — step 5: pricing.
 *
 * Two inputs:
 *   1. **Price per hour (USD)** — numeric `Input` with a `USD` left
 *      adornment and a `/ hora` right adornment (so the unit is
 *      visible inline, not just in the helper text). The
 *      `chargerSchema.price_per_hour_usd` constraint is `> 0`; the
 *      Siguiente CTA stays disabled until the value is a positive
 *      number (enforced in `validateStep5`).
 *   2. **Min reservation duration** — single-select `Chip` group
 *      with 5 options (30 min, 1 h, 2 h, 4 h, 8 h). The 30 min
 *      option is pre-selected (matches `publishStore` initial
 *      state); tapping another chip re-selects it.
 *
 * The Siguiente CTA lives in `<PublishWizardNav />` (rendered by
 * the layout). When pressed, the nav mutates `step` to 6; the
 * layout's useEffect navigates to `/publish/6-schedule`.
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

import { Chip } from '@/components/atoms/Chip';
import { Input } from '@/components/atoms/Input';
import {
  usePublishStore,
  validateStep5,
  type PublishStep,
} from '@/stores/publishStore';
import { colors, radius, spacing, typography } from '@/theme';

interface DurationOption {
  /** Internal enum value (mirrors `chargerSchema.shape.min_reservation_minutes`). */
  value: 30 | 60 | 120 | 240 | 480;
  /** User-facing label (Rioplatense, matches the V1 chip wording). */
  label: string;
}

/** The 5 reservation-duration options — order is the visual order on the screen. */
const DURATIONS: readonly DurationOption[] = [
  { value: 30, label: '30 min' },
  { value: 60, label: '1 h' },
  { value: 120, label: '2 h' },
  { value: 240, label: '4 h' },
  { value: 480, label: '8 h' },
] as const;

/** Parse the raw input string into a number (or null when the field is empty / invalid). */
function parsePriceInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  // Allow a single optional decimal point; reject multiple dots.
  if ((trimmed.match(/\./g) ?? []).length > 1) return Number.NaN;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : Number.NaN;
}

/** Format a number for the `Input` value (empty string when null). */
function formatPriceInput(n: number | null): string {
  if (n === null || Number.isNaN(n)) return '';
  return String(n);
}

export default function PublishStep5Pricing(): React.JSX.Element {
  const insets = useSafeAreaInsets();

  // On mount, make sure the store's `step` matches the route. The
  // layout's useEffect also does this; the screen-level sync keeps
  // things correct if the user lands here via a stale deep link.
  const step = usePublishStore((s) => s.step);
  const setStep = usePublishStore((s) => s.setStep);
  if (step !== (5 as PublishStep)) setStep(5);

  const pricing = usePublishStore((s) => s.pricing);
  const setPricePerHour = usePublishStore((s) => s.setPricePerHour);
  const setMinReservation = usePublishStore((s) => s.setMinReservation);

  const onChangePrice = useCallback(
    (raw: string) => {
      // Truncate to 8 chars to bound the input (e.g. "1234.567"
      // fits, "12345.678" doesn't). Validation still runs in
      // `validateStep5` so the Siguiente stays disabled for
      // out-of-range values.
      const truncated = raw.slice(0, 8);
      setPricePerHour(parsePriceInput(truncated));
    },
    [setPricePerHour],
  );

  const validation = validateStep5({ pricing });
  const priceTouched = pricing.price_per_hour_usd !== null;

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
          <Text style={styles.title}>¿Cuánto cuesta cargar una hora en tu cargador?</Text>
          <Text style={styles.subtitle}>
            Definí el precio por hora en dólares. Los huéspedes lo ven antes de reservar.
          </Text>
        </View>

        <View style={styles.field}>
          <Input
            label="Precio por hora (USD)"
            value={formatPriceInput(pricing.price_per_hour_usd)}
            onChangeText={onChangePrice}
            placeholder="0.50"
            keyboardType="decimal-pad"
            leftAdornment={<Text style={styles.leftAdornment}>USD</Text>}
            rightAdornment={<Text style={styles.adornment}>/ hora</Text>}
          />
          <Text style={styles.helper}>
            Sumá lo que te cuesta la electricidad y un margen razonable.
          </Text>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Elegí la duración mínima</Text>
          <Text style={styles.subtitle}>
            Los huéspedes van a poder reservar por al menos este tiempo.
          </Text>
        </View>

        <View style={styles.chipGroup}>
          {DURATIONS.map((d) => {
            const selected = pricing.min_reservation_minutes === d.value;
            return (
              <Chip
                key={d.value}
                label={d.label}
                selected={selected}
                onPress={() => setMinReservation(d.value)}
                style={styles.chip}
              />
            );
          })}
        </View>

        {!validation.valid && priceTouched ? (
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
  helper: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  leftAdornment: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  adornment: {
    ...typography.body,
    color: colors.textSecondary,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    // Min-width so the 5 options don't collapse to different widths.
    minWidth: 84,
    borderRadius: radius.chip,
  },
  hint: {
    backgroundColor: colors.dangerSurface,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.xs,
  },
  hintText: { ...typography.caption, color: colors.danger },
});
