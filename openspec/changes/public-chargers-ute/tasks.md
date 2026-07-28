# Tasks: UTE Public Charger Integration

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 370–430 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR (stacked commits) |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium

> Estimate is 370–430 changed lines (11 files: 4 new, 7 modified).
> Under 400-line budget in most scenarios. Single PR with 7 stacked commits
> keeps each commit independently compilable and reviewable.

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Feature flag + types | PR 1 | Foundation: no runtime change |
| 2 | UTE API client + hook | PR 1 | Standalone fetcher, gated by flag |
| 3 | useChargers merge | PR 1 | Core merge logic, flag-gated |
| 4 | Filter store + UI | PR 1 | Source filter wiring |
| 5 | Map + Popup + Markers | PR 1 | Rendering layer, depends on 1–3 |

## Phase 1: Foundation (Types + Feature Flag)

- [x] 1.1 Add `PUBLIC_CHARGERS: false` to `src/lib/features.ts` FEATURES object (~2 lines)
  - **Commit**: `feat(chargers): add PUBLIC_CHARGERS feature flag`

- [x] 1.2 Add `gb_t` to `ConnectorType`, add `ChargerSource`, `ConnectorInfo`, `MapCharger` interfaces, update `CONNECTOR_LABEL` in `src/features/chargers/types.ts` (~25 lines added)
  - **Commit**: `feat(chargers): add MapCharger type and gb_t connector`

## Phase 2: UTE Data Layer

- [x] 2.1 Create `src/features/chargers/ute/fetchUTEChargers.ts` — raw response types, `normalizeUTESation()`, `fetchUTEChargers()`, null-coord exclusion, console.warn on shape changes (~90 lines)
  - **Commit**: `feat(chargers): add UTE API client and normalizer`

- [x] 2.2 Create `src/features/chargers/hooks/useUTEChargers.ts` — `useQuery` wrapper, `enabled: isFeatureEnabled('PUBLIC_CHARGERS')`, `staleTime: 30_000`, `placeholderData: keepPreviousData`, error returns `[]` (~25 lines)
  - **Commit**: `feat(chargers): add useUTEChargers hook`

- [x] 2.3 Modify `src/features/chargers/hooks/useChargers.ts` — extract Supabase logic, import both hooks, merge in `useMemo`, add `fuente` source filter, connector/power filters iterate `connectors[]`, return `MapCharger[]` (~55 lines changed)
  - **Commit**: `feat(chargers): merge UTE + P2P in useChargers hook`

## Phase 3: Filter Store + UI

- [x] 3.1 Add `SourceFilter` type, `source` field to `MapFilters`, `'fuente'` to `FilterCategory`, update `EMPTY` and `hasActiveFilters` in `src/stores/filterStore.ts` (~15 lines added)
  - **Commit**: `feat(filters): add source filter field to store`

- [x] 3.2 Add `FUENTE_OPTIONS` array, insert Fuente `FilterChipRow` section at top of `SECTIONS` when `PUBLIC_CHARGERS` is true in `src/components/organisms/FiltersSheet.tsx` (~25 lines added)
  - **Commit**: `feat(filters): add Fuente section to FiltersSheet`

## Phase 4: Map Rendering + Popup

- [x] 4.1 Update `SelectedCharger` interface, `chargersToGeoJSON()`, and `handleSourcePress()` in `app/(tabs)/map.tsx` to accept `MapCharger[]`, add `source`/`connectors`/`stationStatus` to GeoJSON properties and selected state (~45 lines changed)
  - **Commit**: `feat(map): support MapCharger type in map page`

- [x] 4.2 Add `source`, `connectors`, `stationStatus` props to `ChargerPopupProps`, render UTE branch (connector list, "UTE" badge, no price/Ver) and preserve P2P branch in `src/components/organisms/ChargerPopup.tsx` (~55 lines added/changed)
  - **Commit**: `feat(map): add UTE popup branch to ChargerPopup`

- [x] 4.3 Register `ute-marker` in `MapboxGL.Images`, add `ute-pin` SymbolLayer filtering `['==', 'source', 'ute']`, update existing `charger-pin` to filter `['==', 'source', 'enchufate']`, add placeholder blue marker asset at `assets/icons/ute-marker.png` in `src/components/organisms/MapContent.tsx` (~30 lines changed)
  - **Commit**: `feat(map): add UTE blue marker layer and asset`

## Phase 5: Verify

- [x] 5.1 Run `pnpm typecheck` — zero errors expected. Fix any type mismatches from `MapCharger` shape vs existing `Charger` usage.
  - **Commit**: `fix(chargers): typecheck fixes for MapCharger integration` (if needed)

---

**Estimated totals**: ~370 changed lines across 11 files (4 new, 7 modified). 7 stacked commits in single PR. Each commit is independently compilable — flag is `false` at every intermediate state.
