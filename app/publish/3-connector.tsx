/**
 * Publish wizard — step 3: connector + power.
 *
 * Two inputs:
 *   1. **Connector** — single-select `Chip` group with the 5 charger
 *      connector kinds (`Tipo 1`, `Tipo 2`, `CCS`, `CHAdeMO`, `Tesla`).
 *      Tapping a chip selects it; the previously-selected one is
 *      deselected automatically. The mapping between the display
 *      label and the `chargerSchema.connector_type` enum value
 *      lives in the `CONNECTORS` array below — keep both lists in
 *      lockstep.
 *   2. **Power** — numeric `Input` with `keyboardType="decimal-pad"`.
 *      The Input atom doesn't expose `maxLength`, so we accept any
 *      input and let `validateStep3` (in the publish store) gate
 *      the Siguiente CTA. The helper text shows the valid range.
 *
 * The Siguiente CTA lives in `<PublishWizardNav />` (rendered by the
 * layout). When pressed, the nav mutates `step` to 4; the layout's
 * useEffect navigates to `/publish/4-photos`, which is the next
 * step in PR-C commit 2.
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
  validateStep3,
  type PublishConnectorType,
  type PublishStep,
} from '@/stores/publishStore';
import { colors, radius, spacing, typography } from '@/theme';

interface ConnectorOption {
  /** Internal enum value (mirrors `chargerSchema.shape.connector_type`). */
  value: PublishConnectorType;
  /** User-facing label (Rioplatense, mirrors the connector badge on the charger detail). */
  label: string;
}

/** The 5 charger connector kinds — order is the visual order on the screen. */
const CONNECTORS: readonly ConnectorOption[] = [
  { value: 'tipo_1', label: 'Tipo 1' },
  { value: 'tipo_2', label: 'Tipo 2' },
  { value: 'ccs', label: 'CCS' },
  { value: 'chademo', label: 'CHAdeMO' },
  { value: 'tesla', label: 'Tesla' },
] as const;

/** Per spec — must stay in sync with `chargerSchema.shape.power_kw`. */
const POWER_MIN = 3.7;
const POWER_MAX = 350;

/** Parse the raw input string into a number (or null when the field is empty / invalid). */
function parsePowerInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  // Allow a single optional decimal point; reject multiple dots.
  if ((trimmed.match(/\./g) ?? []).length > 1) return Number.NaN;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : Number.NaN;
}

/** Format a number for the `Input` value (empty string when null). */
function formatPowerInput(n: number | null): string {
  if (n === null || Number.isNaN(n)) return '';
  return String(n);
}

export default function PublishStep3Connector(): React.JSX.Element {
  const insets = useSafeAreaInsets();

  // On mount, make sure the store's `step` matches the route. The
  // layout's useEffect also does this; the screen-level sync keeps
  // things correct if the user lands here via a stale deep link.
  const step = usePublishStore((s) => s.step);
  const setStep = usePublishStore((s) => s.setStep);
  if (step !== (3 as PublishStep)) setStep(3);

  const connector_type = usePublishStore((s) => s.connector_type);
  const power_kw = usePublishStore((s) => s.power_kw);
  const setConnectorType = usePublishStore((s) => s.setConnectorType);
  const setPowerKw = usePublishStore((s) => s.setPowerKw);

  const onPickConnector = useCallback(
    (value: PublishConnectorType) => {
      setConnectorType(value);
    },
    [setConnectorType],
  );

  const onChangePower = useCallback(
    (raw: string) => {
      // Truncate the visible string at 6 chars to bound the input
      // (e.g. "350.00" fits, "1234.56" doesn't). Validation still
      // runs in `validateStep3` so the Siguiente stays disabled
      // for out-of-range values.
      const truncated = raw.slice(0, 6);
      setPowerKw(parsePowerInput(truncated));
    },
    [setPowerKw],
  );

  const validation = validateStep3({ connector_type, power_kw: power_kw ?? null });
  const powerTouched = power_kw !== null;

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
          <Text style={styles.title}>Elegí el tipo de conector</Text>
          <Text style={styles.subtitle}>
            Decinos qué conector tiene tu cargador.
          </Text>
        </View>

        <View style={styles.chipGroup}>
          {CONNECTORS.map((c) => {
            const selected = connector_type === c.value;
            return (
              <Chip
                key={c.value}
                label={c.label}
                selected={selected}
                onPress={() => onPickConnector(c.value)}
                style={styles.chip}
              />
            );
          })}
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>¿Cuánta potencia entrega tu cargador?</Text>
          <Text style={styles.subtitle}>
            Es la potencia máxima que soporta. La vamos a mostrar en la publicación.
          </Text>
        </View>

        <View style={styles.field}>
          <Input
            label="Potencia (kW)"
            value={formatPowerInput(power_kw)}
            onChangeText={onChangePower}
            placeholder="22"
            keyboardType="decimal-pad"
            rightAdornment={<Text style={styles.adornment}>kW</Text>}
          />
          <Text style={styles.helper}>
            Entre {POWER_MIN} y {POWER_MAX} kW
          </Text>
        </View>

        {!validation.valid && (connector_type !== null || powerTouched) ? (
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
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    // The Chip atom has its own border + radius; we just enforce a
    // min-width so the 5 options don't collapse to different widths.
    minWidth: 96,
    borderRadius: radius.chip,
  },
  field: { gap: spacing.xs },
  helper: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  adornment: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  hint: {
    backgroundColor: colors.dangerSurface,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.xs,
  },
  hintText: { ...typography.caption, color: colors.danger },
});
