/**
 * 1:1 message thread — `/messages/[id]`.
 *
 * Three regions:
 *   1. **Header** — back arrow, other-party avatar + name +
 *      "Desconectado" status (per the messaging spec; presence is
 *      not implemented in MVP). Built inline (not via
 *      `Stack.Screen` header) so the avatar + status render as a
 *      single row.
 *   2. **Message list** — `FlatList` of `MessageBubble`s in
 *      chronological order (oldest first). Messages fill from the
 *      top; `scrollToEnd` on load and on send keeps the latest
 *      message visible at the bottom.
 *   3. **Composer** — multi-line `TextInput` with "Escribí un
 *      mensaje" placeholder and a paper-plane send button. The
 *      button is disabled when the input is empty or a send is in
 *      flight; the optimistic update from `useSendMessage`
 *      renders the message with a pending indicator immediately.
 *
 * The route is OUTSIDE the `(tabs)` group so the bottom tab bar
 * is hidden per the navigation spec. The Expo Router back gesture
 * (or the explicit back button in the header) returns the user
 * to the Mensajes list.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Send } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/atoms/Avatar';
import { ErrorState } from '@/components/molecules/ErrorState';
import { Icon } from '@/components/atoms/Icon';
import { LoadingState } from '@/components/molecules/LoadingState';
import { MessageBubble } from '@/components/molecules/MessageBubble';
import { useSession } from '@/features/auth/hooks/useSession';
import { useConversations } from '@/features/messaging/hooks/useConversations';
import { useMarkAsRead } from '@/features/messages/hooks/useMarkAsRead';
import { useMessages } from '@/features/messaging/hooks/useMessages';
import { useSendMessage } from '@/features/messaging/hooks/useSendMessage';
import { otherParty, type Conversation, type Message } from '@/features/messaging/types';
import { formatRelativeTime } from '@/lib/format';
import { colors, radius, spacing, typography } from '@/theme';

export default function ThreadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const conversationId = typeof params.id === 'string' ? params.id : null;

  const { session, isLoading: sessionLoading } = useSession();
  const userId = session?.user.id ?? null;
  const conversations = useConversations(userId);
  const messages = useMessages(conversationId);
  const sendMessage = useSendMessage(conversationId ?? 'noop', userId);
  const { markAsRead } = useMarkAsRead(conversationId);
  const queryClient = useQueryClient();

  const [text, setText] = useState('');
  const [kbHeight, setKbHeight] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  // Id of the newest foreign (not-mine) message that already triggered
  // a read-receipt stamp. Seeded on initial load; changed only when a
  // NEW foreign message arrives so the watcher below never re-stamps
  // for the same message (and never loops on the read_at cache merge).
  const stampedForeignIdRef = useRef<string | null>(null);

  // Android: track keyboard height so we can push the composer up
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      setKbHeight(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setKbHeight(0);
    });
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Scroll to bottom when messages load or change.
  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: false });
  }, []);

  // Mark messages as read + reset the own unread counter when the
  // conversation opens (fire-and-forget). `useMarkAsRead` handles
  // both writes: it stamps `read_at` on the other party's unread
  // messages and resets the caller's counter on the conversation row.
  // Both updates are idempotent (`read_at IS NULL` / `counter = 0`),
  // so re-runs after a session load are harmless no-ops.
  useEffect(() => {
    if (conversationId && userId) {
      void markAsRead();
    }
  }, [conversationId, userId, markAsRead]);

  // Re-arm the stamp when foreign messages arrive while the thread
  // stays open (read receipts for the dominant flow: the recipient
  // keeps the thread open and the other party writes). Without this,
  // nothing re-stamps `read_at` and the sender would see a single
  // tick forever; the server-side unread counter also re-increments
  // on insert, so the badge would reappear.
  //
  // The first run only seeds `stampedForeignIdRef` (the mount effect
  // above already stamped everything on open). Later, a NEW foreign
  // message id re-arms a debounced (300 ms, trailing edge) stamp —
  // rapid-fire arrivals reset the timer, and the idempotent reset
  // makes the eventual call a server-side no-op if it races the
  // realtime cache merge.
  useEffect(() => {
    if (!conversationId || !userId || !messages.data) return;
    const foreign = messages.data.filter(
      (m) => m.sender_id !== null && m.sender_id !== userId,
    );
    const newest = foreign[foreign.length - 1];
    if (!newest) return;

    if (stampedForeignIdRef.current === null) {
      stampedForeignIdRef.current = newest.id;
      return;
    }
    if (stampedForeignIdRef.current === newest.id) return;

    stampedForeignIdRef.current = newest.id;
    const timer = setTimeout(() => {
      void markAsRead();
    }, 300);
    return () => clearTimeout(timer);
  }, [messages.data, userId, conversationId, markAsRead]);

  // Focus fallback: refetch the thread when the screen regains focus
  // (mirrors the messages list). Covers realtime gaps — e.g. missed
  // UPDATE events after a reconnect — and re-syncs the conversations
  // cache so the unread counter shown on the list is fresh.
  useFocusEffect(
    useCallback(() => {
      if (!conversationId) return;
      void queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }, [conversationId, queryClient]),
  );

  if (sessionLoading) {
    return <LoadingState />;
  }

  if (!session) {
    return (
      <View style={styles.flex}>
        <ErrorState
          title="Necesitás iniciar sesión"
          body="Iniciá sesión para leer y responder mensajes."
          onRetry={() => router.push('/login?returnTo=/messages' as never)}
          retryLabel="Iniciá sesión"
        />
      </View>
    );
  }

  if (!conversationId) {
    return (
      <View style={styles.flex}>
        <ErrorState
          title="Conversación no encontrada"
          body="El enlace que seguiste no apunta a una conversación válida."
          onRetry={() => router.replace('/messages' as never)}
          retryLabel="Volver a mensajes"
        />
      </View>
    );
  }

  if (conversations.isLoading) {
    return <LoadingState />;
  }

  const conversation = (conversations.data ?? []).find((c) => c.id === conversationId);
  if (!conversation) {
    return (
      <View style={styles.flex}>
        <ErrorState
          title="Conversación no encontrada"
          body="No encontramos esta conversación. Es posible que haya sido eliminada."
          onRetry={() => router.replace('/messages' as never)}
          retryLabel="Volver a mensajes"
        />
      </View>
    );
  }

  const party = otherParty(conversation, userId ?? 'mock-uid');

  const onSend = () => {
    if (!text.trim() || sendMessage.isPending) return;
    sendMessage.send(text);
    setText('');
    // Scroll to bottom after the optimistic update renders.
    requestAnimationFrame(scrollToBottom);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header — custom, not Stack.Screen, so we can render the avatar + status as one row */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          hitSlop={8}
          style={styles.backButton}
        >
          <Icon icon={ChevronLeft} size="lg" color={colors.textPrimary} />
        </Pressable>
        <Avatar uri={party.avatarUrl} name={party.name} size="sm" />
        <View style={styles.headerText}>
          <Text style={styles.headerName} numberOfLines={1}>
            {party.name}
          </Text>
          <Text style={styles.headerStatus}>Desconectado</Text>
        </View>
      </View>

      {/* Message list — chronological order, auto-scrolls to bottom on load and send */}
      {messages.isLoading ? (
        <LoadingState label="Cargando mensajes..." />
      ) : messages.error && !messages.data ? (
        // Full error state only when there is nothing to show. A
        // failed background refetch (e.g. the focus fallback above)
        // keeps `data` and sets `error` — render the stale thread
        // instead of replacing it with an error screen.
        <ErrorState
          body={messages.error.userMessage}
          onRetry={() => messages.refetch()}
          retryLabel="Reintentar"
        />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages.data ?? []}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <MessageBubbleRow
              message={item}
              currentUserId={userId ?? 'mock-uid'}
              conversation={conversation}
            />
          )}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={scrollToBottom}
          onLayout={scrollToBottom}
        />
      )}

      {/* Composer */}
      <View
        style={[
          styles.composer,
          {
            paddingBottom: Platform.OS === 'android'
              ? kbHeight + spacing.xl
              : Math.max(insets.bottom, spacing.sm) + spacing.sm,
          },
        ]}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Escribí un mensaje"
          placeholderTextColor={colors.textSecondary}
          style={styles.composerInput}
          multiline
          maxLength={500}
          editable={!sendMessage.isPending}
        />
        <Pressable
          onPress={onSend}
          disabled={!text.trim() || sendMessage.isPending}
          accessibilityRole="button"
          accessibilityLabel="Enviar mensaje"
          hitSlop={8}
          style={({ pressed }) => [
            styles.sendButton,
            {
              opacity: !text.trim() || sendMessage.isPending ? 0.5 : pressed ? 0.85 : 1,
            },
          ]}
        >
          <Icon icon={Send} size="md" color={colors.textOnPrimary} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

