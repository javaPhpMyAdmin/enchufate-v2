/**
 * Mock reservations — 5 hardcoded reservations for the demo user.
 *
 * NOTE: the app runs in real Supabase mode when `.env` has an anon
 * key and `EXPO_PUBLIC_MOCK_SUPABASE` is unset — these mocks only
 * load when the env falls back to mock mode. They exist so the
 * screens can be exercised without a backend.
 *
 * The Reservas list screen + detail screen both read from
 * `useReservations` (which returns these) and `useReservation`
 * (which looks up by id). The mix covers the visual states + role
 * views the screens need to show:
 *   - One `solicitada` (the user is the renter) — pending, with
 *     structured start_at + end_at
 *   - One `confirmada` (the user is the renter) — confirmed, with
 *     structured time + a future date
 *   - One `en_curso` (the user is the renter) — charging now, with
 *     a recent `charging_started_at` (timer + "Finalizar carga" CTA)
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
    charging_started_at: null,
    created_at: '2026-07-18T10:00:00Z',
    updated_at: '2026-07-18T10:00:00Z',
    cancel_reason: null,
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
    start_at: '2026-08-02T15:00:00Z',
    end_at: '2026-08-02T17:00:00Z',
    horario_a_coordinar: null,
    status: 'confirmada',
    charging_started_at: null,
    created_at: '2026-07-17T15:00:00Z',
    updated_at: '2026-08-01T10:00:00Z',
    cancel_reason: null,
    conversation_id: 'c1d2e3f4-0002-4000-8000-000000000002',
  },
  {
    // User is the renter; charging started 20 minutes ago so the
    // card shows the active timer + the "Finalizar carga" CTA.
    id: 'r0001-0005-4000-8000-000000000005',
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
    start_at: '2026-07-31T09:00:00Z',
    end_at: '2026-07-31T11:00:00Z',
    horario_a_coordinar: null,
    status: 'en_curso',
    charging_started_at: '2026-07-31T09:20:00Z',
    created_at: '2026-07-30T12:00:00Z',
    updated_at: '2026-07-31T09:20:00Z',
    cancel_reason: null,
    conversation_id: 'c1d2e3f4-0005-4000-8000-000000000005',
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
    charging_started_at: null,
    created_at: '2026-07-12T12:00:00Z',
    updated_at: '2026-07-14T09:30:00Z',
    cancel_reason: 'Finalmente no me convenía el horario.',
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
    charging_started_at: null,
    created_at: '2026-07-15T08:00:00Z',
    updated_at: '2026-07-20T12:00:00Z',
    cancel_reason: null,
    conversation_id: 'c1d2e3f4-0004-4000-8000-000000000004',
  },
];
