/**
 * ReviewCard — single review display within a ReviewsSection.
 *
 * Shows: reviewer avatar (or initials fallback), display name,
 * star rating, optional text body, relative timestamp, and
 * optional host response block with a "Responder" button for the
 * charger owner.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MessageSquare } from 'lucide-react-native';

import { Avatar } from '@/components/atoms/Avatar';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { Icon } from '@/components/atoms/Icon';
import { formatRelativeTime } from '@/lib/format';
import { colors, radius, spacing, typography } from '@/theme';

import type { ReviewWithReviewer } from '../types';

import { StarPicker } from './StarPicker';

export interface ReviewCardProps {
  review: ReviewWithReviewer;
  /** True when the current user is the charger owner (can respond). */
  isOwner?: boolean;
  /** Called when the owner submits a response. */
  onRespond?: (reviewId: string, response: string) => void;
  /** True while the respond mutation is in flight. */
  isResponding?: boolean;
}

export function ReviewCard({
  review,
  isOwner = false,
  onRespond,
  isResponding = false,
}: ReviewCardProps): React.JSX.Element {
  const [showResponseForm, setShowResponseForm] = useState(false);
  const [responseText, setResponseText] = useState('');

  const hasResponse = Boolean(review.response);

  const handleSubmitResponse = () => {
    if (!responseText.trim() || !onRespond) return;
    onRespond(review.id, responseText.trim());
    setResponseText('');
    setShowResponseForm(false);
  };

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

      {/* Host response */}
      {hasResponse ? (
        <View style={styles.responseBlock}>
          <Text style={styles.responseLabel}>Respuesta del anfitrión</Text>
          <Text style={styles.responseText}>{review.response}</Text>
          {review.responded_at ? (
            <Text style={styles.responseDate}>
              {formatRelativeTime(review.responded_at)}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Respond button — only for the charger owner, only when no response yet */}
      {isOwner && !hasResponse && !showResponseForm ? (
        <Pressable
          onPress={() => setShowResponseForm(true)}
          style={styles.respondTrigger}
          accessibilityRole="button"
          accessibilityLabel="Responder a esta reseña"
        >
          <Icon icon={MessageSquare} size="sm" color={colors.primary} />
          <Text style={styles.respondTriggerText}>Responder</Text>
        </Pressable>
      ) : null}

      {/* Inline response form */}
      {showResponseForm ? (
        <View style={styles.responseForm}>
          <TextInput
            value={responseText}
            onChangeText={setResponseText}
            placeholder="Escribí tu respuesta..."
            placeholderTextColor={colors.textSecondary}
            style={styles.responseInput}
            multiline
            maxLength={1000}
            editable={!isResponding}
          />
          <View style={styles.responseActions}>
            <Button
              label="Cancelar"
              variant="ghost"
              onPress={() => {
                setShowResponseForm(false);
                setResponseText('');
              }}
              disabled={isResponding}
            />
            <Button
              label={isResponding ? 'Enviando...' : 'Enviar'}
              variant="primary"
              onPress={handleSubmitResponse}
              disabled={!responseText.trim() || isResponding}
              loading={isResponding}
            />
          </View>
        </View>
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
  responseBlock: {
    backgroundColor: colors.background,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  responseLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  responseText: { ...typography.body, color: colors.textPrimary },
  responseDate: { ...typography.caption, color: colors.textSecondary },
  respondTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  respondTriggerText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  responseForm: { gap: spacing.sm },
  responseInput: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    maxHeight: 100,
  },
  responseActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});
