/**
 * useSendMessage — optimistic mutation that appends a user message
 * to a conversation thread.
 *
 * Three lifecycle phases (per the messaging spec's "Sending is
 * Offline-Safe" requirement):
 *
 *   1. **`onMutate`** — cancel in-flight queries for the
 *      conversation, snapshot the previous message list, then
 *      append a `pending: true` optimistic message so the user
 *      sees their text appear instantly with a "sending" indicator.
 *
 *   2. **`mutationFn`** — Phase 5: just generate a stable id and
 *      resolve. Phase 7: real `.from('messages').insert(...)` call
 *      via the `messages_insert_user` RLS policy.
 *
 *   3. **`onError` / `onSettled`** — on error, restore the
 *      snapshot so the optimistic message disappears. On settle
 *      (success OR error), invalidate `['messages', convId]` so
 *      any new server-side messages are picked up.
 */
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { AppError } from '@/lib/error';
import { isFeatureEnabled } from '@/lib/features';

import type { Message } from '../types';

export interface UseSendMessageResult {
  send: (body: string) => void;
  isPending: boolean;
  error: AppError | null;
}

interface MutationContext {
  prev: Message[] | undefined;
}

export function useSendMessage(
  conversationId: string,
): UseMutationResult<Message, AppError, string, MutationContext> & UseSendMessageResult {
  const queryClient = useQueryClient();

  const mutation = useMutation<Message, AppError, string, MutationContext>({
    mutationFn: async (body: string) => {
      if (!isFeatureEnabled('CHAT')) {
        throw new AppError({
          code: 'chat_disabled',
          message: 'CHAT feature flag is off',
          userMessage: 'El chat no está disponible en este momento.',
          retryable: false,
        });
      }
      // Phase 5: mock insert. Phase 7: replace with
      //   const { data, error } = await supabase
      //     .from('messages')
      //     .insert({ conversation_id: conversationId, sender_id: uid, body, kind: 'user' })
      //     .select()
      //     .single();
      //   if (error) throw normalizeSupabaseError(error);
      //   return data;
      await new Promise((r) => setTimeout(r, 100));
      return {
        id: `local-${Date.now()}`,
        conversation_id: conversationId,
        sender_id: 'mock-uid',
        body,
        kind: 'user',
        pending: false,
        created_at: new Date().toISOString(),
      };
    },
    onMutate: async (body) => {
      const key = ['messages', conversationId] as const;
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<Message[]>(key);
      const optimistic: Message = {
        id: `pending-${Date.now()}`,
        conversation_id: conversationId,
        sender_id: 'mock-uid',
        body,
        kind: 'user',
        pending: true,
        created_at: new Date().toISOString(),
      };
      queryClient.setQueryData<Message[]>(key, (old) => [...(old ?? []), optimistic]);
      return { prev };
    },
    onError: (_err, _body, ctx) => {
      if (ctx?.prev !== undefined) {
        queryClient.setQueryData<Message[]>(
          ['messages', conversationId],
          ctx.prev,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
    },
  });

  return {
    ...mutation,
    send: (body: string) => {
      if (!body.trim()) return;
      mutation.mutate(body.trim());
    },
  };
}
