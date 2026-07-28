# Exploration: Open Charge Map Integration

## 1. API Capabilities and Limitations

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v3/poi/` | GET | Query POIs by country, lat/lng, distance, filters |
| `/v3/poi/{ocm_id}/` | GET | Single POI detail |
| `/v3/referencedata/` | GET | Lookup tables (ConnectionTypes, Operators, StatusTypes, etc.) |
| `/v3/poi/{ocm_id}/comments/` | GET | User comments/check-ins |
| `/v3/poi/{ocm_id}/media/` | GET | Community photos |
| `/v3/poi/` | POST | Submit new POI (requires auth) |

### Authentication

- Free API key required — register at `openchargemap.org` → My Profile → My Apps → Register Application
- Pass as `key=YOUR_KEY` query param or `X-API-Key` header
- Must include a `User-Agent` header (Cloudflare blocks bare requests)

### Rate Limits

- **~100 API calls/minute** per API key (documented via Microsoft Power Platform connector)
- **250 max results per single query** (can increase with `maxresults` param, up to ~500 observed)
- **Cloudflare protection** — automated requests without proper headers trigger JS challenges. The maintainer noted "millions of requests per day" from automated systems triggering DoS protections (July 2026 community thread).
- For Uruguay (small country), a single `countrycode=UY` call returns all POIs — no pagination needed.

### Country Filtering

- **Yes** — `countrycode=UY` (ISO 3166-1 alpha-2) returns all Uruguay POIs
- Also supports bounding box and lat/lng + distance queries

### Real-time Status

- **No real-time data** — OCM is a static/crowdsourced registry
- `StatusTypeID` reflects last-known status (Operational/Not Operational/Planned), not live availability
- `DateLastVerified` and `IsRecentlyVerified` indicate data freshness
- Community comments/check-ins provide indirect status signals

---

## 2. Data Field Mapping (OCM → MapCharger)

### POI → MapCharger

| OCM Field | MapCharger Field | Notes |
|-----------|------------------|-------|
| `ID` | `id` | Prefix with `ocm-` (e.g. `ocm-260129`) |
| (hardcoded) | `source` | `'ocm'` (new ChargerSource value) |
| `AddressInfo.Title` | `title` | Station name |
| `AddressInfo.AddressLine1` + `AddressLine2` | `address` | Concatenate |
| `AddressInfo.Town` | `city` | |
| `AddressInfo.StateOrProvince` | `department` | |
| `AddressInfo.Latitude` | `lat` | |
| `AddressInfo.Longitude` | `lng` | |
| `Connections[]` | `connectors[]` | Map each via ConnectionType mapping |
| `StatusTypeID` | `station_status` | See status mapping below |
| `UsageCost` | (no direct field) | Display in detail view only |
| `GeneralComments` | (no direct field) | Display in detail view only |
| `NumberOfPoints` | (no direct field) | Useful for capacity info |

### ConnectionType Mapping (OCM ID → ConnectorType)

| OCM ConnectionTypeID | OCM Title | enchufate-v2 ConnectorType |
|----------------------|-----------|---------------------------|
| 33 | CCS (Type 2) | `'ccs'` |
| 32 | CCS (Type 1) | `'ccs'` |
| 25 | Type 2 (Socket Only) | `'tipo_2'` |
| 1036 | Type 2 (Tethered Connector) | `'tipo_2'` |
| 1 | Type 1 (J1772) | `'tipo_1'` |
| 27 | Tesla Supercharger | `'tesla'` |
| 30 | Tesla (Model S/X) | `'tesla'` |
| 1039 | CHAdeMO | `'chademo'` |
| 1040 | GB/T DC | `'gb_t'` |
| 0 | Unknown | fallback → `'tipo_2'` |

### StatusType Mapping

| OCM StatusTypeID | OCM Title | MapCharger station_status |
|------------------|-----------|--------------------------|
| 50 | Operational | `'operational'` |
| 100 | Not Operational | `'offline'` |
| 150 | Planned For Future Date | `'operational'` (exclude from initial load) |
| 0 | Unknown | `'operational'` (default) |

### Connector Fields

| OCM Connection Field | ConnectorInfo Field | Notes |
|----------------------|---------------------|-------|
| `ConnectionTypeID` | `type` | Via mapping table above |
| `PowerKW` | `power_kw` | Direct (may be 0 or missing) |
| `Quantity` | `count` | Default to 1 if missing |
| `StatusTypeID` | `status` | 50=`'available'`, 100=`'out_of_service'` |
| (no equivalent) | `has_cable` | Always `true` for tethered; unknown for socket-only |

### Power Inference

OCM `PowerKW` may be 0 or missing. When missing, infer from `LevelID`:
- Level 1: ≤2 kW
- Level 2: 7–22 kW (use 22 as default if no data)
- Level 3: ≥40 kW (cannot infer exact; use 0 and let UI show "N/A")

---

## 3. How OCM Complements UTE

### Coverage

| Aspect | UTE API | OCM |
|--------|---------|-----|
| Station count (UY) | ~207 static stations | ~80–110 POIs (growing) |
| Data source | Official UTE API | Crowdsourced + UTE submissions |
| Overlap | All UTE stations should overlap | Many UTE stations are also in OCM |
| Unique to OCM | — | Private operators (e.g. eOne), cross-border networks |
| Real-time status | **Yes** (connector-level live status) | **No** (static, last-verified date) |
| Connector detail | Live status per connector | Power, type, quantity |
| Pricing info | None | `UsageCost` free text (e.g. "u$s 0.33 Kw") |
| Photos | None | Community-submitted photos |
| Access info | None | `AccessComments`, phone numbers |
| Operator info | Limited | Full operator metadata |
| Data freshness | Always current | Depends on community verification |

### Value Proposition

1. **Non-UTE operators** — OCM captures chargers from eOne, DMC, and other private networks not in the UTE API
2. **Pricing data** — `UsageCost` field provides pricing hints (not structured, but useful)
3. **Photos and access info** — richer detail for the charger detail screen
4. **Data validation** — cross-reference OCM's `IsRecentlyVerified` against UTE's live status
5. **International context** — if the app expands to cross-border (UY → BR/AR), OCM already has data

### Overlap Strategy

OCM data will significantly overlap with UTE. The deduplication strategy should be:
- **UTE takes priority** when a station exists in both sources (real-time status wins)
- **OCM fills gaps** for stations not in UTE (private operators, newer installations)
- Dedup key: proximity match (lat/lng within 50m) + name similarity

---

## 4. Integration Approach

### Architecture: Parallel with UTE

```
useChargers()
├── useSupabaseChargers()    ← P2P chargers (existing)
├── useUTEChargers()         ← UTE public stations (existing)
└── useOCMChargers()         ← OCM public stations (NEW)
    └── fetchOCMChargers()   ← OCM API client
