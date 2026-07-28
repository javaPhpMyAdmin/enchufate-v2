# Design: Open Charge Map Integration

## Technical Approach

Add OCM as a third charger source alongside P2P and UTE, mirroring the UTE pattern exactly: `fetchOCMChargers` (normalize) → `useOCMChargers` (TanStack Query, gated by `OCM_CHARGERS`) → 3-way merge in `useChargers`. Dedup OCM against UTE via 50m Haversine — UTE wins on connectors/status, OCM fills metadata gaps. OCM markers use the same ShapeSource as UTE with a blue CircleLayer + "OCM" text label. Graceful degradation returns `[]` on fetch failure.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Independent `OCM_CHARGERS` flag vs combine with `PUBLIC_CHARGERS` | Combined = simpler flags, but loses granular control | **Independent flag** (`OCM_CHARGERS: false`) — granular, matches spec R4 |
| Separate OCM ShapeSource vs same as UTE | Separate = more layers + cluster groups; same = simpler cluster counts, single press handler | **Same ShapeSource** — OCM/UTE share `charging` ShapeSource, differentiated by `source` filter |
| OCM dedup in `useChargers` vs separate hook | Separate = testable but more wiring; inline = simpler but harder to isolate | **Inline in `useChargers` useMemo** — follows existing pattern, haversine already there |
| Separate `connectionTypeMap.ts` file vs inline | Separate = independently testable; inline = fewer files | **Separate file** — pure function, no deps, easy to unit test |

## Data Flow

```
useChargers(filters)
  │
  ├── useSupabaseChargers()    ← P2P, existing
  ├── useUTEChargers()         ← UTE, existing
  └── useOCMChargers()         ← OCM, NEW (gated by OCM_CHARGERS flag)
        └── fetchOCMChargers() → OCM API → normalize → MapCharger[]
  │
  └── useMemo:
        p2p = normalizeCharger()
        merged = [...p2p, ...ute, ...dedupedOcm]
        apply filters(source, connector, power, distance)
        return merged
```

### 3‑Way Merge with 50m Dedup

```
function mergeChargers(p2p, ute, ocm):
  enrichedUTE = ute.map(clone)     // avoid mutation
  ocmOnly = []

  for each o in ocm:
    nearestUTE = enrichedUTE.find(u => haversine(u, o) ≤ 0.05 km)
    if nearestUTE:
      // UTE wins — fill metadata gaps from OCM
      if !nearestUTE.title or nearestUTE.title is placeholder:
        nearestUTE.title ← o.title
      if !nearestUTE.address:
        nearestUTE.address ← o.address
      // skip OCM entry
    else:
      ocmOnly.push(o)

  return [...p2p, ...enrichedUTE, ...ocmOnly]
```

**Edge cases**: Null/zero lat/lng → excluded in normalize (same as UTE). OCM within 50m of multiple UTE stations → first match wins. Multiple OCM stations near same UTE → all excluded (map would be cluttered with OCM-only stations). P2P is never deduped against OCM.

## File Changes

| File | Action | Lines | What |
|------|--------|-------|------|
| `src/features/chargers/ocm/fetchOCMChargers.ts` | Create | 140 | API fetch + normalize + Cloudflare detection |
| `src/features/chargers/ocm/connectionTypeMap.ts` | Create | 45 | Static `Record<number, ConnectorType>` mapping |
| `src/features/chargers/hooks/useOCMChargers.ts` | Create | 35 | TanStack Query hook, gated by flag, catches errors |
| `src/features/chargers/types.ts` | Modify | +2 | Add `'ocm'` to `ChargerSource` union |
| `src/lib/features.ts` | Modify | +1 | Add `OCM_CHARGERS: false` |
| `src/features/chargers/hooks/useChargers.ts` | Modify | +40 | Add `useOCMChargers()` call and dedup merge |
| `src/components/organisms/FiltersSheet.tsx` | Modify | +2 | Add OCM chip to FUENTE_OPTIONS |
| `src/stores/filterStore.ts` | Modify | +1 | Add `'ocm'` to `SourceFilter` union |
| `src/components/organisms/MapContent.tsx` | Modify | +20 | Add OCM CircleLayer + SymbolLayer |
| **Total** | | **~286** | Fits single PR |

## Interfaces

### OCMPOI (raw response, partial — only used fields)

