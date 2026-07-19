/**
 * Mensajes tab — Phase 5.
 *
 * Two states:
 *   - **Guest** (no session): illustrated empty state with
 *     "Iniciá sesión" CTA. Same pattern as the other auth-gated
 *     tabs (Phase 4).
 *   - **Authenticated**: search bar ("Buscar conversaciones") +
 *     scrollable list of conversations. Each row shows the other
 *     party's avatar + name, the last message preview, the
 *     relative time, and an unread dot if `unread_count > 0`.
 *     Tapping a row navigates to `/messages/[id]` (the thread
 *     screen, which lands in the same PR).
 *
 * The search bar filters by other-party display name per the
 * messaging spec scenario. We do not filter on message body
 * (the spec only requires name filtering).
 */
import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Search, MessageCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/atoms/Avatar';
import { EmptyState } from '@/components/molecules/EmptyState';
import { ErrorState } from '@/components/molecules/ErrorState';
import { Icon } from '@/components/atoms/Icon';
import { LoadingState } from '@/components/molecules/LoadingState';
import { Skeleton } from '@/components/molecules/Skeleton';
import { useSession } from '@/features/auth/hooks/useSession';
import { useConversations } from '@/features/messaging/hooks/useConversations';
import type { Conversation } from '@/features/messaging/types';
import { otherParty } from '@/features/messaging/types';
import { formatRelativeTime } from '@/lib/format';
import { colors, radius, spacing, typography } from '@/theme';

export default function MessagesTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, isLoading: sessionLoading } = useSession();
  const userId = session?.user.id ?? null;

  if (sessionLoading) {
    return <LoadingState />;
  }

  if (!session) {
    return <GuestState topInset={insets.top} onLoginPress={() => router.push('/login?returnTo=/messages' as never)} />;
  }

  return <AuthedList userId={userId ?? 'mock-uid'} topInset={insets.top} />;
}

/* ------------------------------------------------------------------ */
/* Guest state                                                          */
/* ------------------------------------------------------------------ */

function GuestState({
  topInset,
  onLoginPress,
}: {
  topInset: number;
  onLoginPress: () => void;
}): React.JSX.Element {
  return (
    <View style={[styles.flex, { paddingTop: topInset }]}>
      <EmptyState
        icon={MessageCircle}
        title="Necesitás iniciar sesión"
        body="Iniciá sesión para ver tus conversaciones con anfitriones y huéspedes."
        ctaLabel="Iniciá sesión"
        onCtaPress={onLoginPress}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Authenticated list                                                   */
/* ------------------------------------------------------------------ */

function AuthedList({
  userId,
  topInset,
}: {
  userId: string;
  topInset: number;
}): React.JSX.Element {
  const router = useRouter();
  const conversations = useConversations(userId);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const list = conversations.data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => {
      const party = otherParty(c, userId);
      return party.name.toLowerCase().includes(q);
    });
  }, [conversations.data, query, userId]);

  if (conversations.isLoading) {
    return (
      <View style={[styles.flex, { paddingTop: topInset }]}>
        <View style={styles.skeletonList}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={styles.skeletonRow}>
              <Skeleton width={48} height={48} borderRadius={radius.pill} />
              <View style={styles.skeletonRowText}>
                <View style={styles.skeletonRowHeader}>
                  <Skeleton width="55%" height={14} />
                  <Skeleton width="20%" height={12} />
                </View>
                <Skeleton width="80%" height={12} style={styles.skeletonSpacerXs} />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (conversations.error) {
    return (
      <ErrorState
        body={conversations.error.userMessage}
        onRetry={() => conversations.refetch()}
        retryLabel="Reintentar"
      />
    );
  }

  if (filtered.length === 0) {
    return (
      <View style={[styles.flex, { paddingTop: topInset }]}>
        <SearchBar value={query} onChangeText={setQuery} />
        <EmptyState
          icon={MessageCircle}
          title={query ? 'Sin resultados' : 'Todavía no tenés conversaciones'}
          body={
            query
              ? `No encontramos conversaciones con "${query}".`
              : 'Cuando reserves un cargador o un huésped te escriba, la conversación aparece acá.'
          }
        />
      </View>
    );
  }

  return (
    <View style={[styles.flex, { paddingTop: topInset }]}>
      <SearchBar value={query} onChangeText={setQuery} />
      <FlatList
        data={filtered}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <ConversationRow
            conversation={item}
            currentUserId={userId}
            onPress={() => router.push(`/messages/${item.id}` as never)}
          />
        )}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Conversation row                                                     */
/* ------------------------------------------------------------------ */

function ConversationRow({
  conversation,
  currentUserId,
  onPress,
}: {
  conversation: Conversation;
  currentUserId: string;
  onPress: () => void;
}): React.JSX.Element {
  const party = otherParty(conversation, currentUserId);
  const preview = conversation.last_message_body;
  const time = formatRelativeTime(conversation.last_message_at);
  const unread = conversation.unread_count > 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Conversación con ${party.name}`}
      style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
    >
      <Avatar uri={party.avatarUrl} name={party.name} size="md" />
      <View style={styles.rowText}>
        <View style={styles.rowHeader}>
          <Text style={styles.rowName} numberOfLines={1}>
            {party.name}
          </Text>
          <Text style={styles.rowTime}>{time}</Text>
        </View>
        <View style={styles.rowSubheader}>
          <Text
            style={[
              styles.rowPreview,
              unread ? styles.rowPreviewUnread : null,
            ]}
            numberOfLines={1}
          >
            {preview}
          </Text>
          {unread ? <View style={styles.unreadDot} accessibilityLabel="Mensaje no leído" /> : null}
        </View>
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Search bar                                                           */
/* ------------------------------------------------------------------ */

function SearchBar({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (next: string) => void;
}): React.JSX.Element {
  return (
    <View style={styles.searchBar}>
      <Icon icon={Search} size="sm" color={colors.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Buscar conversaciones"
        placeholderTextColor={colors.textSecondary}
        style={styles.searchInput}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                               */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.base,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    paddingVertical: 0,
  },

  list: { paddingVertical: spacing.sm },
  separator: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.base },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  rowPressed: { opacity: 0.92 },
  rowText: { flex: 1, gap: 2 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowName: { ...typography.heading, color: colors.textPrimary, flex: 1 },
  rowTime: { ...typography.caption, color: colors.textSecondary, marginLeft: spacing.sm },
  rowSubheader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  rowPreview: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  rowPreviewUnread: { color: colors.textPrimary, fontWeight: '600' },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },

  // ----- Skeleton (loading) -----
  skeletonList: { paddingHorizontal: spacing.base, paddingTop: spacing.md },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  skeletonRowText: { flex: 1, gap: 2 },
  skeletonRowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skeletonSpacerXs: { marginTop: spacing.xs },
});
