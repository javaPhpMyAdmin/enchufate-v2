/**
 * Mock conversations — 3 hardcoded 1:1 threads for the demo user.
 *
 * The Mensajes list screen and the 1:1 thread both read from
 * `useConversations` (which returns this array) and `useMessages`
 * (which returns the messages keyed by `conversation_id`). Until
 * we have a fresh Supabase anon key (see
 * `security/enchufate-v2-blocked-on-key`), the hooks return these
 * mocks so the screens can be exercised end-to-end in Expo Go.
 *
 * One conversation has `unread_count > 0` so the unread dot in the
 * list row is visible during the dev preview. The hosts + renters
 * use realistic Uruguayan names so the avatar initials cover the
 * common cases.
 */
import type { Conversation } from '../types';

const NOW = '2026-07-18T12:00:00Z';

export const MOCK_RENTER_ID = 'mock-uid';

export const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 'c1d2e3f4-0001-4000-8000-000000000001',
    charger_id: 'a1b2c3d4-0001-4000-8000-000000000001',
    charger_title: 'Cargador Pocitos',
    renter_id: MOCK_RENTER_ID,
    renter_name: 'Usuario Demo',
    renter_avatar_url: null,
    host_id: '00000000-0000-0000-0000-000000000001',
    host_name: 'María González',
    host_avatar_url: null,
    last_message_at: '2026-07-18T11:42:00Z',
    last_message_body: '¡Hola! Quiero reservar tu cargador.',
    last_message_kind: 'system_reservation_requested',
    unread_count: 2,
  },
  {
    id: 'c1d2e3f4-0002-4000-8000-000000000002',
    charger_id: 'a1b2c3d4-0002-4000-8000-000000000002',
    charger_title: 'Cargador Centro',
    renter_id: MOCK_RENTER_ID,
    renter_name: 'Usuario Demo',
    renter_avatar_url: null,
    host_id: '00000000-0000-0000-0000-000000000002',
    host_name: 'Lucía Fernández',
    host_avatar_url: null,
    last_message_at: '2026-07-17T15:18:00Z',
    last_message_body: 'Listo! Tu reserva fue confirmada. Chateamos para coordinar.',
    last_message_kind: 'system_reservation_confirmed',
    unread_count: 0,
  },
  {
    id: 'c1d2e3f4-0003-4000-8000-000000000003',
    charger_id: 'a1b2c3d4-0003-4000-8000-000000000003',
    charger_title: 'Cargador Punta Carretas',
    renter_id: MOCK_RENTER_ID,
    renter_name: 'Usuario Demo',
    renter_avatar_url: null,
    host_id: '00000000-0000-0000-0000-000000000003',
    host_name: 'Diego Pérez',
    host_avatar_url: null,
    last_message_at: '2026-07-15T09:05:00Z',
    last_message_body: 'Perfecto, nos vemos mañana a las 10.',
    last_message_kind: 'user',
    unread_count: 0,
  },
];
