import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

export type MessageKind = 'user' | 'system_reservation_requested' | 'system_reservation_confirmed' | 'system_reservation_cancelled' | 'system_reservation_completed';

export interface MessageBubbleProps {
  body: string;
  kind: MessageKind;
  /** When provided, shows a small timestamp below the bubble. */
  timestamp?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * MessageBubble — chat message component.
 *
 * User messages are right-aligned, orange-tinted, white text.
 * System messages are left-aligned, gray-tinted, dark text.
 * The system kinds map to the `kind` enum used by the messaging
 * feature hook and the `system-message-injector` Edge Function
 * (Phase 7).
 */
export function MessageBubble({ body, kind, timestamp, style }: MessageBubbleProps): React.JSX.Element {
  const isUser = kind === 'user';
  return (
    <View
      style={[styles.row, isUser ? styles.rowUser : styles.rowSystem, style]}
      accessibilityRole="text"
      accessibilityLabel={body}
    >
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleSystem,
        ]}
      >
        <Text style={[styles.body, isUser ? styles.bodyUser : styles.bodySystem]}>{body}</Text>
        {timestamp ? <Text style={[styles.timestamp, isUser ? styles.timestampUser : styles.timestampSystem]}>{timestamp}</Text> : null}
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
  body: { ...typography.body },
  bodyUser: { color: colors.textOnPrimary },
  bodySystem: { color: colors.textPrimary },
  timestamp: { ...typography.caption, fontSize: 11, marginTop: spacing.xs, opacity: 0.7 },
  timestampUser: { color: colors.textOnPrimary, textAlign: 'right' },
  timestampSystem: { color: colors.textSecondary },
});
