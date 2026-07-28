# Design: Edit Charger

## Technical Approach

Single-screen edit form with local React state, fetching the charger via `useCharger(id)`. A new `useUpdateCharger` mutation handles field updates + photo storage operations (delete removed, upload new) in sequence. The `chargerSchema` is reused for validation with server-managed fields omitted. No Zustand — the edit flow is stateless relative to the wizard.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| State management | Local `useState` per field | Zustand store, form library | Edit is a single screen with no draft persistence; local state is simpler and matches the project's no-additional-deps philosophy |
| Validation timing | On save only | On blur + on save | Matches publish wizard pattern (`validateStepN` on CTA); avoids noisy inline errors during editing |
| Photo strategy | Track `original[]`, `newUris[]`, `removed[]` — compute diff on save | Optimistic upload per add/delete | Batched ops are idempotent and avoid orphaned storage objects on partial failure |
| Schema reuse | `chargerSchema.omit({id, owner_id, status, created_at, updated_at}).parse(payload)` | Partial schema | Full field validation in one parse call; omit server-managed fields only |
| Navigation | `router.push('/edit-charger/[id]')` | Modal or sheet | Consistent with `publish/` pattern; Expo Router auto-discovers the file |

## Data Flow

```
ChargerDetailScreen ──push──→ EditChargerScreen
                                    │
                              useCharger(id) ──→ ChargerWithHost
                                    │
                              local useState per field
                                    │
                              "Guardar" tap
                                    │
                         chargerSchema.omit(...).parse(payload)
                                    │ (valid)
                         useUpdateCharger({ id, payload, photoOps })
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              deleteFromStorage  uploadNewPhotos  supabase.update()
                    │               │               │
                    └───────────────┴──────→ invalidateQueries
                                                    │
                                              router.back()
```

## Photo State Model

```ts
interface PhotoState {
  /** URLs from the fetched charger — kept on save (unchanged). */
  retained: string[];
  /** Local URIs from expo-image-picker — uploaded on save. */
  added: string[];
  /** URLs to remove from Storage on save. */
  removed: string[];
}
```

The final `photos[]` array sent to `supabase.update()` is: `[...retained, ...uploadedUrls]`. The mutation flow:
1. Delete `removed` URLs from Storage (extract path from public URL)
2. Upload each `added` URI → collect new public URLs
3. Update the charger row with `[...retained, ...newUrls]`

## useUpdateCharger Hook

```ts
// src/features/chargers/hooks/useUpdateCharger.ts
interface UpdateChargerArgs {
  chargerId: string;
  payload: { title; description; address; lat; lng; connector_type;
             power_kw; price_per_hour_usd; min_reservation_minutes;
             rules; schedule };
  photoOps: {
    delete: string[];   // public URLs to remove from Storage
    add: string[];      // local file URIs to upload
  };
}

interface UseUpdateChargerResult {
  update: (args: UpdateChargerArgs) => Promise<void>;
  isPending: boolean;
  error: AppError | null;
  reset: () => void;
}
```

Mutation body:
1. Feature flag guard: `isFeatureEnabled('EDIT_CHARGER')`
2. Auth check: `useSession()` — throw `AppError` with `isAuthError: true` if no user
3. Ownership check: verify `user.id === charger.owner_id` via a lightweight select
4. Zod validation: `chargerSchema.omit({id, owner_id, status, created_at, updated_at}).parse(payload)`
5. Photo deletions: for each URL in `photoOps.delete`, extract path after `charger-photos/` and call `storage.from('charger-photos').remove([path])`
6. Photo uploads: for each URI in `photoOps.add`, fetch as ArrayBuffer, upload to `{ownerId}/{chargerId}/{index}.jpg` where index is `retainedCount + i`
7. DB update: `supabase.from('chargers').update({ ...payload, photos: [...retained, ...newUrls] }).eq('id', chargerId)`
8. Query invalidation: `['charger', id]`, `['chargers']`, `['my-chargers', userId]`

Storage path extraction: parse the public URL, split on `charger-photos/`, take the suffix. This matches the `{ownerId}/{chargerId}/{index}.jpg` convention from `usePublishCharger`.

## Edit Screen Layout

`app/edit-charger/[id].tsx` — scrollable form with 7 field groups:

