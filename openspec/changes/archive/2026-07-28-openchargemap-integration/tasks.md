# Tasks: Open Charge Map Integration

> 8 tasks, ~286 lines total. Single PR.

---

## Task 1: connectionTypeMap.ts — OCM ConnectionTypeID → ConnectorType mapping [x]

**Files**: `src/features/chargers/ocm/connectionTypeMap.ts` (NEW, ~45 lines)

**Dependencies**: None

**Description**:
Create a static `Record<number, ConnectorType>` lookup at `src/features/chargers/ocm/connectionTypeMap.ts`. Export a single `OCM_CONNECTOR_MAP` constant and a `mapOCMConnectionType(id: number): ConnectorType` function that:
- Returns the mapped type for known IDs (see table below)
- Returns `'tipo_2'` with a `console.warn` for unknown IDs
- Also export `mapOCMStatus(id?: number): 'operational' | 'offline'` that maps StatusTypeID: 100/200 → `'offline'`, everything else (50, 150, 0, undefined) → `'operational'`

| OCM ConnectionTypeID | ConnectorType |
|----------------------|---------------|
| 33, 32 | `'ccs'` |
| 25, 1036 | `'tipo_2'` |
| 1 | `'tipo_1'` |
| 27, 30 | `'tesla'` |
| 1039 | `'chademo'` |
| 1040 | `'gb_t'` |
| other | `'tipo_2'` (warning) |

**Edge cases**:
- `ConnectionTypeID` is undefined/null → fall to unknown path → warn + `'tipo_2'`
- `StatusTypeID` is undefined → `'operational'` (safe default)

**Acceptance**:
- `mapOCMConnectionType(33)` returns `'ccs'`
- `mapOCMConnectionType(999)` returns `'tipo_2'` and emits a warning
- `mapOCMStatus(100)` returns `'offline'`
- `mapOCMStatus(50)` returns `'operational'`
- `mapOCMStatus(undefined)` returns `'operational'`

---

## Task 2: fetchOCMChargers.ts — OCM API client with normalization [x]

**Files**: `src/features/chargers/ocm/fetchOCMChargers.ts` (NEW, ~140 lines)

**Dependencies**: Task 1 (uses `mapOCMConnectionType`, `mapOCMStatus`), imports `MapCharger` and `ConnectorInfo` from `../types`

**Description**:
Create `src/features/chargers/ocm/fetchOCMChargers.ts` mirroring the `fetchUTEChargers` pattern. The module exports a single `fetchOCMChargers(): Promise<MapCharger[]>` function.

**API call**:
- Endpoint: `https://api.openchargemap.io/v3/poi/?countrycode=UY&key=${EXPO_PUBLIC_OCM_API_KEY}`
- Headers: `User-Agent: Enchufate/2.0 (Uruguay; +https://enchufate.uy)`
- Before `res.json()`, check `Content-Type` header — if `text/html`, throw descriptive error (`"OCM returned HTML (Cloudflare block)"`)
- Reject on non-2xx status with `OCM API error: {status}` message
- Reject on invalid JSON (let `res.json()` throw naturally)

**Normalization function** (`normalizeOCMStation(poi: OCMPOI): MapCharger | null`):
- Return `null` when lat/lng are null, undefined, or exactly 0 (exclude invalid POIs)
- `id`: `ocm-${poi.ID}`
- `source`: `'ocm'`
- `title`: `poi.AddressInfo.Title ?? 'Estación de carga'`
- `address`: join `AddressLine1` + `AddressLine2` with `', '`, fallback `''`
- `city`: `AddressInfo.Town`
- `department`: `AddressInfo.StateOrProvince`
- `lat`/`lng`: from `AddressInfo.Latitude`/`Longitude`
- `connectors`: map from `Connections[]`:
  - `type`: via `mapOCMConnectionType(ConnectionTypeID)`
  - `power_kw`: `PowerKW` if > 0; if 0 and `LevelID` is present, infer:
    - LevelID 1 → 7, LevelID 2 → 22, LevelID 3 → 50; else 0
  - `count`: `Quantity ?? 1`
- `station_status`: via `mapOCMStatus(StatusTypeID)`

