/**
 * ReviewCard — single review display within a ReviewsSection.
 *
 * Shows: reviewer avatar (or initials fallback), display name,
 * star rating, optional text body, and relative timestamp.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/atoms/Avatar';
import { Card } from '@/components/atoms/Card';
import { formatRelativeTime } from '@/lib/format';
import { colors, spacing, typography } from '@/theme';

import type { ReviewWithReviewer } from '../types';

import { StarPicker } from './StarPicker';

export interface ReviewCardProps {
  review: ReviewWithReviewer;
}

export function ReviewCard({
  review,
}: ReviewCardProps): React.JSX.Element {
  return (
    <Card variant="default" padding="md" style={styles.card}>
      {/* Header: avatar + name + relative date */}
      <View style={styles.header}>
        <Avatar
          uri={review.reviewer.avatarUrl}
          name={review.reviewer.displayName}
          size="sm"
        />
        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={1}>
            {review.reviewer.displayName}
          </Text>
          <Text style={styles.date}>
            {formatRelativeTime(review.created_at)}
          </Text>
        </View>
      </View>

      {/* Star rating */}
      <StarPicker value={review.rating} size="sm" />

      {/* Optional text body */}
      {review.text ? (
        <Text style={styles.text}>{review.text}</Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerText: { flex: 1, gap: 0 },
  name: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },
  date: { ...typography.caption, color: colors.textSecondary },
  text: { ...typography.body, color: colors.textPrimary },
});
