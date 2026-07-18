import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, spacing, typography } from '@/theme';

export interface LoadingStateProps {
  label?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * LoadingState — orange-tinted spinner with optional caption.
 *
 * Renders an indeterminate ActivityIndicator tinted with the brand
 * orange. The caption is intended for tab-level loading where
 * "Cargando..." adds context (charger list, reservation list, chat
 * thread). Defaults to a centered full-bleed layout so callers
 * can drop it in as the body of a screen.
 */
export function LoadingState({
  label = 'Cargando...',
  style,
}: LoadingStateProps): React.JSX.Element {
  return (
    <View style={[styles.base, style]}>
      <ActivityIndicator size="large" color={colors.primary} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  label: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.base,
  },
});
