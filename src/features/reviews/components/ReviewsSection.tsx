/**
 * ReviewsSection — charger detail section that displays the average
 * rating header and a paginated list of ReviewCards.
 *
 * Gated by `isFeatureEnabled('CHARGER_REVIEWS')`. When the flag is
 * off, the entire section is hidden.
 *
 * Empty state: "Sin reseñas todavía".
 * Error state: inline error with retry.
 */
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Star } from 'lucide-react-native';

import { Card } from '@/components/atoms/Card';
import { Icon } from '@/components/atoms/Icon';
import { useChargerRating } from '@/features/reviews/hooks/useChargerRating';
import { useRespondToReview } from '@/features/reviews/hooks/useRespondToReview';
import { useReviews } from '@/features/reviews/hooks/useReviews';
import { isFeatureEnabled } from '@/lib/features';
import { colors, radius, spacing, typography } from '@/theme';

import { ReviewCard } from './ReviewCard';

export interface ReviewsSectionProps {
  chargerId: string;
  /** The charger owner's user id. When set, the owner can respond to reviews. */
  ownerId?: string;
}

export function ReviewsSection({ chargerId, ownerId }: ReviewsSectionProps): React.JSX.Element | null {
  if (!isFeatureEnabled('CHARGER_REVIEWS')) return null;

  return <ReviewsSectionInner chargerId={chargerId} ownerId={ownerId} />;
}

/* ------------------------------------------------------------------ */
/* Inner component (only rendered when the flag is on)                  */
/* ------------------------------------------------------------------ */

function ReviewsSectionInner({
  chargerId,
  ownerId,
}: {
  chargerId: string;
  ownerId?: string;
}): React.JSX.Element {
  const rating = useChargerRating(chargerId);
  const reviews = useReviews(chargerId);
  const { respondToReview, isPending: isResponding } = useRespondToReview();

  const avgRating = rating.data?.avg_rating ?? 0;
  const reviewCount = rating.data?.review_count ?? 0;

  const displayRating = avgRating > 0 ? avgRating.toFixed(1) : '0.0';
  const hasReviews = reviewCount > 0;

  const handleRespond = (reviewId: string, response: string) => {
    void respondToReview({ reviewId, chargerId, response });
  };

  return (
    <View style={styles.section}>
      {/* Rating header */}
      <Card variant="default" padding="md" style={styles.headerCard}>
        <View style={styles.ratingRow}>
          <Icon icon={Star} size="md" color={colors.primary} />
          <Text style={styles.ratingValue}>{displayRating}</Text>
          <Text style={styles.ratingDot}>·</Text>
          <Text style={styles.ratingCount}>
            {hasReviews
              ? `${reviewCount} reseña${reviewCount === 1 ? '' : 's'}`
              : 'sin reseñas todavía'}
          </Text>
        </View>
      </Card>

      {/* Reviews list */}
      {reviews.isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : reviews.error ? (
        <Card variant="default" padding="md" style={styles.errorCard}>
          <Text style={styles.errorText}>
            No pudimos cargar las reseñas.
          </Text>
          <Pressable onPress={() => reviews.refetch()} style={styles.retryButton}>
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
        </Card>
      ) : hasReviews ? (
        <View style={styles.reviewList}>
          {(reviews.data ?? []).map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              isOwner={Boolean(ownerId)}
              onRespond={handleRespond}
              isResponding={isResponding}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },

  headerCard: { gap: spacing.xs },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  ratingValue: { ...typography.heading, color: colors.textPrimary },
  ratingDot: { ...typography.body, color: colors.textSecondary },
  ratingCount: { ...typography.body, color: colors.textSecondary, flex: 1 },

  loadingWrap: { paddingVertical: spacing.lg, alignItems: 'center' },

  errorCard: { alignItems: 'center', gap: spacing.sm },
  errorText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  retryButton: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  retryText: { ...typography.caption, color: colors.primary, fontWeight: '600' },

  reviewList: { gap: spacing.sm },
});