```typescript
interface OCMPOI {
  ID: number;
  AddressInfo: {
    Title?: string;
    AddressLine1?: string;
    AddressLine2?: string;
    Town?: string;
    StateOrProvince?: string;
    Latitude?: number | null;
    Longitude?: number | null;
  };
  Connections?: Array<{
    ConnectionTypeID?: number;
    PowerKW?: number;
    LevelID?: number;
    Quantity?: number;
  }>;
  StatusTypeID?: number;
  OperatorInfo?: { Title?: string };
  GeneralComments?: string;
}
```

### ConnectionType Map

```typescript
const OCM_CONNECTOR_MAP: Record<number, ConnectorType> = {
  1: 'tipo_1',
  25: 'tipo_2',
  27: 'tesla',
  30: 'tesla',
  32: 'ccs',
  33: 'ccs',
  1036: 'tipo_2',
  1039: 'chademo',
  1040: 'gb_t',
};
```

### StatusType Map (internal)

```typescript
function mapOCMStatus(id?: number): 'operational' | 'offline' {
  if (id === 100 || id === 200) return 'offline';
  return 'operational'; // 50, 150, 0, undefined all map to operational
}
```

### fetchOCMChargers

```typescript
export async function fetchOCMChargers(): Promise<MapCharger[]>
```

Signature matches `fetchUTEChargers`. Throws on network error, non-2xx status, empty JSON array, or HTML response (Cloudflare block — check `Content-Type` header before `res.json()`).

### useOCMChargers

```typescript
export function useOCMChargers(): UseQueryResult<MapCharger[], Error>
```

`staleTime: 5 * 60_000`, `gcTime: 30 * 60_000`. Catches errors and returns `[]` (never throws). Enabled only when `isFeatureEnabled('OCM_CHARGERS')`.

## Map Rendering

OCM markers share the same `chargers` ShapeSource as UTE. Uses identical CircleLayer style (`colors.ute` blue, radius 16) but with `'OCM'` text instead of `'UTE'`. This visually groups them as "public chargers" while being discernible at a glance.

```typescript
// New layers in MapContent — inserted after ute-pin layers
<MapboxGL.CircleLayer
  id="ocm-pin-bg"
  filter={['all', ['!', ['has', 'point_count']], ['==', 'source', 'ocm']]}
  style={{ circleColor: colors.ute, circleRadius: 16, ... }}
/>
<MapboxGL.SymbolLayer
  id="ocm-pin"
  filter={['all', ['!', ['has', 'point_count']], ['==', 'source', 'ocm']]}
  style={{ textField: 'OCM', textSize: 10, textColor: colors.textOnPrimary, ... }}
/>
```

Cluster behavior works automatically since all sources share one ShapeSource.

## Feature Flag Integration

```typescript
// src/lib/features.ts
FEATURES = {
  ...
  PUBLIC_CHARGERS: true,
  OCM_CHARGERS: false,  // ← NEW
};
```

`useOCMChargers` checks `isFeatureEnabled('OCM_CHARGERS')` in its `enabled` config. When `false`, the query does not fire and `useChargers` receives an empty array. Rollback: flip to `false`, zero risk.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Network failure | `fetchOCMChargers` throws → `useOCMChargers` catches → returns `[]` → degrades to P2P+UTE |
| Rate limit (429) | Served by TanStack Query's default retry (3 attempts with backoff) |
| Cloudflare block (HTML) | Check `res.headers.get('content-type')` before `res.json()` — if `text/html`, throw descriptive error |
| OCM returns `[]` | Treated as success → empty array → merge continues normally |
| Invalid POI (null coords) | `normalizeOCMStation` returns `null` → excluded (same as UTE pattern) |

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `normalizeOCMStation` | Pure function: test happy path, unknown ConnectionTypeID → warn + fallback, PowerKW=0 → LevelID inference, null coords → null |
| Unit | `OCM_CONNECTOR_MAP` | Static lookup: test all known IDs + unknown ID falls back |
| Unit | Dedup algorithm | Pure function: OCM-only stations pass through, OCM near UTE (<50m) excluded, metadata gaps filled, no mutation of original UTE array |
| Integration | `fetchOCMChargers` | Mock fetch: valid JSON, empty array, network error, HTML response → each returns expected shape |
| Integration | `useOCMChargers` | Mock `fetchOCMChargers`, test TanStack Query states: loading, success with data, error → empty array |
