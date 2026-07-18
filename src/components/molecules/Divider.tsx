import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, spacing, typography } from '@/theme';

export type DividerOrientation = 'horizontal' | 'vertical';

export interface DividerProps {
  orientation?: DividerOrientation;
  /** Inline label (e.g. "o continuá con" on the Login screen). */
  label?: string;
  style?: StyleProp<ViewStyle>;
}

/** Thin separator line. With `label`, renders as a horizontal "X or continue with X" pattern. */
export function Divider({ orientation = 'horizontal', label, style }: DividerProps): React.JSX.Element {
  if (orientation === 'vertical') return <View style={[styles.vertical, style]} />;
  if (label) {
    return (
      <View style={[styles.row, style]}>
        <View style={styles.line} />
        <Text style={styles.label}>{label}</Text>
        <View style={styles.line} />
      </View>
    );
  }
  return <View style={[styles.horizontal, style]} />;
}

const styles = StyleSheet.create({
  horizontal: { height: 1, backgroundColor: colors.border, width: '100%' },
  vertical: { width: 1, backgroundColor: colors.border, alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  label: { ...typography.caption, color: colors.textSecondary, marginHorizontal: spacing.md },
});
