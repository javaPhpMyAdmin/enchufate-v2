/**
 * Zod schemas — `message`.
 *
 * The `messageSchema` validates the rows of `public.messages` as
 * returned by Supabase Realtime + the SELECT chain. The constraints
 * are intentionally narrow:
 *   - `body` is non-empty (matches the SQL `body text not null`
 *     and the spec's "no empty messages" requirement).
 *   - `kind` is one of the four enum values (user, the 3
 *     system_* kinds). The DB enforces this with the
 *     `message_kind` enum; the client schema gives the form a
 *     typed error before the round-trip.
 *
 * Note on `sender_id`: the SQL column is `uuid references
 * public.profiles(id) on delete set null` — i.e. it is nullable
 * for system messages (which are inserted by the Edge Function
 * running as the server-side privileged role). The schema mirrors
 * that with `.nullable()`.
 *
 * The schema is consumed by:
 *   - `useMessages` to validate each row before pushing it into
 *     the TanStack Query cache (defensive — the server is
 *     authoritative, but a malformed payload would otherwise
 *     crash the bubble renderer).
 *   - `useSendMessage` mutation input validation (Phase 7).
 */
import { z } from 'zod';

const MESSAGE_KIND_VALUES = [
  'user',
  'system_reservation_requested',
  'system_reservation_confirmed',
  'system_reservation_cancelled',
] as const;

export const messageSchema = z.object({
  id: z.string().min(1),
  conversation_id: z.string().min(1),
  // Nullable for system messages (no human sender).
  sender_id: z.string().min(1).nullable(),
  body: z
    .string()
    .min(1, 'El mensaje no puede estar vacío')
    .max(4000, 'Máximo 4000 caracteres'),
  kind: z.enum(MESSAGE_KIND_VALUES),
  created_at: z.string().min(1),
});

/** Input-only shape for the `useSendMessage` mutation — strips
 *  the server-managed `id` and `created_at`. */
export const messageInputSchema = z.object({
  conversation_id: z.string().min(1),
  sender_id: z.string().min(1),
  body: z
    .string()
    .min(1, 'El mensaje no puede estar vacío')
    .max(4000, 'Máximo 4000 caracteres'),
});

export type MessageInput = z.infer<typeof messageSchema>;
export type MessageSendInput = z.infer<typeof messageInputSchema>;
