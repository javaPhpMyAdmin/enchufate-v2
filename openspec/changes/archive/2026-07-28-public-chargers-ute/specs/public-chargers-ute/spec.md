# Public Chargers UTE Specification

## Purpose

Integrates UTE public EV charging stations into the map — fetching, normalizing, rendering, filtering, and popup display alongside P2P chargers.

## Requirements

| # | Requirement | Strength | Key Behavior |
|---|------------|----------|--------------|
| 1 | Public Charger Types | SHALL | `MapCharger` type with `source: 'enchufate' \| 'ute'`, `connectors[]`; `ConnectorType` extended with `'gb_t'` |
| 2 | UTE API Fetcher | SHALL | `fetchUTEChargers()` → `GET .../station/status/map` w/ `uniqueKeyUser: nginx` header; normalizes to `MapCharger[]`; 30s staleTime via caller |
| 3 | Merging Hook | SHALL | `useChargers()` parallel-fetches Supabase + UTE, merges to `MapCharger[]`, applies all filters uniformly |
| 4 | Dual-Source Pins | SHALL | Blue marker for UTE, orange `cargador.png` for P2P; GeoJSON `properties.source` drives two `SymbolLayer` instances |
| 5 | Mixed-Source Clustering | SHALL | Both sources cluster together (radius 50px, uncluster at zoom 14) |
| 6 | ChargerPopup — UTE | SHALL | UTE popup: name, address, connector list, "UTE" badge; no price/owner/Ver |
| 7 | Source Filter | SHALL | "Fuente" chip group: Todos/Enchúfate/UTE; stored in Zustand; visible when `PUBLIC_CHARGERS` is `true` |
| 8 | Feature Flag | SHALL | `PUBLIC_CHARGERS: false` in features.ts; gates UTE fetch, pins, and filter |

## Scenarios

### R1: Types

- **MapCharger source discriminant**: GIVEN UTE API data → WHEN normalized → THEN `source: 'ute'` on each entry
- **gb_t connector**: GIVEN UTE station with GB/T → WHEN normalized → THEN type is `'gb_t'`, label "GB/T"

### R2: UTE Fetcher

- **Happy path**: GIVEN valid JSON from UTE API → WHEN `fetchUTEChargers()` resolves → THEN `MapCharger[]` with `source: 'ute'`, valid lat/lng/connectors
- **API error**: GIVEN 5xx or timeout → WHEN fetch rejects → THEN caught+logged; caller returns P2P-only
- **Missing coords**: GIVEN null lat/lng → WHEN normalizing → THEN station excluded, warning logged

### R3: Merging Hook

- **Both succeed**: GIVEN UTE + Supabase reachable → WHEN `useChargers(filters)` → THEN mixed `source: 'enchufate'` + `source: 'ute'` results
- **UTE fails**: GIVEN UTE unreachable → WHEN hook runs → THEN P2P-only, no crash
- **Source filter**: GIVEN `source: 'ute'` → WHEN hook runs → THEN only UTE chargers returned

### R4: Dual-Source Pins

- **Blue + orange coexist**: GIVEN both sources in view → WHEN zoom >= 14 → THEN UTE = blue markers, P2P = orange `cargador.png`

### R5: Clustering

- **Mixed cluster**: GIVEN 5 UTE + 3 P2P within 200m → WHEN zoom 12 → THEN bubble shows "8"; expanding reveals both colors

### R6: ChargerPopup

- **UTE popup**: GIVEN 2 CCS2 (60 kW) + 1 CHAdeMO (50 kW) → WHEN tap blue pin → THEN name, address, connector list, "UTE" badge, no price/Ver
- **P2P unchanged**: GIVEN `source: 'enchufate'` → WHEN tap orange pin → THEN existing popup (price, owner, Ver)

### R7: Source Filter

- **Default = Todos**: GIVEN no filter applied → WHEN Filtros opens → THEN "Todos" active, both sources shown
- **UTE filter**: GIVEN user selects "UTE" + Aplicar → WHEN committed → THEN only UTE visible

### R8: Feature Flag

- **Flag off**: GIVEN `PUBLIC_CHARGERS: false` → WHEN `useChargers()` runs → THEN no UTE fetch, P2P-only, filter hidden
- **Flag on**: GIVEN `PUBLIC_CHARGERS: true` → WHEN Mapa loads → THEN blue UTE pins render, filter visible

## Files Affected

| File | Impact |
|------|--------|
| `src/features/chargers/types.ts` | Modified — add `MapCharger`, `UTESource`, `gb_t` to `ConnectorType` |
| `src/features/chargers/ute/fetchUTEChargers.ts` | New — UTE API client + normalization |
| `src/features/chargers/hooks/useChargers.ts` | Modified — parallel fetch, merge, source filter |
| `src/components/organisms/MapContent.tsx` | Modified — blue UTE SymbolLayer, source-aware pins |
| `src/components/organisms/ChargerPopup.tsx` | Modified — branch on source for UTE vs P2P |
| `src/stores/filterStore.ts` | Modified — add `source` filter field |
| `src/lib/features.ts` | Modified — add `PUBLIC_CHARGERS` flag |
| `app/(tabs)/map.tsx` | Modified — pass `MapCharger[]` to GeoJSON converter |
| `assets/icons/` | New — blue UTE marker PNG |
