import React from 'react';
import { ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Chip } from '@/components/atoms/Chip';
import { colors, spacing, typography } from '@/theme';

export interface FilterChipRowOption {
  label: string;
  value: string;
}

export interface FilterChipRowProps {
  label: string;
  options: ReadonlyArray<FilterChipRowOption>;
  value?: string;
  onChange?: (value: string) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * FilterChipRow — a horizontal scroll of mutually-exclusive chips.
 *
 * Used in the Filtros bottom sheet (5 sections: Estado, Conector,
 * Potencia, Precio, Distancia). When a chip is tapped, the parent
 * receives the new value via `onChange`. The `label` renders above
 * the row as a section title.
 */
export function FilterChipRow({
  label,
  options,
  value,
  onChange,
  style,
}: FilterChipRowProps): React.JSX.Element {
  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {options.map((opt) => (
          <Chip
            key={opt.value}
            label={opt.label}
            selected={opt.value === value}
            onPress={() => onChange?.(opt.value)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  label: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },
  row: { gap: spacing.sm, paddingRight: spacing.base },
});
