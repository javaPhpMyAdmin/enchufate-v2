# Design: UTE Public Charger Integration

## Technical Approach

Introduce a `MapCharger` discriminated union that normalizes both Supabase `Charger` records and UTE API stations into one shape. `useChargers` orchestrates two parallel TanStack Query hooks (one per source), merges via `useMemo`, and applies all filters uniformly. Two `SymbolLayer` instances render source-aware pins from a single `ShapeSource`. `ChargerPopup` branches on `source` to show either the existing P2P card or a UTE connector-list view.

## Architecture Decisions

| Decision | Options | Tradeoff | Choice |
|----------|---------|----------|--------|
| Hook structure | A: Single queryFn with `Promise.allSettled` / B: Two `useQuery` hooks merged in `useMemo` | A is simpler but couples cache lifecycles; B lets UTE (30s stale) and Supabase (30s stale) cache independently and fail independently | **B** — two hooks, merge in `useChargers` |
| GeoJSON strategy | A: Single ShapeSource with source property / B: Two ShapeSources (one per source) | A keeps clustering across both sources (per spec); B would split clusters | **A** — single ShapeSource, two SymbolLayers filtered on `properties.source` |
| ChargerPopup branching | A: Two components / B: Single component with source prop | A is cleaner but duplicates positioning logic; B keeps one positioning system | **B** — single `ChargerPopup` with `source` prop, render branch inside |
| UTE connector model | A: Flatten to single connector / B: Preserve `connectors[]` array | A loses multi-connector info; B shows real station capacity | **B** — `MapCharger.connectors[]` array, popup iterates it |

## Data Flow

```
useChargers(filters)
├── useSupabaseChargers(filters)          ← existing useQuery, enabled: true
│   └── supabase.from('chargers').select() → Charger[] → normalize to MapCharger[]
├── useUTEChargers()                       ← new useQuery, enabled: PUBLIC_CHARGERS
│   └── fetchUTEChargers() → MapCharger[]
└── useMemo: merge + apply filters
    ├── source filter (fuente)
    ├── connector filter (conector) — matches any connector in connectors[]
    ├── power filter (potencia) — matches max power across connectors
    ├── distance filter (distancia) — Haversine, same as today
    └── → MapCharger[]
         ↓
    chargersToGeoJSON() → FeatureCollection (adds properties.source)
         ↓
    MapContent → ShapeSource → [CircleLayer | SymbolLayer(UTE) | SymbolLayer(P2P)]
```

## Interfaces

```typescript
// src/features/chargers/types.ts
export type ConnectorType = 'tipo_1' | 'tipo_2' | 'ccs' | 'chademo' | 'tesla' | 'gb_t';
export type ChargerSource = 'enchufate' | 'ute';

export interface ConnectorInfo {
  type: ConnectorType;
  power_kw: number;
  count: number;
  status?: 'available' | 'occupied' | 'out_of_service';
}

export interface MapCharger {
  id: string;
  source: ChargerSource;
  title: string;
  address: string;
  city?: string;
  department?: string;
  lat: number;
  lng: number;
  connectors: ConnectorInfo[];
  // P2P-only fields (undefined for UTE)
  price_per_hour_usd?: number;
  currency?: Currency;
  status?: ChargerStatus;
  owner_id?: string;
  // Populated when source='ute' for connector-list display
  station_status?: 'operational' | 'limited' | 'offline';
}
```

## File Changes

