# Map Specification

## Purpose

The Mapa tab is the public charger-discovery surface. It renders Google Maps centered on Uruguay with custom charger pins, a recenter FAB, and a Filtros bottom sheet (5 categories). Location permission is requested ONLY on entry to this tab.

## Requirements

### Requirement: Google Maps Render

The system SHALL render a Google Maps view centered on Uruguay, defaulting to a region covering Montevideo. The Google watermark is visible in the lower-left corner.

#### Scenario: Map renders for a logged-out user

- GIVEN the user opens the Mapa tab without being signed in
- WHEN the map tile loads
- THEN the map shows Uruguay at country zoom
- AND charger pins are visible (if any exist in the queried region)
- AND no login prompt is shown

### Requirement: Custom Charger Pin

The system SHALL render each charger location as a pin using the `cargador.png` asset. The pin SHALL scale with zoom level and remain visible above the Google base map.

#### Scenario: Three pins are rendered

- GIVEN three chargers exist near Montevideo (Sauce, Toledo, Ciudad Vieja)
- WHEN the map renders at city zoom
- THEN three `cargador.png` markers are placed at the stored lat/lng

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

- Pin clustering is OUT of scope for MVP; render every pin individually up to a 200-pin hard cap.
- Filter state MUST be in Zustand (not React Query) so it survives map re-renders and tab switches.
- Map gestures (pan, zoom) MUST remain responsive while filter sheet is open.
- The map SHALL be wrapped in an ErrorBoundary that falls back to a friendly retry card on tile-load failure.
