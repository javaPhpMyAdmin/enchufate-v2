# Proposal: UTE Public Charger Integration

## Intent

The map currently only shows P2P chargers from Supabase. UTE (Uruguay's state power utility) operates 207 public EV charging stations with live status — integrating them dramatically increases charger density and utility for guests who need fast public charging. This change merges UTE data into the existing map view as a distinct visual layer.

## Scope

### In Scope

- `MapCharger` normalized type with `source: 'enchufate' | 'ute'` field
- `GB/T` added to `ConnectorType` enum (required by UTE's connector mix)
- `useChargers` becomes a merging hook: parallel Supabase + UTE fetch, returns `MapCharger[]`
- UTE API fetcher (`fetchUTEChargers`) with 30s staleTime for status, separate from location data
- Dual-color pin rendering: orange (`cargador.png`) for P2P, blue marker for UTE
- `ChargerPopup` handles UTE chargers: shows connector list (type, power, count, status) without price/owner/navigation
- `PUBLIC_CHARGERS` feature flag in `src/lib/features.ts`
- `source` filter chip in Filtros bottom sheet (Todos / Enchufate / UTE)
- Graceful degradation: UTE fetch failure → show P2P only, no crash

### Out of Scope

- UTE charger detail screen (no navigation — popup only)
- Reservation flow for UTE chargers (no booking)
- Price display for UTE (they don't publish per-session pricing in the API)
- Background polling / push notifications for UTE status changes
- Admin dashboard or UTE data moderation
- Offline caching of UTE data

## Capabilities

### New Capabilities

- `public-chargers-ute`: Integrates UTE public charger data into the map view — fetching, normalizing, rendering, filtering, and popup display for UTE stations alongside P2P chargers.

### Modified Capabilities

- `map`: Map spec gains dual-source rendering (blue UTE pins vs orange P2P pins), source filter in Filtros sheet, and popup behavior that distinguishes UTE (connector list) from P2P (full card).

## Approach

**Hybrid normalized display type.** Introduce a `MapCharger` type that normalizes both Supabase `Charger` records and UTE API stations into a single shape the map renders. `useChargers` orchestrates two parallel queries (Supabase via TanStack Query, UTE via a dedicated `fetchUTEChargers` function), merges results, and applies filters uniformly.

UTE data flows: `fetchUTEChargers` → normalize to `MapCharger[]` → merge with Supabase results → filter by source/connector/power → render with source-aware GeoJSON.

Pin differentiation: MapLibre `ShapeSource` carries a `source` property in GeoJSON features. Two `SymbolLayer` instances render different images based on `source`. Clustering continues to work across both sources.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/features/chargers/types.ts` | Modified | Add `MapCharger`, `UTESource`, expand `ConnectorType` with `gb_t` |
| `src/features/chargers/hooks/useChargers.ts` | Modified | Parallel UTE fetch, merge logic, source filtering |
| `src/features/chargers/ute/fetchUTEChargers.ts` | New | UTE API client, normalization, error handling |
| `app/(tabs)/map.tsx` | Modified | Pass `MapCharger[]` instead of `Charger[]` to GeoJSON converter |
| `src/components/organisms/MapContent.tsx` | Modified | Add UTE SymbolLayer with blue marker asset |
| `src/components/organisms/ChargerPopup.tsx` | Modified | Branch on source: UTE → connector list, P2P → existing card |
| `src/stores/filterStore.ts` | Modified | Add `source` filter field |
| `src/lib/features.ts` | Modified | Add `PUBLIC_CHARGERS` flag |
| `assets/` | New | Blue UTE marker PNG asset |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| UTE endpoint has no SLA — may be slow or down | Med | `fetchUTEChargers` catches errors silently; hook returns P2P data only on failure |
| UTE API changes response shape without notice | Low | Normalize in a single function; add defensive null checks; log warnings |
| GB/T connector type has no real P2P users yet | None | New enum value is additive; no migration needed |
| 207 UTE stations increase map density significantly | Low | Native clustering already handles arbitrary pin counts |
| UTE status is live but we poll on 30s staleTime | Low | 30s is acceptable for "is it available" UX; no real-time requirement stated |

## Rollback Plan

1. Flip `PUBLIC_CHARGERS` feature flag to `false` — UTE data fetches stop, blue pins disappear, source filter hidden.
2. `useChargers` reverts to Supabase-only behavior (the merging is gated behind the flag).
3. No database migration involved — zero schema rollback needed.
4. Feature flag change is a single-line commit, deployable in minutes.

## Dependencies

- UTE public API at `https://movilidad.ute.com.uy/api/v1/station/status/map` — external, unauthenticated (requires `uniqueKeyUser: nginx` header)
- No new npm packages required

## Success Criteria

- [ ] Map shows both P2P (orange) and UTE (blue) pins simultaneously
- [ ] Tapping a UTE pin shows popup with connector list (type, power, count, status detail)
- [ ] Tapping a P2P pin shows existing charger card with price, owner, navigation
- [ ] Source filter in Filtros sheet toggles between Todos / Enchufate / UTE
- [ ] UTE API failure degrades gracefully — map shows P2P chargers only, no crash
- [ ] `PUBLIC_CHARGERS: false` completely disables UTE integration
- [ ] `pnpm typecheck` passes with zero errors
- [ ] Bundle size increase < 5KB (UTE fetcher is lightweight, one new asset)
