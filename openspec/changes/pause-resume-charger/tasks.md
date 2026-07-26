# Tasks: Pause / Resume Charger

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 150–200 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Full pause/resume feature | PR 1 | Tokens + StatusPill + hook + UI wiring. ~180 lines, under budget. |

## Phase 1: Design Tokens

- [x] 1.1 Add `warning: '#F59E0B'` and `warningSurface: '#FEF3C7'` to `src/theme/colors.ts` under the `color` export

## Phase 2: StatusPill Variant

- [x] 2.1 Add `'paused'` to the `StatusPillKind` union type in `src/components/atoms/StatusPill.tsx`
- [x] 2.2 Add `paused` entry to `MAP` — amber surface bg, amber fg text, amber dot, label `"Pausado"`

## Phase 3: Mutation Hook

- [x] 3.1 Create `src/features/chargers/hooks/useToggleChargerStatus.ts` — export `UseToggleChargerStatusResult` interface with `toggle`, `isPending`, `error`, `reset`
- [x] 3.2 Implement reservation guard: `supabase.from('reservations').select('id', { count: 'exact', head: true }).eq('charger_id', chargerId).eq('status', 'confirmada')` — if count > 0, throw `AppError({ code: 'active_reservations', userMessage: '...' })`
- [x] 3.3 Implement toggle: `supabase.from('chargers').update({ status: newStatus }).eq('id', chargerId)` where `newStatus = currentStatus === 'active' ? 'paused' : 'active'`
- [x] 3.4 On success invalidate queries: `['charger', chargerId]`, `['chargers']`, `['my-chargers', userId]`

## Phase 4: UI Wiring

- [x] 4.1 In `app/charger/[id].tsx`: fix status mapping at ~line 265 — replace `c.status === 'active' ? 'disponible' : 'cancelada'` with `c.status === 'active' ? 'disponible' : 'paused'`
- [x] 4.2 In `app/charger/[id].tsx`: add owner-only pause/resume button below sticky CTA area; show inline error alert when pause is blocked by active reservations
- [x] 4.3 In `app/(tabs)/profile.tsx`: fix status mapping at ~line 252 — same pattern as 4.1
- [x] 4.4 In `app/(tabs)/profile.tsx`: add per-charger "Pausar"/"Reactivar" button next to each `ChargerCard` in "Mis cargadores" list

## Phase 5: Verification

- [x] 5.1 Run `pnpm typecheck` — zero errors
- [ ] 5.2 Run `pnpm expo lint` — zero new warnings
- [ ] 5.3 Manual QA: pause active charger → disappears from map; resume → reappears; pause with confirmada reservation → blocked with alert
