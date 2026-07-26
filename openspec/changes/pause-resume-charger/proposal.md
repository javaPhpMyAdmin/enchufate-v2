# Proposal: Pause / Resume Charger

## Intent

Hosts need to temporarily hide chargers from the marketplace without deleting them — for holidays, maintenance, or seasonal availability. The DB layer (`charger_status` enum with `active | paused`) and RLS policies already support this, but there is no UI or mutation to toggle the status.

## Scope

### In Scope

- `useToggleChargerStatus(chargerId)` mutation hook — checks for `confirmada` reservations, then toggles `status` between `active` and `paused`
- Pause/resume button on charger detail screen (owner view) and profile "Mis cargadores" list
- StatusPill: add `paused` variant (amber surface, amber text, amber dot, label "Pausado") to the type union and MAP
- StatusPill: fix `charger/[id].tsx` mapping — currently maps `paused` to `cancelada` (wrong); use new `paused` variant instead
- Two new color tokens in `src/theme/colors.ts`: `warning` and `warningSurface`
- Guard: block pause if any reservation has `status = 'confirmada'` for that charger; show inline alert
- Cache invalidation: invalidate `chargers` query keys on success (charger detail + my-chargers list)

### Out of Scope

- Bulk pause/resume (select multiple chargers)
- Scheduled pause (auto-resume at a future date)
- Status history / audit log
- Notifications to affected guests when a charger is paused

## Capabilities

### New Capabilities

- `charger-status-toggle`: Pause/resume mutation with reservation guard, button placement on charger detail and profile

### Modified Capabilities

- `charger-detail`: Owner view gains a pause/resume toggle button; StatusPill displays `paused` correctly

## Approach

1. Add `warning` + `warningSurface` color tokens to `src/theme/colors.ts`
2. Add `'paused'` variant to `StatusPillKind` union and `MAP` in `src/components/atoms/StatusPill.tsx`
3. Create `src/features/chargers/hooks/useToggleChargerStatus.ts` — queries `reservations` table for `confirmada` rows before updating
4. Add pause/resume button to `app/charger/[id].tsx` (owner-only, conditionally rendered)
5. Fix status mapping in `app/charger/[id].tsx` line 265: replace `c.status === 'active' ? 'disponible' : 'cancelada'` with proper mapping
6. Invalidate `['chargers']` and `['charger', id]` query keys on mutation success

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/theme/colors.ts` | Modified | Add `warning` and `warningSurface` tokens |
| `src/components/atoms/StatusPill.tsx` | Modified | Add `paused` variant to union + MAP |
| `app/charger/[id].tsx` | Modified | Fix status mapping, add owner toggle button |
| `src/features/chargers/hooks/useToggleChargerStatus.ts` | New | Mutation hook with reservation guard |
| `src/components/molecules/ChargerCard.tsx` | No change | Already passes `StatusPillKind` — gets `paused` for free |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Race condition: reservation confirmed between guard check and toggle | Low | Use a single Supabase RPC or transaction if this becomes a problem; MVP accepts the small window |
| User pauses charger with future (solicitada) reservations | Low | Inform user; solicitada reservations are requests, not commitments — acceptable to let them exist |
| StatusPill type change breaks other consumers | Low | Union widening is backward-compatible; all existing consumers pass valid subtypes |

## Rollback Plan

- Revert the feature branch commit(s). No DB migration to roll back. The `paused` enum value and RLS policies remain (they are harmless without UI).
- Color tokens and StatusPill variant are additive — reverting removes them cleanly.

## Dependencies

- None. DB enum and RLS already support `paused`.

## Success Criteria

- [ ] Host can pause an active charger and it disappears from the public map
- [ ] Host can resume a paused charger and it reappears on the map
- [ ] Pause is blocked when `confirmada` reservations exist, with clear user feedback
- [ ] StatusPill shows "Pausado" in amber for paused chargers
- [ ] `pnpm typecheck` passes with zero errors
