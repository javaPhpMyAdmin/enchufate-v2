import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
}

/** Primary call-to-action atom. Variants: primary/secondary/ghost/danger. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  style,
  labelStyle,
  ...rest
}: ButtonProps): React.JSX.Element {
  const v = VARIANTS[variant];
  const s = SIZES[size];
  const off = disabled || loading;
  return (
    <Pressable
      {...rest}
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
      accessibilityLabel={rest.accessibilityLabel ?? label}
      hitSlop={8}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          borderWidth: v.borderWidth,
          paddingVertical: s.pv,
          paddingHorizontal: s.ph,
          borderRadius: s.radius,
          opacity: off ? 0.55 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          minHeight: 44,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.fg} />
      ) : (
        <View style={styles.row}>
          {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
          <Text style={[s.text, { color: v.fg, fontWeight: '600' }, labelStyle]} numberOfLines={1}>
            {label}
          </Text>
          {rightIcon ? <View style={styles.icon}>{rightIcon}</View> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { alignItems: 'center', justifyContent: 'center' },
});

const VARIANTS: Record<ButtonVariant, { bg: string; border: string; borderWidth: number; fg: string }> = {
  primary: { bg: colors.primary, border: 'transparent', borderWidth: 0, fg: colors.textOnPrimary },
  secondary: { bg: colors.surface, border: colors.primary, borderWidth: 1, fg: colors.primary },
  ghost: { bg: 'transparent', border: 'transparent', borderWidth: 0, fg: colors.primary },
  danger: { bg: colors.danger, border: 'transparent', borderWidth: 0, fg: colors.textOnPrimary },
};

const SIZES: Record<ButtonSize, { pv: number; ph: number; radius: number; text: TextStyle }> = {
  sm: { pv: spacing.xs, ph: spacing.md, radius: radius.button, text: typography.caption },
  md: { pv: spacing.md, ph: spacing.base, radius: radius.button, text: typography.body },
  lg: { pv: spacing.base, ph: spacing.lg, radius: radius.button, text: typography.body },
};
