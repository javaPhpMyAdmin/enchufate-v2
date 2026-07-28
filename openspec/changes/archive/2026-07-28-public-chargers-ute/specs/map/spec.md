# Delta for Map

## MODIFIED Requirements

### Requirement: Custom Charger Pin

The system SHALL render charger pins using source-aware images: orange `cargador.png` for P2P (`source: 'enchufate'`) and a blue marker asset for UTE (`source: 'ute'`). Two separate `SymbolLayer` instances SHALL filter on the GeoJSON feature's `properties.source` to select the correct image. The pin SHALL scale with zoom level and remain visible above the base layer.

(Previously: All chargers rendered as a single `cargador.png` image.)

#### Scenario: Three P2P pins render as orange

- GIVEN three P2P chargers exist near Montevideo
- WHEN the map renders at zoom >= 14
- THEN three orange `cargador.png` markers are placed at stored lat/lng

#### Scenario: UTE pins render as blue

- GIVEN three UTE stations exist near Montevideo
- WHEN the map renders at zoom >= 14
- THEN three blue markers are placed at the UTE coordinates
- AND no orange `cargador.png` is shown for these pins

### Requirement: Native Pin Clustering

The system SHALL cluster charger pins from both sources at zoom levels < 14 using MapLibre's native clustering. Cluster radius is 50px. Both UTE and P2P pins participate in the same cluster — no source-based cluster separation. Each cluster bubble shows the total count of mixed-source chargers.

(Previously: Clustering applied only to P2P chargers from Supabase.)

#### Scenario: 12 chargers in a small area render as 1 cluster at low zoom

- GIVEN 12 chargers (mix of UTE and P2P) exist within 200m in Pocitos
- WHEN the map renders at zoom 12
- THEN the user sees 1 cluster bubble with number "12"

#### Scenario: Cluster expands at high zoom

- GIVEN the user taps a mixed-source cluster bubble
- WHEN the map zooms in
- THEN the cluster breaks apart into individual blue and orange pins

### Requirement: Filtros Bottom Sheet

The system SHALL open a bottom sheet with 6 filter categories: Fuente, Estado, Conector, Potencia, Precio, Distancia. The Fuente category has chips: "Todos" (default), "Enchúfate", "UTE". Each category is a chip group. The sheet has `Reset` (text) and `Aplicar` (orange) actions. The Fuente filter is only visible when the `PUBLIC_CHARGERS` flag is `true`.

(Previously: 5 categories — no Fuente source filter.)

#### Scenario: User opens filters and applies source = UTE

- GIVEN `PUBLIC_CHARGERS` is `true`
- WHEN the user taps "Filtros", selects "UTE" under Fuente, and taps Aplicar
- THEN the map updates to show only UTE chargers
- AND the filter state persists in Zustand across tab switches

#### Scenario: User resets filters clears source

- GIVEN the user has source filter set to "Enchúfate"
- WHEN the user taps Reset
- THEN the Fuente selection resets to "Todos"
- AND all other filters clear
