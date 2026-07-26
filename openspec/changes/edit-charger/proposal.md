# Proposal: Edit Charger

## Intent

Hosts who published chargers currently have no way to update them — title, description, location, connector, pricing, schedule, rules, or photos. Any data correction requires deleting and re-publishing. This change adds an edit flow so hosts can maintain accurate charger listings without friction.

## Scope

### In Scope

- New edit screen (`app/edit-charger/[id].tsx`) — single-screen form with field groups, pre-filled from fetched charger data
- New mutation hook (`useUpdateCharger`) following existing `{ action, isPending, error, reset }` pattern
- Enable edit CTA on charger detail screen (`app/charger/[id].tsx`) — visible only to the charger owner
- Enable the `⋯` menu in profile screen's "Mis cargadores" list — navigates to the edit screen
- Flip `EDIT_CHARGER` feature flag to `true` in `src/lib/features.ts`
- Photo management: display existing photos as thumbnails, allow add/remove/replace within the edit screen

### Out of Scope

- Status change (pause/resume) — deferred to a dedicated change
- Delete charger — separate change
- Deep linking to edit from external sources
- Re-using the 7-step publish wizard — the wizard's Zustand store is designed for draft state, not editing persisted data

## Capabilities

### New Capabilities

- `charger-edit`: Single-screen edit form for existing chargers — fetches data, pre-fills fields, validates with shared Zod schemas, saves via Supabase update + photo operations

### Modified Capabilities

- `charger-detail`: Owner view adds an "Editar" CTA that navigates to the edit screen
- `profile`: The `⋯` menu next to owned chargers becomes functional, navigating to the edit screen

## Approach

1. **Edit screen** (`app/edit-charger/[id].tsx`): Fetches charger by ID via TanStack Query (`['charger', id]`). Renders a single scrollable form with field groups matching the charger model (identity, location, connector/power, photos, pricing/schedule, rules). Uses `chargerSchema` fields from `src/lib/schemas/charger.ts` for validation — same rules as publish, different UX.
2. **Mutation hook** (`src/features/chargers/hooks/useUpdateCharger.ts`): Wraps `supabase.from('charts').update()` + photo storage ops. On success, invalidates `['charger', id]`, `['chargers']`, `['my-chargers', userId]`.
3. **Photo handling**: Existing photos render as thumbnails with delete action. New photos added via `expo-image-picker`. Deletions trigger Supabase Storage removal; additions upload to the charger's storage path. Max 5 photos enforced.
4. **Entry points**: Owner sees "Editar" button on charger detail; `⋯` menu on profile's charger list navigates to `/edit-charger/[id]`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `app/edit-charger/[id].tsx` | New | Edit form screen |
| `src/features/chargers/hooks/useUpdateCharger.ts` | New | Mutation hook for charger updates |
| `app/charger/[id].tsx` | Modified | Add owner-gated "Editar" CTA |
| `app/(tabs)/profile.tsx` | Modified | Enable `⋯` menu to navigate to edit screen |
| `src/lib/features.ts` | Modified | Flip `EDIT_CHARGER` to `true` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Photo replacement UX complexity (delete + add in one save) | Medium | Show clear visual state; defer to phased upload on save |
| Concurrent edits (host edits while guest has detail open) | Low | TanStack Query invalidation + stale-while-revalidate covers most cases |
| Cache invalidation timing (stale data after save) | Low | Invalidate all relevant query keys on mutation success |

## Rollback Plan

1. Flip `EDIT_CHARGER` flag back to `false` — hides all entry points immediately
2. Remove `app/edit-charger/[id].tsx` and `useUpdateCharger.ts` — no data dependencies to clean up
3. Revert profile and detail screen changes if needed

## Dependencies

- Existing `chargerSchema` Zod validation from `src/lib/schemas/charger.ts` (reused, not modified)
- Existing Supabase RLS policy `chargers_update_own` (already allows owner updates)
- Existing storage policies (already allow photo replacement via path prefix)

## Success Criteria

- [ ] Host can open edit form from charger detail screen (owner only)
- [ ] Host can open edit form from profile `⋯` menu
- [ ] All fields pre-fill correctly from fetched charger data
- [ ] Validation prevents saving invalid data (same rules as publish)
- [ ] Photo add/delete/replace works within the 5-photo limit
- [ ] After save, charger detail and profile list reflect updated data
- [ ] Non-owners see no edit affordance
- [ ] `pnpm typecheck` and `pnpm expo export --platform ios` pass