```

### File Structure (mirrors UTE pattern)

```
src/features/chargers/
├── ocm/
│   ├── fetchOCMChargers.ts      ← API client + normalization
│   └── connectionTypeMap.ts     ← OCM ConnectionTypeID → ConnectorType mapping
├── hooks/
│   └── useOCMChargers.ts        ← TanStack Query hook (gated by feature flag)
└── types.ts                     ← Add 'ocm' to ChargerSource union
```

### Feature Flag

Add `OCM_CHARGERS: false` to `src/lib/features.ts`. Gate `useOCMChargers` behind it, same pattern as `useUTEChargers`.

### Merge Logic in useChargers

```typescript
const ute = uteQuery.data ?? [];
const ocm = ocmQuery.data ?? [];
const p2p = (supabaseQuery.data ?? []).map(normalizeToMapCharger);

// UTE takes priority over OCM for overlapping stations
const ocmOnly = ocm.filter(ocmStation =>
  !ute.some(uteStation => isSameStation(uteStation, ocmStation))
);

let merged = [...p2p, ...ute, ...ocmOnly];
```

### API Key Management

- Store OCM API key in `expo-secure-store` (same as auth tokens)
- Add to `.env` as `EXPO_PUBLIC_OCM_API_KEY` for build-time injection
- Include `User-Agent: enchufate-v2/1.0` header to avoid Cloudflare blocks

### Caching Strategy

- `staleTime: 5 * 60_000` (5 minutes) — OCM data is static, less frequent refresh needed
- `gcTime: 30 * 60_000` (30 minutes) — keep in memory for map browsing

---

## 5. Risks and Unknowns

### High Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| **API key requires registration** | Cannot test without manual signup | Register key during implementation; document in README |
| **Cloudflare blocks automated requests** | Fetch fails silently or returns HTML | Include proper `User-Agent` header; retry with backoff |
| **Data overlap with UTE** | Duplicate markers on map | Proximity-based dedup (50m threshold) |

### Medium Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Rate limit (100 req/min)** | Throttled during heavy use | Single country query returns all UY data; cache aggressively |
| **Incomplete data for UY** | Some POIs missing coordinates or connectors | Filter out POIs with null/zero lat/lng (same as UTE pattern) |
| **PowerKW may be 0 or missing** | Cannot filter by power | Infer from LevelID; show "N/A" in UI when unknown |
| **ConnectionTypeID unknown** | New types added over time | Default to `'tipo_2'` with console.warn (same as UTE pattern) |

### Low Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| **OCM data is static** | No live availability | UTE provides real-time; OCM is supplementary |
| **Spanish UI copy for OCM data** | Station names are in Spanish already | Address fields are structured; no i18n needed |
| **UsageCost is free text** | Cannot parse programmatically | Display as-is in detail view; don't use for filtering |

---

## 6. Key Decision Points for Proposal

1. **API key acquisition** — Who registers? Need a project-owned account at openchargemap.org
2. **Feature flag name** — `OCM_CHARGERS` or `PUBLIC_CHARGERS_OCM`? Suggest `OCM_CHARGERS` for clarity
3. **Dedup threshold** — 50m proximity? Or name-based matching? 50m is simpler and reliable for fixed infrastructure
4. **Should OCM be gated behind `PUBLIC_CHARGERS`?** — Could share the flag with UTE, or have independent flags for granular control
5. **Scope: map only, or also detail view?** — If detail view, we get pricing and photos for free; adds ~100 lines to the change
6. **Fallback behavior** — When OCM fails, degrade to P2P+UTE only (same as UTE's graceful degradation)

---

## 7. Estimated Effort

| Task | Lines (est.) | Complexity |
|------|-------------|------------|
| `fetchOCMChargers.ts` | ~120 | Medium (normalization + mapping) |
| `connectionTypeMap.ts` | ~40 | Low (static mapping object) |
| `useOCMChargers.ts` | ~35 | Low (mirrors useUTEChargers) |
| `useChargers.ts` merge update | ~30 | Medium (dedup logic) |
| `types.ts` update | ~5 | Low (add `'ocm'` to union) |
| `features.ts` update | ~3 | Low (add flag) |
| **Total** | **~233** | **Low-Medium** |

Fits within the 400-line PR budget. No chained PRs needed.
