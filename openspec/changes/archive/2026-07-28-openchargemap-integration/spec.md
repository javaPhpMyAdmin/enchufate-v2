# OCM Integration Specification

## Purpose

Add Open Charge Map (OCM) as a third charger source alongside P2P and UTE. OCM contributes ~80–110 POIs from non-UTE operators (eOne, DMC), normalized and deduplicated against UTE via 50m proximity matching. Gated behind `OCM_CHARGERS` feature flag; failures degrade gracefully to P2P+UTE.

## Requirements

### R1: OCM API Fetch

The system SHALL fetch Uruguay POIs from `https://api.openchargemap.io/v3/poi/?countrycode=UY&key={API_KEY}`. All requests SHALL include a `User-Agent` header. API key SHALL come from `EXPO_PUBLIC_OCM_API_KEY`. The fetch SHALL reject on non-2xx status, invalid JSON, or HTML responses (Cloudflare block).

#### Scenario: Happy path — OCM returns valid POI array

- GIVEN `OCM_CHARGERS` is enabled and `EXPO_PUBLIC_OCM_API_KEY` is set
- WHEN `fetchOCMChargers()` is called
- THEN it returns a `MapCharger[]` array
- AND each entry maps fields per R2

#### Scenario: OCM returns empty array

- GIVEN OCM API returns `[]`
- WHEN `fetchOCMChargers()` resolves
- THEN it returns an empty array
- AND the merge in `useChargers` continues with P2P+UTE only

#### Scenario: OCM API fails (network error, rate limit, Cloudflare block)

- GIVEN the OCM API returns a non-2xx status or the request throws
- WHEN `fetchOCMChargers()` rejects
- THEN `useOCMChargers` returns `[]`
- AND `useChargers` degrades to P2P+UTE without crashing

### R2: Normalization to MapCharger

The system SHALL map OCM POI fields into `MapCharger` with `source: 'ocm'` and `id` prefixed `ocm-{OCM_ID}`. Stations with null/zero lat/lng SHALL be excluded.

| OCM Field | MapCharger Field |
|-----------|------------------|
| `AddressInfo.Title` | `title` |
| `AddressInfo.AddressLine1` (+ Line2) | `address` |
| `AddressInfo.Town` | `city` |
| `AddressInfo.StateOrProvince` | `department` |
| `AddressInfo.Latitude` | `lat` |
| `AddressInfo.Longitude` | `lng` |
| `Connections[]` | `connectors[]` (mapped per R3) |
| `StatusTypeID` | `station_status` (mapped per R4) |

#### Scenario: OCM station with known ConnectionTypeIDs

- GIVEN OCM returns a POI with ConnectionTypeID 33 (CCS) and 25 (Type 2)
- WHEN the station is normalized
- THEN `connectors` contains entries with `type: 'ccs'` and `type: 'tipo_2'`
- AND `power_kw` is set from `PowerKW` (or inferred per R5)

#### Scenario: OCM station with unknown ConnectionTypeID

- GIVEN a POI has ConnectionTypeID 999 (unmapped)
- WHEN normalized
- THEN its `connector.type` defaults to `'tipo_2'`
- AND a `console.warn` is emitted

#### Scenario: OCM station with PowerKW = 0 or missing

- GIVEN a POI has `PowerKW: 0` and `LevelID: 2`
- WHEN normalized
- THEN `power_kw` is set to 22 (Level 2 default)
- GIVEN a POI has `PowerKW: 0` and no `LevelID`
- THEN `power_kw` is set to 0
- AND the UI displays "N/A" for that connector's power

### R3: ConnectionType Mapping

The system SHALL provide a static lookup mapping OCM `ConnectionTypeID` to `ConnectorType`. Unknown IDs SHALL default to `'tipo_2'` with a warning.

| OCM ID | ConnectorType |
|--------|--------------|
| 33, 32 | `'ccs'` |
| 25, 1036 | `'tipo_2'` |
| 1 | `'tipo_1'` |
| 27, 30 | `'tesla'` |
| 1039 | `'chademo'` |
| 1040 | `'gb_t'` |
| other | `'tipo_2'` (warning) |

### R4: Feature Gating

The system SHALL add `OCM_CHARGERS: false` to `src/lib/features.ts`. The `useOCMChargers` query SHALL NOT fire when the flag is `false`.

#### Scenario: OCM disabled — only P2P + UTE show

- GIVEN `OCM_CHARGERS` is `false`
- WHEN `useChargers` executes
- THEN `useOCMChargers` is not called
- AND merged result contains only `source: 'enchufate'` and `source: 'ute'` entries

#### Scenario: OCM enabled — OCM markers appear alongside UTE

- GIVEN `OCM_CHARGERS` is `true`
- WHEN `useChargers` executes
- THEN merged result includes `source: 'ocm'` entries (those not deduplicated per R6)

### R5: Caching and Degradation

The OCM query SHALL use `staleTime: 5 * 60_000` and `gcTime: 30 * 60_000`. On fetch error, `useOCMChargers` SHALL return `[]` (graceful degradation), never throw up to the map.

### R6: Three-Way Merge with 50m Dedup

The system SHALL perform a 3-way merge in `useChargers`: P2P + UTE + OCM. UTE stations within 50m (Haversine) of an OCM station SHALL take priority — the UTE entry wins on `connectors` and `station_status`; the OCM station is excluded. OCM SHALL NOT deduplicate against P2P.

#### Scenario: OCM station far from any UTE station

- GIVEN an OCM station >50m from every UTE station
- WHEN merged
- THEN it appears in the final result with `source: 'ocm'`

#### Scenario: OCM and UTE have overlapping station within 50m

- GIVEN an OCM station is 30m from a UTE station
- WHEN merged
- THEN only the UTE entry appears
- AND the UTE entry's `title`/`address` SHALL be filled from OCM if empty on the UTE side

#### Scenario: 3-way merge with all sources

- GIVEN there are P2P stations, UTE stations, and OCM-exclusive stations
- WHEN merged
- THEN all three sources are represented in the final list
- AND total count = P2P + UTE + (OCM \ deduped)

### R7: Source Filter and Marker Styling

The system SHALL add `'ocm'` to the `SourceFilter` union. The FiltersSheet "Fuente" section SHALL include an "OCM" chip. When `fuente: 'ocm'` is active, only `source: 'ocm'` chargers show. OCM markers SHALL use the same public-charger color as UTE but with a distinct icon/symbol.

#### Scenario: User filters by OCM source

- GIVEN the user opens FiltersSheet
- WHEN they select "OCM" in Fuente and tap Aplicar
- THEN only chargers with `source: 'ocm'` appear on the map

## Non-Requirements

- OCM photos/pricing in popup — deferred
- OCM check-in/comments data — deferred
- Offline cache for OCM — deferred
- OCM API key UI (user provides via `.env`) — deferred to onboarding docs
- Detail screen navigation from OCM pins — popup only