**OCMPOI type** (local, not exported — only implements used fields):
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
}
```

**Error handling**:
- Throw on network error, non-2xx, HTML content-type
- Defensive: if `res.json()` resolves to something non-array, `console.warn` and return `[]`

**Acceptance**:
- Valid OCM POI with CCS+Type2 connectors normalizes to MapCharger with two connectors
- POI with null lat returns `null` (excluded)
- POI with `PowerKW: 0` and `LevelID: 2` gets `power_kw: 22`
- HTML response throws before calling `res.json()`
- Empty JSON array returns `[]`

---

## Task 3: useOCMChargers.ts — TanStack Query hook [x]

**Files**: `src/features/chargers/hooks/useOCMChargers.ts` (NEW, ~35 lines)

**Dependencies**: Task 2, `src/lib/features.ts` (must be updated in Task 5 first)

**Description**:
Create `src/features/chargers/hooks/useOCMChargers.ts` mirroring `useUTEChargers.ts` exactly. A TanStack Query `useQuery` wrapper:

```typescript
export function useOCMChargers(): UseQueryResult<MapCharger[], Error> {
  return useQuery({
    queryKey: ['chargers', 'ocm'],
    queryFn: async () => {
      try {
        return await fetchOCMChargers();
      } catch (err) {
        console.warn('[useOCMChgrs] OCM fetch failed, degrading to P2P+UTE:', err);
        return [];
      }
    },
    enabled: isFeatureEnabled('OCM_CHARGERS'),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    placeholderData: keepPreviousData,
  });
}
```

**Key behaviors**:
- When `OCM_CHARGERS` is `false`, the query never fires — `data` is always `undefined`
- On fetch error, catches and returns `[]` — never throws up to the caller
- `staleTime: 5 * 60_000` (OCM data is relatively static — 5 min is safe)
- `gcTime: 30 * 60_000` (keep in cache for 30 min so tab switches don't refetch)
- Uses `keepPreviousData` for smooth filter transitions

**Acceptance**:
- `isFeatureEnabled('OCM_CHARGERS')` is `false` → query is not enabled
- Fetch throws → hook returns `{ data: [] }` (no crash)
- Fetch succeeds → returns typed `MapCharger[]`

---

## Task 4: types.ts — Add `'ocm'` to ChargerSource union [x]

**Files**: `src/features/chargers/types.ts` (+1 line)

**Dependencies**: None

**Description**:
Add `'ocm'` to the `ChargerSource` union type:

```typescript
export type ChargerSource = 'enchufate' | 'ute' | 'ocm';
```

This single-line change unlocks TypeScript exhaustiveness checking across all source-aware code: `useChargers`, `MapContent` layer filters, and `FiltersSheet` source chips. No other type changes needed — `MapCharger` already uses `ChargerSource` for its `source` field.

**No impact on existing code** — all existing `source: 'ute'` and `source: 'enchufate'` references remain valid. The union expansion is purely additive.

**Acceptance**:
- `ChargerSource` accepts `'ocm'` without type error
- All existing `ChargerSource`-typed code still compiles
- `c.source === 'ocm'` type-narrows correctly

---

## Task 5: features.ts — Add `OCM_CHARGERS` feature flag [x]

**Files**: `src/lib/features.ts` (+1 line)

**Dependencies**: None

**Description**:
Add `OCM_CHARGERS: false` to the `FEATURES` object, placed after `PUBLIC_CHARGERS`:

```typescript
OCM_CHARGERS: false,
```

The `false` default means OCM data is opt-in during development — flip to `true` after verifying the API key is set and the fetch works. `FeatureFlag` union type auto-updates via `keyof typeof FEATURES`.

**No code changes** in `isFeatureEnabled` — it's already generic over `FeatureFlag`.

**Acceptance**:
- `isFeatureEnabled('OCM_CHARGERS')` returns `false`
- `FeatureFlag` union now includes `'OCM_CHARGERS'`
- Calling `isFeatureEnabled('OCM_CHARGERS')` compiles without error

---

## Task 6: useChargers.ts — 3-way merge with 50m Haversine dedup [x]

**Files**: `src/features/chargers/hooks/useChargers.ts` (~+40 lines modified)

**Dependencies**: Task 3 (useOCMChargers hook), Task 4 (ChargerSource type)

**Description**:
Modify `useChargers.ts` to:
1. Import and call `useOCMChargers()` alongside `useUTEChargers()`
2. Implement a 3-way merge in `useMemo` that deduplicates OCM against UTE via 50m Haversine

**Import changes**:
```typescript
import { useOCMChargers } from './useOCMChargers';
```

**Hook call** (add after `uteQuery` line):
```typescript
const ocmQuery = useOCMChargers();
```

**Merge logic** (inside `useMemo`, after `let merged = [...p2p, ...ute]`):

```
1. Clone the UTE array (avoid mutation)
2. Iterate OCM entries:
   - For each OCM station, find nearest UTE via haversine(u, o) <= 0.05 km
   - If found: fill UTE's title/address from OCM if UTE's are empty/placeholder
   - If NOT found: add to ocmOnly[]
