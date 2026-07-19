/**
 * Mock hosts — profile metadata for the 15 charger owners in
 * `mockChargers.ts`.
 *
 * The real-world `useCharger` hook will join `public.chargers` to
 * `public.profiles` (1:1 on `owner_id`) to surface the host's
 * display name, avatar, and member-since date on the detail
 * screen. Until the real Supabase project + RLS are ready, this
 * file provides the same fields for the mock chargers so the
 * screen can be exercised end-to-end with the Phase 4 fixture.
 *
 * The dates are picked to span 2023–2025 so the "Miembro desde
 * {month} de {year}" copy exercises the long-month formatter.
 * The first host (charger #1, Pocitos) is dated March 2024 to
 * land the spec scenario "Miembro desde marzo de 2024" exactly.
 */
export interface MockHost {
  /** Matches `public.profiles.id` and `chargers.owner_id`. */
  id: string;
  displayName: string;
  avatarUrl: string | null;
  /** ISO 8601 — `created_at` of the host's `profiles` row. */
  createdAt: string;
}

export const MOCK_HOSTS: Record<string, MockHost> = {
  '00000000-0000-0000-0000-000000000001': {
    id: '00000000-0000-0000-0000-000000000001',
    displayName: 'María González',
    avatarUrl: null,
    // Picked for the spec scenario "Miembro desde marzo de 2024".
    createdAt: '2024-03-15T12:00:00Z',
  },
  '00000000-0000-0000-0000-000000000002': {
    id: '00000000-0000-0000-0000-000000000002',
    displayName: 'Lucía Fernández',
    avatarUrl: null,
    createdAt: '2023-05-22T09:30:00Z',
  },
  '00000000-0000-0000-0000-000000000003': {
    id: '00000000-0000-0000-0000-000000000003',
    displayName: 'Diego Pérez',
    avatarUrl: null,
    createdAt: '2024-08-10T18:00:00Z',
  },
  '00000000-0000-0000-0000-000000000004': {
    id: '00000000-0000-0000-0000-000000000004',
    displayName: 'Carlos Rodríguez',
    avatarUrl: null,
    createdAt: '2024-01-04T11:15:00Z',
  },
  '00000000-0000-0000-0000-000000000005': {
    id: '00000000-0000-0000-0000-000000000005',
    displayName: 'Ana Martínez',
    avatarUrl: null,
    createdAt: '2023-11-30T14:45:00Z',
  },
  '00000000-0000-0000-0000-000000000006': {
    id: '00000000-0000-0000-0000-000000000006',
    displayName: 'Sebastián López',
    avatarUrl: null,
    createdAt: '2024-06-19T08:20:00Z',
  },
  '00000000-0000-0000-0000-000000000007': {
    id: '00000000-0000-0000-0000-000000000007',
    displayName: 'Florencia Silva',
    avatarUrl: null,
    createdAt: '2025-02-08T16:00:00Z',
  },
  '00000000-0000-0000-0000-000000000008': {
    id: '00000000-0000-0000-0000-000000000008',
    displayName: 'Martín Suárez',
    avatarUrl: null,
    createdAt: '2023-09-12T10:30:00Z',
  },
  '00000000-0000-0000-0000-000000000009': {
    id: '00000000-0000-0000-0000-000000000009',
    displayName: 'Valentina Rodríguez',
    avatarUrl: null,
    createdAt: '2024-04-25T13:00:00Z',
  },
  '00000000-0000-0000-0000-000000000010': {
    id: '00000000-0000-0000-0000-000000000010',
    displayName: 'Joaquín Méndez',
    avatarUrl: null,
    createdAt: '2024-10-03T17:30:00Z',
  },
  '00000000-0000-0000-0000-000000000011': {
    id: '00000000-0000-0000-0000-000000000011',
    displayName: 'Camila Castro',
    avatarUrl: null,
    createdAt: '2023-07-14T11:00:00Z',
  },
  '00000000-0000-0000-0000-000000000012': {
    id: '00000000-0000-0000-0000-000000000012',
    displayName: 'Andrés Núñez',
    avatarUrl: null,
    createdAt: '2024-12-01T09:00:00Z',
  },
  '00000000-0000-0000-0000-000000000013': {
    id: '00000000-0000-0000-0000-000000000013',
    displayName: 'Sofía Romero',
    avatarUrl: null,
    createdAt: '2024-02-18T15:30:00Z',
  },
  '00000000-0000-0000-0000-000000000014': {
    id: '00000000-0000-0000-0000-000000000014',
    displayName: 'Federico Acosta',
    avatarUrl: null,
    createdAt: '2023-12-05T12:00:00Z',
  },
  '00000000-0000-0000-0000-000000000015': {
    id: '00000000-0000-0000-0000-000000000015',
    displayName: 'Lucía Pereira',
    avatarUrl: null,
    createdAt: '2025-01-22T10:00:00Z',
  },
};
