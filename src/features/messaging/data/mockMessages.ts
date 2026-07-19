/**
 * Mock messages — per-conversation chat history.
 *
 * The `useMessages` hook looks up messages by `conversation_id`
 * against this map. The first conversation has the most recent
 * activity (a system request + user reply); the second has a
 * completed thread with a system confirm; the third is a
 * user-only thread that ended a few days ago.
 *
 * Times are ordered ascending (oldest first) so the FlatList with
 * `inverted` displays the most recent message at the bottom (the
 * chat convention).
 */
import type { Message } from '../types';

const HOST_PREFIX = '00000000-0000-0000-0000-000000000';
const host = (n: number) => `${HOST_PREFIX}${String(n).padStart(2, '0')}`;

const RENTER_ID = 'mock-uid';

export const MOCK_MESSAGES: Record<string, Message[]> = {
  // Conversation 1 — Pocitos (active, system + user mix)
  'c1d2e3f4-0001-4000-8000-000000000001': [
    {
      id: 'm0001-0001-4000-8000-000000000001',
      conversation_id: 'c1d2e3f4-0001-4000-8000-000000000001',
      sender_id: null,
      body: '¡Hola! Quiero reservar tu cargador Cargador Pocitos.',
      kind: 'system_reservation_requested',
      created_at: '2026-07-18T11:30:00Z',
    },
    {
      id: 'm0001-0002-4000-8000-000000000002',
      conversation_id: 'c1d2e3f4-0001-4000-8000-000000000001',
      sender_id: RENTER_ID,
      body: 'Buenas María, ¿podrías el martes a las 18?',
      kind: 'user',
      created_at: '2026-07-18T11:35:00Z',
    },
    {
      id: 'm0001-0003-4000-8000-000000000003',
      conversation_id: 'c1d2e3f4-0001-4000-8000-000000000001',
      sender_id: host(1),
      body: 'Sí, perfecto. Te espero.',
      kind: 'user',
      created_at: '2026-07-18T11:42:00Z',
    },
  ],

  // Conversation 2 — Centro (confirmed, all system + user mix)
  'c1d2e3f4-0002-4000-8000-000000000002': [
    {
      id: 'm0002-0001-4000-8000-000000000001',
      conversation_id: 'c1d2e3f4-0002-4000-8000-000000000002',
      sender_id: null,
      body: '¡Hola! Quiero reservar tu cargador Cargador Centro.',
      kind: 'system_reservation_requested',
      created_at: '2026-07-17T15:00:00Z',
    },
    {
      id: 'm0002-0002-4000-8000-000000000002',
      conversation_id: 'c1d2e3f4-0002-4000-8000-000000000002',
      sender_id: host(2),
      body: 'Listo! Tu reserva fue confirmada. Chateamos para coordinar.',
      kind: 'system_reservation_confirmed',
      created_at: '2026-07-17T15:10:00Z',
    },
    {
      id: 'm0002-0003-4000-8000-000000000003',
      conversation_id: 'c1d2e3f4-0002-4000-8000-000000000002',
      sender_id: RENTER_ID,
      body: 'Genial, gracias!',
      kind: 'user',
      created_at: '2026-07-17T15:18:00Z',
    },
  ],

  // Conversation 3 — Punta Carretas (user-only, older)
  'c1d2e3f4-0003-4000-8000-000000000003': [
    {
      id: 'm0003-0001-4000-8000-000000000001',
      conversation_id: 'c1d2e3f4-0003-4000-8000-000000000003',
      sender_id: RENTER_ID,
      body: 'Hola Diego, ¿tenés disponibilidad el jueves?',
      kind: 'user',
      created_at: '2026-07-15T08:50:00Z',
    },
    {
      id: 'm0003-0002-4000-8000-000000000002',
      conversation_id: 'c1d2e3f4-0003-4000-8000-000000000003',
      sender_id: host(3),
      body: 'Perfecto, nos vemos mañana a las 10.',
      kind: 'user',
      created_at: '2026-07-15T09:05:00Z',
    },
  ],
};
