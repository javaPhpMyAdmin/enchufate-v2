import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

export type ChipSize = 'sm' | 'md';

export interface ChipProps {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  size?: ChipSize;
  style?: ViewStyle;
}

/** Pill-shaped toggle used in Filtros + the publish wizard. */
export function Chip({
  label,
  selected = false,
  disabled = false,
  onPress,
  size = 'md',
  style,
}: ChipProps): React.JSX.Element {
  const s = SIZES[size];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [
        styles.base,
        {
          paddingVertical: s.pv,
          paddingHorizontal: s.ph,
          borderRadius: radius.chip,
          backgroundColor: selected ? colors.primary : colors.background,
          borderColor: selected ? colors.primary : colors.border,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Text style={[s.text, { color: selected ? colors.textOnPrimary : colors.textPrimary }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const SIZES = {
  sm: { pv: spacing.xs, ph: spacing.md, text: typography.caption },
  md: { pv: spacing.sm, ph: spacing.base, text: typography.caption },
} as const;

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
