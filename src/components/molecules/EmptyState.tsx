import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { colors, spacing, typography } from '@/theme';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  body?: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
  /** Optional "¿No tenés cuenta?" row below the CTA. */
  signupLabel?: string;
  onSignupPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * EmptyState — illustrated zero-data placeholder.
 *
 * Used on every list-bearing screen when the underlying query
 * returned an empty array (no reservations, no conversations, no
 * chargers) AND on auth-gated tabs when the user is logged out.
 *
 * The CTA is optional; when both `ctaLabel` and `onCtaPress` are
 * provided, a primary `Button` renders below the body copy.
 */
export function EmptyState({
  icon: IconCmp,
  title,
  body,
  ctaLabel,
  onCtaPress,
  signupLabel,
  onSignupPress,
  style,
}: EmptyStateProps): React.JSX.Element {
  return (
    <View style={[styles.base, style]}>
      {IconCmp ? (
        <View style={styles.iconWrap}>
          <Icon icon={IconCmp} size="xl" color={colors.primary} />
        </View>
      ) : null}
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {ctaLabel && onCtaPress ? (
        <View style={styles.cta}>
          <Button label={ctaLabel} onPress={onCtaPress} variant="primary" fullWidth />
        </View>
      ) : null}
      {signupLabel && onSignupPress ? (
        <View style={styles.signupRow}>
          <Text style={styles.signupPrompt}>{signupLabel}</Text>
          <Text
            style={styles.signupLink}
            accessibilityRole="link"
            onPress={onSignupPress}
          >
            Creá tu cuenta
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.base,
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 280,
  },
  cta: {
    marginTop: spacing.xl,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.base,
  },
  signupPrompt: { ...typography.caption, color: colors.textSecondary },
  signupLink: { ...typography.caption, color: colors.primary, fontWeight: '600' },
});