3. merged = [...p2p, ...enrichedUTE, ...ocmOnly]
```

**Key rules**:
- P2P is NEVER deduped against OCM (only UTE vs OCM)
- First UTE match wins (if OCM is within 50m of multiple UTE stations, only the first match fills gaps)
- Multiple OCM stations near the same UTE station → all excluded (prevents map clutter)
- Original UTE array is not mutated through the ref — clone before modifying

**Source filter update**: The existing `filters?.fuente === 'ute'` and `filters?.fuente === 'enchufate'` lines need a third option for `'ocm'`. Add:
```typescript
if (filters?.fuente === 'ocm') {
  merged = merged.filter((c) => c.source === 'ocm');
}
```

**Loading/error propagation**: Return type must include OCM query state:
```typescript
isLoading: supabaseQuery.isLoading || uteQuery.isLoading || ocmQuery.isLoading,
error: supabaseQuery.error ?? uteQuery.error ?? ocmQuery.error,
isPlaceholderData: supabaseQuery.isPlaceholderData || uteQuery.isPlaceholderData || ocmQuery.isPlaceholderData,
```

**Acceptance**:
- OCM station 30m from a UTE station → UTE entry appears (with metadata filled from OCM if gaps), OCM excluded
- OCM station 500m from every UTE → appears with `source: 'ocm'`
- Multiple OCM near same UTE → all excluded, UTE wins once
- P2P chargers never affected by OCM dedup
- Source filter `'ocm'` shows only OCM stations
- OCM_CHARGERS flag off → `ocmQuery.data` is undefined → merged = P2P+UTE only

---

## Task 7: filterStore + FiltersSheet — Add OCM source option [x]

**Files**:
- `src/stores/filterStore.ts` (+1 line, union type)
- `src/components/organisms/FiltersSheet.tsx` (+1 line, UI chip)

**Dependencies**: Task 4 (ChargerSource type)

**Description**:

**filterStore.ts** — Add `'ocm'` to `SourceFilter` union:
```typescript
export type SourceFilter = 'enchufate' | 'ute' | 'ocm';
```

**FiltersSheet.tsx** — Add an `{ label: 'OCM', value: 'ocm' }` entry to `FUENTE_OPTIONS`:
```typescript
const FUENTE_OPTIONS: ReadonlyArray<FilterChipRowOption> = [
  { label: 'Todos', value: '__none__' },
  { label: 'Enchúfate', value: 'enchufate' },
  { label: 'UTE', value: 'ute' },
  { label: 'OCM', value: 'ocm' },
];
```

No other UI changes needed — the existing `FilterChipRow` component and section rendering logic handle the new chip automatically. The Fuente section is already gated behind `PUBLIC_CHARGERS` (not `OCM_CHARGERS`), so the chip always appears when public chargers are enabled.

**Acceptance**:
- User opens FiltersSheet → sees "OCM" chip under Fuente
- Selecting "OCM" → draft.fuente = `'ocm'`
- Aplicar → filters.fuente = `'ocm'` → map shows only `source: 'ocm'` chargers
- Selecting again → deselects (toggle off)

---

## Task 8: MapContent — OCM marker layers [x]

**Files**: `src/components/organisms/MapContent.tsx` (+~20 lines)

**Dependencies**: Task 4 (source type), Task 6 (data in shape)

**Description**:
Add OCM marker layers inside the existing `chargers` ShapeSource, after the UTE layers (lines 265-275). Two layers, identical to UTE in style but with `'OCM'` text:

```tsx
{/* Individual OCM charger pin — blue circle + "OCM" text (source=ocm). */}
<MapboxGL.CircleLayer
  id="ocm-pin-bg"
  filter={['all', ['!', ['has', 'point_count']], ['==', 'source', 'ocm']]}
  style={{
    circleColor: colors.ute,
    circleRadius: 16,
    circleStrokeWidth: 2,
    circleStrokeColor: colors.surface,
  }}
/>
<MapboxGL.SymbolLayer
  id="ocm-pin"
  filter={['all', ['!', ['has', 'point_count']], ['==', 'source', 'ocm']]}
  style={{
    textField: 'OCM',
    textSize: 10,
    textColor: colors.textOnPrimary,
    textFont: ['DIN Offc Pro Bold', 'Open Sans Bold', 'Arial Unicode MS Bold'],
    textAllowOverlap: true,
  }}
/>
```

**Why same ShapeSource**: Cluster groups already work across all sources since `source` is a per-feature property. Adding layers with `['==', 'source', 'ocm']` filter keeps clusters unified across P2P, UTE, and OCM while differentiating individual pins.

**Why same color as UTE**: Both UTE and OCM represent "public chargers" — a single visual category for the user. The text label (`'UTE'` vs `'OCM'`) is the discriminator.

**Acceptance**:
- OCM stations appear as blue circles with "OCM" text on the map
- Clusters count includes OCM stations in the total
- OCM markers use the same pin style as UTE but with "OCM" label
- Source filter `'ocm'` hides UTE and P2P, shows only OCM markers

---

## Review Workload Forecast

| Metric | Value |
|--------|-------|
| **Total estimated lines changed** | ~286 |
| **Chained PRs recommended?** | **No** |
| **400-line budget risk** | Low (~71% of budget) |
| **Decision needed before apply?** | **Yes** — Need `EXPO_PUBLIC_OCM_API_KEY` in `.env` and the key value. Without it, `fetchOCMChargers` will fail at runtime. Task 2's endpoint depends on this env var name being agreed upon. |

### Notes for reviewer

- All 8 tasks are **independent-in-implementation but order-dependent for review** — apply sequentially 1→8 since each builds on previous types/functions.
- The heaviest task is Task 2 (~140 lines) — normalization logic with multiple edge cases (null coords, unknown IDs, power inference).
- Task 6 (~40 lines) is the second most complex — the 3-way merge with Haversine dedup is the core integration logic.
- Tasks 4, 5, 7 are trivial type/flag additions.
- Every task references the existing UTE pattern (`fetchUTEChargers` / `useUTEChargers`) — the reviewer can validate by side-by-side comparison.
