/**
 * Publish wizard — step 6: per-day availability schedule.
 *
 * 7 day-of-week rows (Lunes → Domingo). Each row has 3 modes:
 *   - **Disponible 24 horas** (default) — single `00:00–23:59` window.
 *   - **Personalizar** — user adds one or more `HH:MM–HH:MM` ranges.
 *   - **No disponible** — empty array, the charger is closed that day.
 *
 * The persisted shape mirrors the `chargers.schedule` jsonb column
 * exactly (`{ mon: [{from, to}], tue: [...], ... }`) so the real
 * Phase 7 mutation is a pass-through with no shape conversion.
 *
 * The Siguiente CTA lives in `<PublishWizardNav />` (rendered by
 * the layout). `validateStep6` keeps it disabled until at least
 * one day is open (otherwise the charger would be unbookable).
 */
import { useCallback, useState } from 'react';
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
  ALWAYS_AVAILABLE_WINDOW,
  PUBLISH_DAY_KEYS,
  PUBLISH_DAY_LABELS,
  usePublishStore,
  validateStep6,
} from '@/stores/publishStore';
import { colors, radius, spacing, typography } from '@/theme';
import type { DayKey, DayWindow } from '@/features/chargers/types';

type DayMode = 'always' | 'custom' | 'closed';

/** Map a `DayWindow[]` to the UI mode for the day row. */
function modeForDay(windows: DayWindow[] | undefined): DayMode {
  if (!windows || windows.length === 0) return 'closed';
  if (windows.length === 1 && windows[0]?.from === '00:00' && windows[0]?.to === '23:59') {
    return 'always';
  }
  return 'custom';
}

/** Build the `DayWindow[]` for a given mode + (optional) custom range. */
function windowsForMode(
  mode: DayMode,
  custom: { from: string; to: string } | null,
): DayWindow[] {
  if (mode === 'always') return [ALWAYS_AVAILABLE_WINDOW];
  if (mode === 'closed') return [];
  // 'custom'
  if (custom) return [custom];
  return [];
}

export default function PublishStep6Schedule(): React.JSX.Element {
  const insets = useSafeAreaInsets();

  const schedule = usePublishStore((s) => s.schedule);
  const setDaySchedule = usePublishStore((s) => s.setDaySchedule);

  // Local state for the "Personalizar" range — a single HH:MM–HH:MM
  // window per day. The brief allows multiple ranges but the MVP
  // single-range is enough; the underlying store shape is already
  // `DayWindow[]` so a future "add another range" affordance is a
  // pure UI extension.
  const [customRange, setCustomRange] = useState<Record<DayKey, { from: string; to: string } | null>>(
    () => {
      const init = {} as Record<DayKey, { from: string; to: string } | null>;
      for (const k of PUBLISH_DAY_KEYS) {
        const w = schedule[k]?.[0];
        // Seed with the first custom range if the day is already custom.
        if (w && modeForDay(schedule[k]) === 'custom') {
          init[k] = { from: w.from, to: w.to };
        } else {
          init[k] = null;
        }
      }
      return init;
    },
  );

  const onPickMode = useCallback(
    (k: DayKey, mode: DayMode) => {
      // If the user switches into "custom" but has no range yet,
      // default to 09:00–18:00 (a sensible "business hours" fallback).
      let custom = customRange[k];
      if (mode === 'custom' && !custom) {
        custom = { from: '09:00', to: '18:00' };
        setCustomRange((prev) => ({ ...prev, [k]: custom }));
      }
      setDaySchedule(k, windowsForMode(mode, custom));
    },
    [customRange, setDaySchedule],
  );

  const onChangeCustom = useCallback(
    (k: DayKey, field: 'from' | 'to', value: string) => {
      // Truncate to 5 chars ("HH:MM") and only allow digits + colon.
      const cleaned = value.replace(/[^0-9:]/g, '').slice(0, 5);
      const next = { ...(customRange[k] ?? { from: '09:00', to: '18:00' }), [field]: cleaned };
      setCustomRange((prev) => ({ ...prev, [k]: next }));
      // Persist immediately so the jsonb shape stays in sync with
      // the local input (avoids a "save on blur" surprise).
      const mode = modeForDay(schedule[k]);
      if (mode === 'custom') {
        setDaySchedule(k, [next]);
      }
    },
    [customRange, schedule, setDaySchedule],
  );

  const validation = validateStep6({ schedule });

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
          <Text style={styles.title}>¿Cuándo está disponible tu cargador?</Text>
          <Text style={styles.subtitle}>
            Configurá los días y horarios en los que los huéspedes pueden reservar.
          </Text>
        </View>

        <View style={styles.days}>
          {PUBLISH_DAY_KEYS.map((k) => {
            const mode = modeForDay(schedule[k]);
            const custom = customRange[k];
            return (
              <View key={k} style={styles.dayRow}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayLabel}>{PUBLISH_DAY_LABELS[k]}</Text>
                  {mode === 'always' ? (
                    <Text style={styles.dayStatus}>Disponible 24 horas</Text>
                  ) : mode === 'closed' ? (
                    <Text style={styles.dayStatus}>Cerrado</Text>
                  ) : null}
                </View>

                <View style={styles.modeChips}>
                  <Chip
                    label="Disponible"
                    selected={mode === 'always'}
                    onPress={() => onPickMode(k, 'always')}
                    style={styles.modeChip}
                  />
                  <Chip
                    label="Personalizar"
                    selected={mode === 'custom'}
                    onPress={() => onPickMode(k, 'custom')}
                    style={styles.modeChip}
                  />
                  <Chip
                    label="No disponible"
                    selected={mode === 'closed'}
                    onPress={() => onPickMode(k, 'closed')}
                    style={styles.modeChip}
                  />
                </View>

                {mode === 'custom' && custom ? (
                  <View style={styles.customRow}>
                    <Input
                      label="Desde"
                      value={custom.from}
                      onChangeText={(v) => onChangeCustom(k, 'from', v)}
                      placeholder="HH:MM"
                      keyboardType="numbers-and-punctuation"
                      autoCorrect={false}
                      style={styles.customInput}
                    />
                    <Text style={styles.customDash}>—</Text>
                    <Input
                      label="Hasta"
                      value={custom.to}
                      onChangeText={(v) => onChangeCustom(k, 'to', v)}
                      placeholder="HH:MM"
                      keyboardType="numbers-and-punctuation"
                      autoCorrect={false}
                      style={styles.customInput}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        {!validation.valid ? (
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
  days: {
    gap: spacing.base,
  },
  dayRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.sm,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayLabel: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  dayStatus: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  modeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  modeChip: {
    // Smaller chip variant would need an atom change; we keep the
    // default size and let the chip word-wrap.
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  customInput: {
    flex: 1,
  },
  customDash: {
    ...typography.title,
    color: colors.textSecondary,
    paddingBottom: spacing.md,
  },
  hint: {
    backgroundColor: colors.dangerSurface,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.xs,
  },
  hintText: { ...typography.caption, color: colors.danger },
});
