import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Eye, EyeOff } from 'lucide-react-native';

import { colors, radius, spacing, typography } from '@/theme';

import { Icon } from './Icon';

export type InputVariant = 'default' | 'error' | 'success';

export interface InputProps {
  label?: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  variant?: InputVariant;
  errorMessage?: string;
  leftAdornment?: React.ReactNode;
  rightAdornment?: React.ReactNode;
  secureTextEntry?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Text-entry atom. Variants: default/error/success. Optional show/hide for password. */
export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  variant = 'default',
  errorMessage,
  leftAdornment,
  rightAdornment,
  secureTextEntry = false,
  disabled = false,
  style,
}: InputProps): React.JSX.Element {
  const [hidden, setHidden] = useState(secureTextEntry);
  const [focused, setFocused] = useState(false);

  const borderColor =
    variant === 'error'
      ? colors.danger
      : variant === 'success'
        ? colors.success
        : focused
          ? colors.primary
          : colors.border;

  return (
    <View style={[styles.wrap, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.field,
          { borderColor, backgroundColor: disabled ? colors.background : colors.surface },
        ]}
      >
        {leftAdornment ? <View style={styles.adornment}>{leftAdornment}</View> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          editable={!disabled}
          secureTextEntry={hidden}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, typography.body, { color: colors.textPrimary }]}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Mostrar contraseña' : 'Ocultar contraseña'}
            style={styles.adornment}
          >
            <Icon icon={hidden ? Eye : EyeOff} size="sm" color={colors.textSecondary} />
          </Pressable>
        ) : rightAdornment ? (
          <View style={styles.adornment}>{rightAdornment}</View>
        ) : null}
      </View>
      {variant === 'error' && errorMessage ? (
        <Text style={[styles.helper, styles.helperError]}>{errorMessage}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  label: { ...typography.caption, color: colors.textPrimary, marginBottom: spacing.xs, fontWeight: '600' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
  adornment: { paddingHorizontal: spacing.xs, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, paddingVertical: 0 },
  helper: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  helperError: { color: colors.danger },
});
