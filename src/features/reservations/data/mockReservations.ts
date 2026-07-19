/**
 * Mock reservations — 4 hardcoded reservations for the demo user.
 *
 * The Reservas list screen + detail screen both read from
 * `useReservations` (which returns these) and `useReservation`
 * (which looks up by id). Until we have a fresh Supabase anon key
 * (see `security/enchufate-v2-blocked-on-key`), the hooks return
 * these mocks so the screens can be exercised end-to-end.
 *
 * The mix covers the visual states + role views the screens need
 * to show:
 *   - One `solicitada` (the user is the renter) — pending, with
 *     structured start_at + end_at
 *   - One `confirmada` (the user is the renter) — confirmed, with
 *     structured time + a future date
 *   - One `cancelada` (the user is the renter) — uses the free-
 *     text `horario_a_coordinar` fallback
 *   - One `completada` (the user is the HOST) — the user can see
 *     this in the "En mis cargadores" segmented tab
 *
 * The `conversation_id` is hardcoded to match the `mockConversations`
 * array so the "Chatear" CTA on the detail screen navigates to a
 * real thread in the demo.
 */
import type { Reservation } from '../types';

const RENTER_ID = 'mock-uid';
const HOSTS = [
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004',
];
const HOST_NAMES = ['María González', 'Lucía Fernández', 'Diego Pérez', 'Carlos Rodríguez'];
const RENTER_NAMES = ['Marcelo Batista', 'Sofía Martínez', 'Juan Pérez'];

export const MOCK_RESERVATIONS: Reservation[] = [
  {
    id: 'r0001-0001-4000-8000-000000000001',
    charger_id: 'a1b2c3d4-0001-4000-8000-000000000001',
    charger_title: 'Cargador Pocitos',
    charger_address: 'Bvar. España 2345, Pocitos',
    charger_lat: -34.9083,
    charger_lng: -56.1547,
    charger_power_kw: 22,
    charger_connector_type: 'tipo_2',
    renter_id: RENTER_ID,
    renter_name: RENTER_NAMES[0]!,
    renter_avatar_url: null,
    host_id: HOSTS[0]!,
    host_name: HOST_NAMES[0]!,
    host_avatar_url: null,
    start_at: '2026-07-21T18:00:00Z',
    end_at: '2026-07-21T20:00:00Z',
    horario_a_coordinar: null,
    status: 'solicitada',
    created_at: '2026-07-18T10:00:00Z',
    updated_at: '2026-07-18T10:00:00Z',
    conversation_id: 'c1d2e3f4-0001-4000-8000-000000000001',
  },
  {
    id: 'r0001-0002-4000-8000-000000000002',
    charger_id: 'a1b2c3d4-0002-4000-8000-000000000002',
    charger_title: 'Cargador Centro',
    charger_address: 'Av. 18 de Julio 1234, Centro',
    charger_lat: -34.9061,
    charger_lng: -56.1849,
    charger_power_kw: 50,
    charger_connector_type: 'ccs',
    renter_id: RENTER_ID,
    renter_name: RENTER_NAMES[0]!,
    renter_avatar_url: null,
    host_id: HOSTS[1]!,
    host_name: HOST_NAMES[1]!,
    host_avatar_url: null,
    start_at: '2026-07-23T15:00:00Z',
    end_at: '2026-07-23T17:00:00Z',
    horario_a_coordinar: null,
    status: 'confirmada',
    created_at: '2026-07-17T15:00:00Z',
    updated_at: '2026-07-17T15:10:00Z',
    conversation_id: 'c1d2e3f4-0002-4000-8000-000000000002',
  },
  {
    id: 'r0001-0003-4000-8000-000000000003',
    charger_id: 'a1b2c3d4-0003-4000-8000-000000000003',
    charger_title: 'Cargador Punta Carretas',
    charger_address: 'José Ellauri 350, Punta Carretas',
    charger_lat: -34.9235,
    charger_lng: -56.1586,
    charger_power_kw: 22,
    charger_connector_type: 'tipo_2',
    renter_id: RENTER_ID,
    renter_name: RENTER_NAMES[0]!,
    renter_avatar_url: null,
    host_id: HOSTS[2]!,
    host_name: HOST_NAMES[2]!,
    host_avatar_url: null,
    start_at: null,
    end_at: null,
    horario_a_coordinar: 'A coordinar con el anfitrión',
    status: 'cancelada',
    created_at: '2026-07-12T12:00:00Z',
    updated_at: '2026-07-14T09:30:00Z',
    conversation_id: 'c1d2e3f4-0003-4000-8000-000000000003',
  },
  {
    // User is the HOST here so it shows up under "En mis cargadores".
    id: 'r0001-0004-4000-8000-000000000004',
    charger_id: 'b1c2d3e4-0001-4000-8000-000000000001', // one of the user's own chargers
    charger_title: 'Cargador Pocitos',
    charger_address: 'Bvar. España 2345, Pocitos',
    charger_lat: -34.9083,
    charger_lng: -56.1547,
    charger_power_kw: 22,
    charger_connector_type: 'tipo_2',
    renter_id: RENTER_NAMES[1]! ? `renter-2` : 'renter-2',
    renter_name: RENTER_NAMES[1]!,
    renter_avatar_url: null,
    host_id: RENTER_ID,
    host_name: 'Usuario Demo',
    host_avatar_url: null,
    start_at: '2026-07-20T10:00:00Z',
    end_at: '2026-07-20T12:00:00Z',
    horario_a_coordinar: null,
    status: 'completada',
    created_at: '2026-07-15T08:00:00Z',
    updated_at: '2026-07-20T12:00:00Z',
    conversation_id: 'c1d2e3f4-0004-4000-8000-000000000004',
  },
];
