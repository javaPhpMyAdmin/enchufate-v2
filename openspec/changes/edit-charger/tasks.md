# Tasks: Edit Charger

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 420–470 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Feature flag + mutation hook | PR 1 | ~120 lines; foundation, no UI dependency |
| 2 | Edit screen (full form + photo mgmt) | PR 2 | ~300 lines; depends on PR 1 hook |
| 3 | Entry points (detail + profile) | PR 3 | ~30 lines; depends on PR 2 route existing |

## Phase 1: Foundation

- [x] 1.1 Flip `EDIT_CHARGER` to `true` in `src/lib/features.ts` — single line change
- [x] 1.2 Create `src/features/chargers/hooks/useUpdateCharger.ts` — mutation hook following `usePublishCharger` pattern: feature flag guard, auth check, ownership verify, `chargerSchema.omit(...).parse()`, sequential photo delete/upload via Supabase Storage, `supabase.from('chargers').update()`, query invalidation (`['charger', id]`, `['chargers']`, `['my-chargers', userId]`)

## Phase 2: Edit Screen

- [x] 2.1 Create `app/edit-charger/[id].tsx` — route file with header ("Editar cargador" + back button), `useCharger(id)` fetch, owner guard (`session.user.id !== c.owner_id` → `ErrorState`), loading/error skeletons, local `useState` per editable field initialized from fetched data
- [x] 2.2 Add field groups to edit screen — Info (title 80-char, description 500-char counter), Location (address + read-only lat/lng), Connector (Chip group 5 options + power kW decimal-pad input), Pricing (price/hour USD + min reservation Chip group), Schedule (7-day rows reusing `publish/6-schedule.tsx` layout), Rules (300-char counter, optional)
- [x] 2.3 Add photo management to edit screen — 2-column grid with existing thumbnails + X delete button, "+ Agregar" tile via `expo-image-picker`, "N de 5" counter, `PhotoState` tracking retained/added/removed, hide add when count = 5
- [x] 2.4 Add sticky "Guardar" CTA — disabled while `isPending`, on tap: run `chargerSchema.omit({id, owner_id, status, created_at, updated_at}).parse(payload)`, call `useUpdateCharger` with field payload + photo ops, `router.back()` on success, show `error.userMessage` on failure

## Phase 3: Entry Points

- [ ] 3.1 Modify `app/charger/[id].tsx` — add owner-gated "Editar" `Button` in CTA bar (line ~329), replacing the hidden Reservar for owners; gate: `isFeatureEnabled('EDIT_CHARGER') && session?.user?.id === c.owner_id`; on press: `router.push('/edit-charger/' + chargerId)`
- [ ] 3.2 Modify `app/(tabs)/profile.tsx` — remove `disabled` from the `⋯` button (line ~247), gate `onPress` behind `isFeatureEnabled('EDIT_CHARGER')`, navigate to `/edit-charger/{c.id}`; update `accessibilityLabel` to "Editar cargador"

## Phase 4: Verification

- [ ] 4.1 Run `pnpm typecheck` — zero errors; run `pnpm expo export --platform ios` — succeeds
- [ ] 4.2 Smoke-test checklist: owner sees Editar on detail, non-owner does not; profile ⋯ navigates to edit; form pre-fills; validation blocks invalid save; save invalidates queries and navigates back