1. **Header**: Back button + "Editar cargador" title
2. **Info**: Title (`Input`, 80 char limit), Description (`Input`, 500 char counter)
3. **Location**: Address (`Input`), Lat/Lng display-only (read from fetched data, not editable)
4. **Connector**: Type (`Chip` group, 5 options), Power kW (`Input`, decimal-pad)
5. **Photos**: 2-column grid (reuse layout from `publish/4-photos.tsx`), existing thumbnails with X delete button, "+ Agregar" tile, counter "N de 5"
6. **Pricing**: Price/hour USD (`Input` with USD adornment), Min reservation (`Chip` group, 5 options)
7. **Schedule**: 7 day rows with Disponible / Personalizar / No disponible chips + custom HH:MM inputs (reuse layout from `publish/6-schedule.tsx`)
8. **Rules**: Rules (`Input`, 300 char counter, optional)
9. **Sticky CTA**: "Guardar" `Button` — disabled while `isPending`, shows loading spinner

State initialization: on `useCharger(id)` success, set each `useState` from the fetched charger fields. Guard: if `session.user.id !== c.owner_id`, show `<ErrorState>` and redirect.

## Entry Points

### Charger Detail (`app/charger/[id].tsx`)

- Already hides Reservar for owners (line 329: `session?.user?.id !== c.owner_id`)
- Add "Editar" `Button` in the CTA bar when owner, replacing the Reservar CTA
- Gate: `isFeatureEnabled('EDIT_CHARGER') && session?.user?.id === c.owner_id`
- On press: `router.push('/edit-charger/' + chargerId)`

### Profile (`app/(tabs)/profile.tsx`)

- The `⋯` button (line 243) is currently `disabled` with `onPress={() => undefined}`
- Remove `disabled`, gate `onPress` behind `isFeatureEnabled('EDIT_CHARGER')`
- On press: `router.push('/edit-charger/' + c.id)`

## Edge Cases

| Case | Handling |
|------|----------|
| Network failure on save | `normalizeSupabaseError` surfaces `error.userMessage`; user stays on form, can retry |
| Partial photo upload failure | Upload runs sequentially; if upload N fails, delete already-uploaded 1..N-1 from Storage (rollback), throw `AppError` |
| Concurrent edit (host edits while guest views detail) | TanStack Query invalidation on save; guest's stale data refreshes on next `useCharger` refetch (5 min staleTime) |
| Validation errors on save | Zod parse throws → `AppError` with `code: 'validation'` → form stays open with error hint |
| Charger deleted by another session | `supabase.update()` returns no rows → `AppError` with `code: 'not_found'` → navigate back |
| Zero photos after edits | `chargerSchema` allows `photos: []` (array with `.max(5)` but no `.min(1)`) — valid state |

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `app/edit-charger/[id].tsx` | Create | Edit form screen — scrollable field groups, photo grid, sticky Guardar CTA |
| `src/features/chargers/hooks/useUpdateCharger.ts` | Create | Mutation hook — validation, photo ops, DB update, query invalidation |
| `app/charger/[id].tsx` | Modify | Add owner-gated "Editar" button in CTA bar (replaces Reservar for owner) |
| `app/(tabs)/profile.tsx` | Modify | Enable `⋯` button to navigate to `/edit-charger/[id]` |
| `src/lib/features.ts` | Modify | Flip `EDIT_CHARGER` from `false` to `true` |

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `useUpdateCharger` mutation logic | Mock `supabase.from().update()`, `storage.from().remove()`, `storage.from().upload()` — verify correct paths, payload shape, query invalidation |
| Unit | Photo state diff computation | Pure function: given retained/added/removed, verify final `photos[]` array |
| Integration | Edit screen field pre-fill | Render with mocked `useCharger` data, assert each `Input`/`Chip` reflects fetched values |
| Integration | Owner guard | Render with mismatched `session.user.id` vs `owner_id`, assert `ErrorState` renders |
| E2E | Full edit flow | Navigate from detail → edit → change title → save → verify detail shows updated title |

## Migration / Rollout

No migration required. Flip `EDIT_CHARGER` to `true` in `features.ts`. Rollback: flip to `false` — all edit entry points are gated by `isFeatureEnabled`.

## Open Questions

- None — all dependencies exist (RLS policies, storage policies, schema, query keys).