/* ------------------------------------------------------------------ */
/* Row wrapper — derives isOwn + formats the timestamp for MessageBubble */
/* ------------------------------------------------------------------ */

function MessageBubbleRow({
  message,
  currentUserId,
  conversation,
}: {
  message: Message;
  currentUserId: string;
  conversation: Conversation;
}): React.JSX.Element {
  // For system messages, determine ownership based on who triggered the action:
  // - reservation_requested → renter initiated → own for renter
  // - reservation_confirmed → host initiated → own for host
  // - reservation_cancelled → either party, default left
  let isOwn: boolean;
  if (message.sender_id !== null) {
    isOwn = message.sender_id === currentUserId;
  } else if (message.kind === 'system_reservation_requested') {
    isOwn = conversation.renter_id === currentUserId;
  } else if (message.kind === 'system_reservation_confirmed') {
    isOwn = conversation.host_id === currentUserId;
  } else {
    isOwn = false;
  }

  const timestamp = message.pending ? 'Enviando...' : formatRelativeTime(message.created_at);
  return (
    <MessageBubble
      body={message.body}
      kind={message.kind}
      isOwn={isOwn}
      timestamp={timestamp}
      pending={message.pending === true}
      readAt={message.read_at}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                               */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: { padding: spacing.xs, marginLeft: -spacing.xs },
  headerText: { flex: 1, gap: 2 },
  headerName: { ...typography.heading, color: colors.textPrimary },
  headerStatus: { ...typography.caption, color: colors.textSecondary },

  list: {
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  composerInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    maxHeight: 120,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
