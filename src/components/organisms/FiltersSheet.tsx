/**
 * FiltersSheet — bottom sheet with 5 chip-group sections.
 *
 * Wraps `@gorhom/bottom-sheet`'s `BottomSheetModal` with the
 * Filtros content. Each section is a `FilterChipRow` (mutually
 * exclusive options) bound to one category of the `useFilterStore`.
 *
 * State model:
 *   - The user edits selections in the store's `draft` (an isolated
 *     copy of `filters`). Tapping a chip calls `setDraft(category,
 *     value)`.
 *   - The Reset button clears both `draft` and `filters`.
 *   - The Aplicar button commits `draft` into `filters` (the value
 *     the map query reads) and closes the sheet.
 *
 * Why draft + apply: the spec wants the map to update ONLY when the
 * user explicitly confirms (Aplicar). Tapping a chip inside the
 * sheet should not refilter the map mid-edit.
 */
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

import { Button } from '@/components/atoms/Button';
import { FilterChipRow, type FilterChipRowOption } from '@/components/molecules/FilterChipRow';
import { useFilterStore, type FilterCategory, type FilterValue } from '@/stores/filterStore';
import { colors, spacing, typography } from '@/theme';

export interface FiltersSheetProps {
  visible: boolean;
  onClose: () => void;
}

const SNAP_POINTS = ['25%', '50%', '90%'];

const ESTADO_OPTIONS: ReadonlyArray<FilterChipRowOption> = [
  { label: 'Todos', value: '__none__' },
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

const PRECIO_OPTIONS: ReadonlyArray<FilterChipRowOption> = [
  { label: 'Todos', value: '__none__' },
  { label: 'Económico', value: 'economico' },
  { label: 'Estándar', value: 'estandar' },
  { label: 'Premium', value: 'premium' },
];

const DISTANCIA_OPTIONS: ReadonlyArray<FilterChipRowOption> = [
  { label: 'Todos', value: '__none__' },
  { label: 'Cerca (<2 km)', value: 'cerca' },
  { label: 'Medio (2-10 km)', value: 'medio' },
  { label: 'Lejos (>10 km)', value: 'lejos' },
];

const NONE_SENTINEL = '__none__';

const SECTIONS: ReadonlyArray<{
  category: FilterCategory;
  label: string;
  options: ReadonlyArray<FilterChipRowOption>;
}> = [
  { category: 'estado', label: 'Estado', options: ESTADO_OPTIONS },
  { category: 'conector', label: 'Conector', options: CONECTOR_OPTIONS },
  { category: 'potencia', label: 'Potencia', options: POTENCIA_OPTIONS },
  { category: 'precio', label: 'Precio', options: PRECIO_OPTIONS },
  { category: 'distancia', label: 'Distancia', options: DISTANCIA_OPTIONS },
];

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
  const sheetRef = useRef<BottomSheetModal>(null);
  const filters = useFilterStore((s) => s.filters);
  const draft = useFilterStore((s) => s.draft);
  const setDraft = useFilterStore((s) => s.setDraft);
  const applyDraft = useFilterStore((s) => s.applyDraft);
  const resetFilters = useFilterStore((s) => s.resetFilters);

  // Sync the store's `draft` with the applied `filters` every time
  // the sheet opens — otherwise a stale draft from a previous open
  // would override the current applied state.
  useEffect(() => {
    if (visible) {
      // The store has no "setDraft to filters" action; the cleanest
      // way to seed the draft is to call applyDraft (commit current
      // draft into filters) IF draft is already a copy of filters.
      // When the user opens the sheet fresh, draft should equal
      // filters (the store initializes both as EMPTY). We
      // re-initialize by reading filters explicitly here:
      useFilterStore.setState({ draft: { ...filters } });
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible, filters]);

  const handleApply = useCallback(() => {
    applyDraft();
    onClose();
  }, [applyDraft, onClose]);

  const handleReset = useCallback(() => {
    resetFilters();
  }, [resetFilters]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
    ),
    [],
  );

  const currentDraft = draft;

  return (
    <BottomSheetModal
      ref={sheetRef}
      index={1}
      snapPoints={useMemo(() => SNAP_POINTS, [])}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      onDismiss={onClose}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.background}
    >
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Filtros</Text>

        {SECTIONS.map((section) => (
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
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  background: { backgroundColor: colors.surface },
  handle: { backgroundColor: colors.border, width: 40 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  title: { ...typography.title, color: colors.textPrimary, marginBottom: spacing.sm },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reset: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  actionPressed: { opacity: 0.7 },
  resetLabel: { ...typography.body, color: colors.textPrimary, fontWeight: '600' },
});