| File | Action | Scope |
|------|--------|-------|
| `src/features/chargers/types.ts` | Modify | Add `gb_t` to `ConnectorType`, `ChargerSource`, `ConnectorInfo`, `MapCharger`; update `CONNECTOR_LABEL` |
| `src/features/chargers/ute/fetchUTEChargers.ts` | Create | UTE API client: raw response types, `normalizeUTESation()`, `fetchUTEChargers()`, defensive null checks, `console.warn` on shape changes |
| `src/features/chargers/hooks/useUTEChargers.ts` | Create | `useQuery` wrapper: `enabled: isFeatureEnabled('PUBLIC_CHARGERS')`, `staleTime: 30_000`, `placeholderData: keepPreviousData` |
| `src/features/chargers/hooks/useChargers.ts` | Modify | Import both hooks; merge in `useMemo`; add source filter logic; return `MapCharger[]`; connector/power filters iterate `connectors[]` |
| `app/(tabs)/map.tsx` | Modify | `chargersToGeoJSON` accepts `MapCharger[]`; adds `source`, `connectors` to GeoJSON properties; `SelectedCharger` gains `source`, `connectors`, `stationStatus`; `handleSourcePress` reads new props; `ChargerPopup` receives source-aware props |
| `src/components/organisms/MapContent.tsx` | Modify | Register `ute-marker` in `MapboxGL.Images`; add `ute-pin` SymbolLayer filtering `['==', 'source', 'ute']`; existing `charger-pin` filters `['==', 'source', 'enchufate']` |
| `src/components/organisms/ChargerPopup.tsx` | Modify | Add `source`, `connectors`, `stationStatus` props; UTE branch renders connector list + "UTE" badge, no price/Ver; P2P branch unchanged |
| `src/stores/filterStore.ts` | Modify | Add `SourceFilter` type, `source` to `MapFilters`, `'fuente'` to `FilterCategory` |
| `src/components/organisms/FiltersSheet.tsx` | Modify | Add `FUENTE_OPTIONS`; insert Fuente section at top when `PUBLIC_CHARGERS` is true |
| `src/lib/features.ts` | Modify | Add `PUBLIC_CHARGERS: false` |
| `assets/icons/ute-marker.png` | Create | Blue marker PNG (provided by design) |

## Hook Architecture — useChargers Merge

```typescript
export function useChargers(filters?: MapFilters): UseQueryResult<MapCharger[], Error> {
  const supabaseQuery = useSupabaseChargers(filters); // existing logic extracted
  const uteQuery = useUTEChargers();                   // enabled by feature flag

  const data = useMemo(() => {
    const p2p = (supabaseQuery.data ?? []).map(normalizeToMapCharger);
    const ute = uteQuery.data ?? [];
    let merged = [...p2p, ...ute];

    if (filters?.fuente === 'enchufate') merged = merged.filter(c => c.source === 'enchufate');
    if (filters?.fuente === 'ute') merged = merged.filter(c => c.source === 'ute');
    // connector/power/distance filters applied to connectors[] array
    return merged;
  }, [supabaseQuery.data, uteQuery.data, filters]);

  return {
    data,
    isLoading: supabaseQuery.isLoading,
    error: supabaseQuery.error ?? uteQuery.error,
    isPlaceholderData: supabaseQuery.isPlaceholderData || uteQuery.isPlaceholderData,
  } as UseQueryResult<MapCharger[], Error>;
}
```

## Popup Adaptation — UTE Branch

UTE popup renders: station name, address + city, connector list (each row: `{type} · {power} kW × {count} · {status}`), distance, "UTE" badge. No price, no "Ver" button, no OSRM route (popup only, no detail screen).

P2P popup: unchanged — existing card with price, owner, "Ver" button.

## Caching Strategy

| Source | staleTime | placeholderData | Error handling |
|--------|-----------|-----------------|----------------|
| Supabase (P2P) | 30s | `keepPreviousData` | Throws → `ErrorState` (existing) |
| UTE | 30s | `keepPreviousData` | Caught + logged → returns `[]`, P2P-only |

## Feature Flag Gating

```typescript
// src/lib/features.ts
PUBLIC_CHARGERS: false,
```

When `false`: `useUTEChargers` returns `enabled: false` (no fetch), blue pins never render, Fuente filter hidden in FiltersSheet, `useChargers` returns only P2P `MapCharger[]`.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `normalizeUTESation()` | Pure function: mock API response → assert `MapCharger` shape, null coord exclusion |
| Unit | `useChargers` merge logic | Mock both query results → assert filter combinations (source, connector, power) |
| Integration | `chargersToGeoJSON()` | Assert `source` property present on all features |
| E2E | Map renders both pin types | Blue + orange markers visible at zoom >= 14 |

## Migration / Rollout

No database migration. Feature flag `PUBLIC_CHARGERS: false` gates everything. Flip to `true` to enable. Rollback is single-line flag change.

## Open Questions

- [ ] Blue marker PNG: exact asset needs design handoff (or generate programmatically via `MapboxGL.Shape` circle layer as fallback)
- [ ] UTE station `status` field mapping: need to verify API response `stationStatus` enum values against actual API
