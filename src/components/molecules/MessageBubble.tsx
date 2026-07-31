import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Check, CheckCheck, Clock } from 'lucide-react-native';

import { Icon } from '@/components/atoms/Icon';
import type { MessageKind } from '@/features/messaging/types';
import { colors, radius, spacing, typography } from '@/theme';

export interface MessageBubbleProps {
  body: string;
  kind: MessageKind;
  /**
   * For `kind: 'user'`: whether the message was sent by the
   * current user. Outgoing (own) → right-aligned orange;
   * incoming → left-aligned gray. Ignored for system kinds.
   * Defaults to `true` to preserve the previous behaviour where
   * every user-kind message was assumed to be outgoing.
   */
  isOwn?: boolean;
  /** When provided, shows a small timestamp below the bubble. */
  timestamp?: string;
  /** Shows a small clock icon next to the body to signal an optimistic insert. */
  pending?: boolean;
  /** ISO timestamp of when the message was read by the other party. Null = unread. */
  readAt?: string | null;
  style?: StyleProp<ViewStyle>;
}

/**
 * MessageBubble — chat message component.
 *
 * User messages render right-aligned (own, orange) or left-aligned
 * (other party, gray) depending on `isOwn`. System messages render
 * left-aligned gray per the current `MessageBubble` implementation;
 * the spec wants `system_reservation_confirmed` and
 * `system_reservation_cancelled` to render right-aligned orange —
 * that polish lands in Phase 7 with the real system-message-
 * injector Edge Function.
 *
 * Read indicator: outgoing user messages show a single tick (sent)
 * when `readAt` is null/undefined, or a double tick (read) when
 * `readAt` is set. System messages never show ticks.
 */
export function MessageBubble({
  body,
  isOwn = true,
  timestamp,
  pending = false,
  readAt,
  style,
}: MessageBubbleProps): React.JSX.Element {
  // Any message belonging to the current user gets the outgoing style
  // (orange bubble, white text) regardless of kind.
  const isOutgoing = isOwn;
  const isRightAligned = isOwn;
  const bubbleStyle = isOutgoing ? styles.bubbleUser : styles.bubbleSystem;
  const rowStyle = isRightAligned ? styles.rowUser : styles.rowSystem;
  const bodyStyle = isOutgoing ? styles.bodyUser : styles.bodySystem;
  const timestampStyle = isOutgoing ? styles.timestampUser : styles.timestampSystem;

  // Read indicator: only for outgoing user messages, not system messages.
  const showReadTick = isOutgoing && !pending;
  const isRead = showReadTick && Boolean(readAt);

  return (
    <View
      style={[styles.row, rowStyle, style]}
      accessibilityRole="text"
      accessibilityLabel={body}
    >
      <View style={[styles.bubble, bubbleStyle]}>
        <View style={styles.bodyRow}>
          <Text style={[styles.body, bodyStyle, pending ? styles.bodyPending : null]}>{body}</Text>
          {pending ? (
            <View style={styles.pendingIcon}>
              <Icon icon={Clock} size="sm" color={colors.textOnPrimary} />
            </View>
          ) : null}
        </View>
        <View style={styles.footerRow}>
          {timestamp ? <Text style={[styles.timestamp, timestampStyle]}>{timestamp}</Text> : null}
          {showReadTick ? (
            <Icon
              icon={isRead ? CheckCheck : Check}
              size="sm"
              color={isRead ? colors.textOnPrimary : colors.textSecondary}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: spacing.xs, paddingHorizontal: spacing.base },
  rowUser: { justifyContent: 'flex-end' },
  rowSystem: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.card },
  bubbleUser: { backgroundColor: colors.primary, borderBottomRightRadius: spacing.xs },
  bubbleSystem: { backgroundColor: colors.bubbleIncoming, borderBottomLeftRadius: spacing.xs },
  bodyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  body: { ...typography.body, flexShrink: 1 },
  bodyUser: { color: colors.textOnPrimary },
  bodySystem: { color: colors.textPrimary },
  bodyPending: { opacity: 0.7 },
  pendingIcon: { marginLeft: spacing.xs },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.xs, marginTop: spacing.xs },
  timestamp: { ...typography.caption, fontSize: 11, opacity: 0.7 },
  timestampUser: { color: colors.textOnPrimary, textAlign: 'right' },
  timestampSystem: { color: colors.textSecondary },
});
