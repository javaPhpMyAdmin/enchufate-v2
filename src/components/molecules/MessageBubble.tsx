import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Clock } from 'lucide-react-native';

import { Icon } from '@/components/atoms/Icon';
import { colors, radius, spacing, typography } from '@/theme';

export type MessageKind =
  | 'user'
  | 'system_reservation_requested'
  | 'system_reservation_confirmed'
  | 'system_reservation_cancelled'
  | 'system_reservation_completed';

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
 */
export function MessageBubble({
  body,
  kind,
  isOwn = true,
  timestamp,
  pending = false,
  style,
}: MessageBubbleProps): React.JSX.Element {
  const isUser = kind === 'user';
  // For user messages, alignment follows `isOwn`. For system
  // messages, always left-aligned gray in Phase 5 (spec polish
  // deferred to Phase 7).
  const isOutgoing = isUser && isOwn;
  const bubbleStyle = isOutgoing ? styles.bubbleUser : styles.bubbleSystem;
  const rowStyle = isOutgoing ? styles.rowUser : styles.rowSystem;
  const bodyStyle = isOutgoing ? styles.bodyUser : styles.bodySystem;
  const timestampStyle = isOutgoing ? styles.timestampUser : styles.timestampSystem;

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
        {timestamp ? <Text style={[styles.timestamp, timestampStyle]}>{timestamp}</Text> : null}
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
  bubbleSystem: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: spacing.xs },
  bodyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  body: { ...typography.body, flexShrink: 1 },
  bodyUser: { color: colors.textOnPrimary },
  bodySystem: { color: colors.textPrimary },
  bodyPending: { opacity: 0.7 },
  pendingIcon: { marginLeft: spacing.xs },
  timestamp: { ...typography.caption, fontSize: 11, marginTop: spacing.xs, opacity: 0.7 },
  timestampUser: { color: colors.textOnPrimary, textAlign: 'right' },
  timestampSystem: { color: colors.textSecondary },
});
