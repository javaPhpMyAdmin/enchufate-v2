/**
 * FiltersModal — filter panel rendered as a native RN Modal.
 *
 * Replaced BottomSheetModal because it conflicts with Mapbox
 * gesture handling on Android. A plain Modal avoids all gesture
 * conflicts and is simpler to maintain.
 *
 * State model:
 *   - The user edits selections in the store's `draft` (an isolated
 *     copy of `filters`). Tapping a chip calls `setDraft(category,
 *     value)`.
 *   - The Reset button clears both `draft` and `filters`.
 *   - The Aplicar button commits `draft` into `filters` (the value
 *     the map query reads) and closes the modal.
 */
import React, { useCallback, useEffect } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/atoms/Button';
import { FilterChipRow, type FilterChipRowOption } from '@/components/molecules/FilterChipRow';
import { useFilterStore, type FilterCategory, type FilterValue } from '@/stores/filterStore';
import { isFeatureEnabled } from '@/lib/features';
import { colors, spacing, typography } from '@/theme';

export interface FiltersSheetProps {
  visible: boolean;
  onClose: () => void;
}

const ESTADO_OPTIONS: ReadonlyArray<FilterChipRowOption> = [
  { label: 'Activos', value: '__none__' },
  { label: 'Disponible', value: 'disponible' },
  { label: 'Pausado', value: 'pausado' },
];

const CONECTOR_OPTIONS: ReadonlyArray<FilterChipRowOption> = [
  { label: 'Todos', value: '__none__' },
  { label: 'Tipo 2', value: 'tipo_2' },
  { label: 'CCS', value: 'ccs' },
  { label: 'CHAdeMO', value: 'chademo' },
  { label: 'Tipo 1', value: 'tipo_1' },
  { label: 'Tesla', value: 'tesla' },
];

const POTENCIA_OPTIONS: ReadonlyArray<FilterChipRowOption> = [
  { label: 'Todos', value: '__none__' },
  { label: 'Lenta (<7 kW)', value: 'lenta' },
  { label: 'Semi-rápida (7-22 kW)', value: 'semi_rapida' },
  { label: 'Rápida (22-50 kW)', value: 'rapida' },
  { label: 'Ultra (>50 kW)', value: 'ultra' },
];

const DISTANCIA_OPTIONS: ReadonlyArray<FilterChipRowOption> = [
  { label: 'Todos', value: '__none__' },
  { label: 'Cerca (<2 km)', value: 'cerca' },
  { label: 'Medio (2-10 km)', value: 'medio' },
  { label: 'Lejos (>10 km)', value: 'lejos' },
];

const FUENTE_OPTIONS: ReadonlyArray<FilterChipRowOption> = [
  { label: 'Todos', value: '__none__' },
  { label: 'Enchúfate', value: 'enchufate' },
  { label: 'UTE', value: 'ute' },
];

const NONE_SENTINEL = '__none__';

const BASE_SECTIONS: ReadonlyArray<{
  category: FilterCategory;
  label: string;
  options: ReadonlyArray<FilterChipRowOption>;
}> = [
  { category: 'estado', label: 'Estado', options: ESTADO_OPTIONS },
  { category: 'conector', label: 'Conector', options: CONECTOR_OPTIONS },
  { category: 'potencia', label: 'Potencia', options: POTENCIA_OPTIONS },
  { category: 'distancia', label: 'Distancia (en línea recta)', options: DISTANCIA_OPTIONS },
];

const FUENTE_SECTION = {
  category: 'fuente' as FilterCategory,
  label: 'Fuente',
  options: FUENTE_OPTIONS,
};

function valueToChip(
  current: string | number | null,
  options: ReadonlyArray<FilterChipRowOption>,
): string {
  if (current === null) return NONE_SENTINEL;
  return options.some((o) => o.value === current) ? String(current) : NONE_SENTINEL;
}

function chipToValue(
  chipValue: string,
  _category: FilterCategory,
): FilterValue | null {
  if (chipValue === NONE_SENTINEL) return null;
  return chipValue as FilterValue;
}

export function FiltersSheet({ visible, onClose }: FiltersSheetProps): React.JSX.Element {
  const filters = useFilterStore((s) => s.filters);
  const draft = useFilterStore((s) => s.draft);
  const setDraft = useFilterStore((s) => s.setDraft);
  const applyDraft = useFilterStore((s) => s.applyDraft);
  const resetFilters = useFilterStore((s) => s.resetFilters);

  // Seed the draft with current applied filters every time the modal opens.
  useEffect(() => {
    if (visible) {
      useFilterStore.setState({ draft: { ...filters } });
    }
  }, [visible, filters]);

  const handleApply = useCallback(() => {
    applyDraft();
    onClose();
  }, [applyDraft, onClose]);

  const handleReset = useCallback(() => {
    resetFilters();
  }, [resetFilters]);

  const currentDraft = draft;

  // Conditionally include Fuente section when PUBLIC_CHARGERS is enabled.
  const sections = isFeatureEnabled('PUBLIC_CHARGERS')
    ? [FUENTE_SECTION, ...BASE_SECTIONS]
    : [...BASE_SECTIONS];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop — tap to close */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* Sheet panel */}
      <View style={styles.sheet}>
        {/* Drag indicator */}
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Filtros</Text>

          {sections.map((section) => (
            <FilterChipRow
              key={section.category}
              label={section.label}
              options={section.options}
              value={valueToChip(currentDraft[section.category], section.options)}
              onChange={(v) =>
                setDraft(section.category, chipToValue(v, section.category))
              }
            />
          ))}

          <View style={styles.actions}>
            <Pressable
              onPress={handleReset}
              accessibilityRole="button"
              accessibilityLabel="Restablecer filtros"
              hitSlop={8}
              style={({ pressed }) => [styles.reset, pressed && styles.actionPressed]}
            >
              <Text style={styles.resetLabel}>Reset</Text>
            </Pressable>
            <Button label="Aplicar" onPress={handleApply} variant="primary" size="md" />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.border,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reset: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  actionPressed: { opacity: 0.7 },
  resetLabel: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
