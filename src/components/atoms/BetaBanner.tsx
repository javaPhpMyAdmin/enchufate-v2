import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';

import { colors, radius, spacing, typography } from '@/theme';

import { Icon } from './Icon';

export interface BetaBannerProps {
  message?: string;
}

/** Light-blue pinned banner above the Publicar wizard. */
export function BetaBanner({
  message = 'Publicar es gratis durante la beta. La suscripción de USD 10/mes llega pronto.',
}: BetaBannerProps): React.JSX.Element {
  return (
    <View style={styles.base} accessibilityRole="text" accessibilityLabel={message}>
      <Icon icon={Sparkles} size="md" color={colors.infoText} />
      <Text style={styles.label}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.infoBg,
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  label: { ...typography.caption, color: colors.infoText, flex: 1 },
});
