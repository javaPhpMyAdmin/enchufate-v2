import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, shadows, spacing } from '@/theme';

export type CardVariant = 'default' | 'elevated' | 'outlined';
export type CardPadding = 'none' | 'sm' | 'md' | 'base' | 'lg';

export interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  padding?: CardPadding;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/** Surface container with optional press. Variants: default/elevated/outlined. */
export function Card({
  children,
  variant = 'default',
  padding = 'base',
  onPress,
  style,
  accessibilityLabel,
}: CardProps): React.JSX.Element {
  const v = VARIANTS[variant];
  const inner = (
    <View
      style={[
        styles.base,
        { backgroundColor: v.bg, borderColor: v.border, borderWidth: v.borderWidth, padding: PAD[padding] },
        v.shadow,
        style,
      ]}
    >
      {children}
    </View>
  );
  if (!onPress) return inner;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({ opacity: pressed ? 0.95 : 1 })}
    >
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({ base: { borderRadius: radius.card } });

const VARIANTS: Record<CardVariant, { bg: string; border: string; borderWidth: number; shadow: StyleProp<ViewStyle> }> = {
  default: { bg: colors.surface, border: 'transparent', borderWidth: 0, shadow: shadows.card },
  elevated: { bg: colors.surface, border: 'transparent', borderWidth: 0, shadow: shadows.card },
  outlined: { bg: colors.surface, border: colors.border, borderWidth: 1, shadow: undefined },
};

const PAD: Record<CardPadding, number> = {
  none: 0,
  sm: spacing.sm,
  md: spacing.md,
  base: spacing.base,
  lg: spacing.lg,
};
