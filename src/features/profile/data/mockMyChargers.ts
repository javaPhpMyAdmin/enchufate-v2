/**
 * Mock chargers owned by the demo user.
 *
 * The Perfil screen shows the "Mis cargadores" section with a list
 * of the signed-in user's chargers (per the profile spec). For
 * Phase 5 the hook returns this hardcoded list because we still
 * don't have a fresh Supabase anon key to query `public.chargers`
 * for real (see `security/enchufate-v2-blocked-on-key`).
 *
 * The shape matches `Charger` byte-for-byte with the
 * `src/features/chargers/types.ts` interface and the
 * `public.chargers` schema, so the Phase 6 swap to a real
 * `.from('chargers').select().eq('owner_id', uid)` is zero call-site
 * changes. The `owner_id` is a fixed `'mock-uid'` so the screen can
 * also verify the count against the stat card.
 *
 * The mix covers the visual states the screen needs to show:
 *   - one `active` Tipo 2 (the "happy path")
 *   - one `paused` (the host temporarily disabled it)
 *   - one `active` CCS (different connector)
 */
import type { Charger } from '@/features/chargers/types';

const DAY_24_7: Charger['schedule'] = {
  mon: [{ from: '00:00', to: '23:59' }],
  tue: [{ from: '00:00', to: '23:59' }],
  wed: [{ from: '00:00', to: '23:59' }],
  thu: [{ from: '00:00', to: '23:59' }],
  fri: [{ from: '00:00', to: '23:59' }],
  sat: [{ from: '00:00', to: '23:59' }],
  sun: [{ from: '00:00', to: '23:59' }],
};

const NINE_TO_NINE: Charger['schedule'] = {
  mon: [{ from: '09:00', to: '21:00' }],
  tue: [{ from: '09:00', to: '21:00' }],
  wed: [{ from: '09:00', to: '21:00' }],
  thu: [{ from: '09:00', to: '21:00' }],
  fri: [{ from: '09:00', to: '21:00' }],
  sat: [{ from: '09:00', to: '21:00' }],
  sun: [{ from: '14:00', to: '20:00' }],
};

const NOW = '2026-07-15T12:00:00Z';

export const MOCK_OWNER_ID = 'mock-uid';

export const MOCK_MY_CHARGERS: Charger[] = [
  {
    id: 'b1c2d3e4-0001-4000-8000-000000000001',
    owner_id: MOCK_OWNER_ID,
    title: 'Cargador Pocitos',
    description: 'Cargador en cochera residencial, entrada por Bvar. España.',
    address: 'Bvar. España 2345, Pocitos',
    lat: -34.9083,
    lng: -56.1547,
    connector_type: 'tipo_2',
    power_kw: 22,
    price_per_hour_usd: 1.2,
    min_reservation_minutes: 60,
    photos: [],
    rules: 'No usar después de las 22 hs.',
    schedule: NINE_TO_NINE,
    status: 'active',
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: 'b1c2d3e4-0002-4000-8000-000000000002',
    owner_id: MOCK_OWNER_ID,
    title: 'Cargador Centro',
    description: 'Cargador rápido en parking subterráneo, 24/7.',
    address: 'Av. 18 de Julio 1234, Centro',
    lat: -34.9061,
    lng: -56.1849,
    connector_type: 'ccs',
    power_kw: 50,
    price_per_hour_usd: 1.5,
    min_reservation_minutes: 30,
    photos: [],
    rules: null,
    schedule: DAY_24_7,
    status: 'paused',
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: 'b1c2d3e4-0003-4000-8000-000000000003',
    owner_id: MOCK_OWNER_ID,
    title: 'Cargador Punta Carretas',
    description: 'A una cuadra del shopping.',
    address: 'José Ellauri 350, Punta Carretas',
    lat: -34.9235,
    lng: -56.1586,
    connector_type: 'tipo_2',
    power_kw: 22,
    price_per_hour_usd: 1.3,
    min_reservation_minutes: 60,
    photos: [],
    rules: 'Pedir llave al portero.',
    schedule: NINE_TO_NINE,
    status: 'active',
    created_at: NOW,
    updated_at: NOW,
  },
];
