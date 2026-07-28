# Design: Pause / Resume Charger

## Technical Approach

Toggle a charger's `status` between `active` and `paused` via a TanStack Query mutation hook that checks for confirmed reservations before the DB update. Add a `paused` variant to `StatusPill` and wire pause/resume buttons into the charger detail (owner view) and profile "Mis cargadores" list. All queries that display charger status are invalidated on success.

## Architecture Decisions

### Decision: Reservation guard in the hook (client-side pre-check)

| Option | Tradeoff |
|--------|----------|
| RPC / DB function | Atomic but adds server-side complexity for a simple query |
| Client-side select + guard | Adds a round-trip, but mirrors existing pattern (`useUpdateCharger` does ownership verify via select). Acceptable at MVP scale. |

**Choice**: Client-side select. Query `reservations` for `charger_id = X AND status = 'confirmada'` before the update. If rows exist → throw `AppError({ code: 'active_reservations' })`. MVP accepts the small race window; document as future RPC candidate.

### Decision: Feature flag

**Choice**: No new feature flag. The DB enum `active | paused` and RLS policies already exist. The toggle is an incremental UI feature gated by auth + ownership only. Adding a flag would require every consumer to guard twice — not worth it for a feature that has zero destructive side effects.

### Decision: StatusPill variant mapping in `charger/[id].tsx`

**Choice**: Replace the broken `c.status === 'active' ? 'disponible' : 'cancelada'` mapping (line 265) with `c.status === 'active' ? 'disponible' : 'paused'`. The `paused` variant is new; the old fallback to `cancelada` was incorrect.

## Data Flow

```
Profile / ChargerDetail
  │
  ▼
useToggleChargerStatus(chargerId)
  │
  ├─ 1. isFeatureEnabled check (RESERVATIONS — owns the status enum)
  ├─ 2. useSession() → auth guard
  ├─ 3. supabase.from('chargers').select('owner_id, status') → ownership + current status
  ├─ 4. supabase.from('reservations').select('id', { count: 'exact', head: true })
  │      .eq('charger_id', id).eq('status', 'confirmada')
  │      → block if count > 0
  ├─ 5. supabase.from('chargers').update({ status: newStatus }).eq('id', id)
  │
  └─ 6. queryClient.invalidateQueries(['charger', id])
         queryClient.invalidateQueries(['chargers'])
         queryClient.invalidateQueries(['my-chargers', userId])
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/theme/colors.ts` | Modify | Add `warning: '#F59E0B'` and `warningSurface: '#FEF3C7'` tokens |
| `src/components/atoms/StatusPill.tsx` | Modify | Add `'paused'` to `StatusPillKind` union + `MAP` entry (amber surface/fg/dot, label "Pausado") |
| `src/features/chargers/hooks/useToggleChargerStatus.ts` | Create | Mutation hook: reservation guard, Supabase update, query invalidation |
| `app/charger/[id].tsx` | Modify | Fix status mapping (line 265); add owner pause/resume button below sticky CTA area; show inline error on blocked pause |
| `app/(tabs)/profile.tsx` | Modify | Fix status mapping (line 252); add per-charger "Pausar"/"Reactivar" button next to each `ChargerCard` in "Mis cargadores" |

## Interfaces / Contracts

```typescript
// useToggleChargerStatus.ts — public API
export interface UseToggleChargerStatusResult {
  toggle: (args: { chargerId: string; currentStatus: ChargerStatus }) => Promise<void>;
  isPending: boolean;
  error: AppError | null;
  reset: () => void;
}
```

The `toggle` function accepts `currentStatus` so the caller does not need to read the query cache. The hook computes `newStatus = currentStatus === 'active' ? 'paused' : 'active'`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | StatusPill renders "Pausado" for `paused` kind; `useToggleChargerStatus` throws `active_reservations` when confirmada rows exist | Mock Supabase client; test hook via `renderHook` |
| Integration | Charger detail owner sees "Pausar" button; tapping toggles status and query refreshes | Component test with mocked `useCharger` + `useToggleChargerStatus` |
| Manual | `pnpm typecheck` passes; pause/resume flow end-to-end on Expo dev | Manual QA |

## Migration / Rollout

No DB migration required. The `charger_status` enum (`active | paused`) and RLS policies are already in place from the initial schema. This change is purely UI + mutation logic.

## Open Questions

- None. All decisions are constrained by existing DB schema and codebase patterns.
