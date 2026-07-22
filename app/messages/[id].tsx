/**
 * 1:1 message thread — `/messages/[id]`.
 *
 * Three regions:
 *   1. **Header** — back arrow, other-party avatar + name +
 *      "Desconectado" status (per the messaging spec; presence is
 *      not implemented in MVP). Built inline (not via
 *      `Stack.Screen` header) so the avatar + status render as a
 *      single row.
 *   2. **Message list** — inverted `FlatList` of `MessageBubble`s.
 *      Inverted layout + reversed data puts the most recent
 *      message at the bottom (chat convention). New messages
 *      auto-scroll to the bottom thanks to the `inverted` prop.
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
import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Send } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/atoms/Avatar';
import { ErrorState } from '@/components/molecules/ErrorState';
import { Icon } from '@/components/atoms/Icon';
import { LoadingState } from '@/components/molecules/LoadingState';
import { MessageBubble } from '@/components/molecules/MessageBubble';
import { useSession } from '@/features/auth/hooks/useSession';
import { useConversations } from '@/features/messaging/hooks/useConversations';
import { useMessages } from '@/features/messaging/hooks/useMessages';
import { useSendMessage } from '@/features/messaging/hooks/useSendMessage';
import { otherParty, type Message } from '@/features/messaging/types';
import { formatRelativeTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';
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

  const [text, setText] = useState('');

  // Memoize the reversed list so the FlatList doesn't see a new
  // array reference on every render (preserves scroll position).
  const reversedMessages = useMemo(() => {
    const list = messages.data ?? [];
    return [...list].reverse();
  }, [messages.data]);

  // Reset unread count when opening a conversation
  useEffect(() => {
    if (!conversationId || !userId || !conversations.data) return;
    const conv = conversations.data.find((c) => c.id === conversationId);
    if (!conv) return;
    const isHost = conv.host_id === userId;
    const update = isHost
      ? { host_unread_count: 0 }
      : { renter_unread_count: 0 };
    void supabase
      .from('conversations')
      .update(update)
      .eq('id', conversationId);
  }, [conversationId, userId, conversations.data]);

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
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
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

      {/* Message list — inverted so newest is at the bottom; auto-scrolls to the new message */}
      {messages.isLoading ? (
        <LoadingState label="Cargando mensajes..." />
      ) : messages.error ? (
        <ErrorState
          body={messages.error.userMessage}
          onRetry={() => messages.refetch()}
          retryLabel="Reintentar"
        />
      ) : (
        <FlatList
          data={reversedMessages}
          inverted
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <MessageBubbleRow message={item} currentUserId={userId ?? 'mock-uid'} />
          )}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Composer */}
      <View
        style={[
          styles.composer,
          { paddingBottom: Math.max(insets.bottom, spacing.sm) + spacing.sm },
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
}: {
  message: Message;
  currentUserId: string;
}): React.JSX.Element {
  // For system messages, isOwn is irrelevant (MessageBubble ignores it).
  const isOwn = message.sender_id !== null && message.sender_id === currentUserId;
  const timestamp = message.pending ? 'Enviando...' : formatRelativeTime(message.created_at);
  return (
    <MessageBubble
      body={message.body}
      kind={message.kind}
      isOwn={isOwn}
      timestamp={timestamp}
      pending={message.pending === true}
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
