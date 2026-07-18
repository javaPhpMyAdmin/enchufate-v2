import React from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Crosshair } from 'lucide-react-native';

import { colors, radius, shadows, spacing } from '@/theme';

import { Icon } from './Icon';

export interface FABProps {
  onPress: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

/** Circular floating action button. Anchored bottom-right (Mapa recenter). */
export function FAB({
  onPress,
  accessibilityLabel = 'Acción flotante',
  style,
  disabled = false,
}: FABProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [styles.base, shadows.card, { opacity: disabled ? 0.5 : pressed ? 0.9 : 1 }, style]}
    >
      <Icon icon={Crosshair} size="lg" color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
