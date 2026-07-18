import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';

import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { colors, spacing, typography } from '@/theme';

export interface ErrorStateProps {
  title?: string;
  body?: string;
  onRetry?: () => void;
  retryLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_TITLE = 'Algo salió mal';
const DEFAULT_BODY = 'No pudimos cargar la información. Probá de nuevo en un momento.';
const DEFAULT_RETRY = 'Reintentar';

/**
 * ErrorState — failure placeholder with retry CTA.
 *
 * Used on every list-bearing screen when the underlying query
 * rejected. The `onRetry` callback is wired to TanStack Query's
 * `refetch` (per feature hook). Renders only the title + body
 * if `onRetry` is not provided.
 */
export function ErrorState({
  title = DEFAULT_TITLE,
  body = DEFAULT_BODY,
  onRetry,
  retryLabel = DEFAULT_RETRY,
  style,
}: ErrorStateProps): React.JSX.Element {
  return (
    <View style={[styles.base, style]}>
      <View style={styles.iconWrap}>
        <Icon icon={AlertTriangle} size="xl" color={colors.danger} />
      </View>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.body}>{body}</Text>
      {onRetry ? (
        <View style={styles.cta}>
          <Button label={retryLabel} onPress={onRetry} variant="primary" />
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
    backgroundColor: colors.dangerSurface,
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
});
