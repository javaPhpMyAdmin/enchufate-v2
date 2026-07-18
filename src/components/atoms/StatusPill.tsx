import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

export type StatusPillKind =
  | 'solicitada'
  | 'confirmada'
  | 'cancelada'
  | 'completada'
  | 'disponible';

export interface StatusPillProps {
  status: StatusPillKind;
  label?: string;
}

const MAP: Record<StatusPillKind, { label: string; bg: string; fg: string; dot: string }> = {
  solicitada: { label: 'Solicitada', bg: colors.background, fg: colors.textPrimary, dot: colors.textSecondary },
  confirmada: { label: 'Confirmada', bg: colors.successSurface, fg: colors.success, dot: colors.success },
  cancelada: { label: 'Cancelada', bg: colors.dangerSurface, fg: colors.danger, dot: colors.danger },
  completada: { label: 'Completada', bg: colors.successSurface, fg: colors.success, dot: colors.success },
  disponible: { label: 'Disponible', bg: colors.successSurface, fg: colors.success, dot: colors.success },
};

/** Colored badge for reservation + charger status. */
export function StatusPill({ status, label }: StatusPillProps): React.JSX.Element {
  const c = MAP[status];
  return (
    <View style={[styles.base, { backgroundColor: c.bg }]} accessibilityRole="text" accessibilityLabel={label ?? c.label}>
      <View style={[styles.dot, { backgroundColor: c.dot }]} />
      <Text style={[styles.label, { color: c.fg }]}>{label ?? c.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  dot: { width: 8, height: 8, borderRadius: radius.pill, marginRight: spacing.xs },
  label: { ...typography.caption, fontWeight: '600' },
});
