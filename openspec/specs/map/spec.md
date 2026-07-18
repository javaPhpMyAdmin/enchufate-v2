# Map Specification

## Purpose

The Mapa tab is the public charger-discovery surface. It renders a MapLibre view (using OpenFreeMap tiles) centered on Uruguay with custom charger pins (using native clustering at low zoom), a recenter FAB, and a Filtros bottom sheet (5 categories). Location permission is requested ONLY on entry to this tab.

## Requirements

### Requirement: MapLibre Render

The system SHALL render a MapLibre view centered on Uruguay, defaulting to a region covering Montevideo. The OSM/OpenFreeMap attribution is visible (required by OpenStreetMap ToS).

#### Scenario: Map renders for a logged-out user

- GIVEN the user opens the Mapa tab without being signed in
- WHEN the map tile loads
- THEN the map shows Uruguay at country zoom
- AND charger pins (or cluster bubbles) are visible (if any exist in the queried region)
- AND no login prompt is shown

### Requirement: Custom Charger Pin

The system SHALL render each charger location as a pin using the `cargador.png` asset. The pin SHALL scale with zoom level and remain visible above the MapLibre base layer.

#### Scenario: Three pins are rendered

- GIVEN three chargers exist near Montevideo (Sauce, Toledo, Ciudad Vieja)
- WHEN the map renders at zoom >= 14 (street level)
- THEN three `cargador.png` markers are placed at the stored lat/lng

### Requirement: Native Pin Clustering

The system SHALL cluster charger pins at zoom levels < 14 using MapLibre's native clustering (`cluster: true` on the GeoJSON `ShapeSource`). Cluster radius is 50px. Each cluster shows a bubble with the count of chargers in that cluster.

#### Scenario: 12 chargers in a small area render as 1 cluster at low zoom

- GIVEN 12 chargers exist within 200m of each other in Pocitos
- WHEN the map renders at zoom 12 (neighborhood level)
- THEN the user sees 1 cluster bubble with the number "12" inside
- AND tapping the cluster zooms in to expand the cluster

#### Scenario: Cluster expands at high zoom

- GIVEN the user taps a cluster bubble
- WHEN the map zooms in
- THEN the cluster breaks apart into its individual pins or smaller sub-clusters

### Requirement: No pin count cap

The system SHALL NOT artificially cap the number of visible pins. MapLibre's native clustering handles arbitrary counts gracefully. There is no hard cap (the previous 200-pin cap from the Google Maps era has been removed).

#### Scenario: 500 chargers render correctly

- GIVEN 500 chargers exist in Montevideo
- WHEN the map renders at any zoom level
- THEN the user sees a finite number of clusters and pins
- AND the map does not freeze or render individual pins beyond a reasonable density

### Requirement: Recenter FAB

The system SHALL render a circular FAB in the bottom-right corner of the map. Tapping it recenters the map on the user's current location (or Uruguay if location is unavailable / denied).

#### Scenario: User taps recenter with granted permission

- GIVEN location permission is granted
- WHEN the user taps the FAB
- THEN the map recenters on the device's current coordinates

#### Scenario: User taps recenter with denied permission

- GIVEN location permission is denied
- WHEN the user taps the FAB
- THEN the map recenters on Uruguay
- AND a one-time toast appears: "Activá la ubicación para centrar el mapa"

### Requirement: Location Permission Flow

The system SHALL request location permission ONLY on entry to the Mapa tab (and again on entry to Publicar step 2 — see charger-publish spec). No app-start prompt.

#### Scenario: First-time entry triggers native prompt

- GIVEN the user opens the Mapa tab for the first time
- WHEN the screen mounts
- THEN the native iOS / Android permission prompt appears

#### Scenario: Permission denied falls back gracefully

- GIVEN the user previously denied location permission
- WHEN the user re-enters the Mapa tab
- THEN the map renders without prompting again
- AND the FAB recenter falls back to Uruguay

### Requirement: Filtros Bottom Sheet

The system SHALL open a bottom sheet with 5 filter categories: Estado, Conector, Potencia, Precio, Distancia. Each category is a chip group. The sheet has `Reset` (text) and `Aplicar` (orange) actions.

#### Scenario: User opens filters and applies Estado = Disponible

- GIVEN the user taps the "Filtros" pill
- WHEN the sheet opens and the user selects "Disponible" under Estado and taps Aplicar
- THEN the map updates to show only available chargers
- AND the filter state persists in a Zustand store across tab switches

#### Scenario: User resets filters

- GIVEN the user has applied one or more filters
- WHEN the user taps Reset
- THEN all chip selections clear
- AND the map shows all chargers again

## Non-functional notes

- **Native clustering is IN scope for MVP** (via MapLibre's `cluster: true`); no third-party plugin required.
- Filter state MUST be in Zustand (not React Query) so it survives map re-renders and tab switches.
- Map gestures (pan, zoom) MUST remain responsive while filter sheet is open.
- The map SHALL be wrapped in an ErrorBoundary that falls back to a friendly retry card on tile-load failure.
- OSM/OpenFreeMap attribution MUST remain visible (OSM ToS requirement) — do not hide it.
- `@maplibre/maplibre-react-native` is a native dep: it requires `expo prebuild` (already triggered for `expo-secure-store` in Phase 1 follow-up; no extra step here).
- **No tokens required** — OpenFreeMap is open and keyless. `.env` does not need any map-related entries.
