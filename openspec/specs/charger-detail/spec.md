# Charger Detail Specification

## Purpose

Present a single charger's full profile when a user taps a map pin or a charger card. The screen exposes a "Reservar" CTA that initiates the reservation request flow.

## Requirements

### Requirement: Photo Gallery

The system SHALL render the charger's photos in a horizontal scrollable gallery at the top of the screen. If the charger has zero photos, the system SHALL show the `cargador.png` placeholder.

#### Scenario: Gallery renders five photos

- GIVEN a charger with 5 photos
- WHEN the screen renders
- THEN a horizontal pager displays the first photo
- AND a counter "1/5" is visible

### Requirement: Charger Identity Block

The system SHALL display, below the gallery: charger title, full address, connector type, power in kW, price per hour in USD (orange), and status pill (Disponible / Reservado / Ocupado).

#### Scenario: All identity fields visible

- GIVEN a charger with full data
- WHEN the screen renders
- THEN the title, address, `5.0 kW · CHAdeMO`, `$10/hr`, and a `Disponible` pill are shown in that order

### Requirement: Map Snippet

The system SHALL render a small non-interactive map snippet below the identity block, centered on the charger's coordinates, with the same `cargador.png` pin overlay. Tapping the snippet opens the external Google Maps app with directions to the charger.

#### Scenario: Map snippet tap opens external navigation

- GIVEN a charger with valid lat/lng
- WHEN the user taps the map snippet
- THEN the system opens the platform's default maps app with the destination pre-filled

### Requirement: Host Info Block

The system SHALL display the host's display name, member-since (month + year), and a star rating placeholder (0.0 for MVP). Tapping the block navigates to the host's public profile (out of scope; placeholder OK).

#### Scenario: Host info shows member-since

- GIVEN a host who joined in March 2024
- WHEN the screen renders
- THEN "Miembro desde marzo de 2024" is visible

### Requirement: Full Description and Rules

The system SHALL display the charger's full description (up to 500 chars) and the host's rules (up to 300 chars, optional). If rules are empty, the rules block is hidden.

#### Scenario: Description and rules are shown

- GIVEN a charger with description "Cargador en cochera..." and rules "Pedí el chip por mensaje"
- WHEN the screen renders
- THEN both blocks are visible and word-wrapped

### Requirement: Reservar CTA

The system SHALL display a sticky "Reservar" button at the bottom of the screen. When the user is not signed in, tapping the CTA navigates to login with `returnTo = /charger/{id}`. When signed in, the CTA opens the reservation request sheet (date + time picker; default "Lo antes posible" surfaced first).

#### Scenario: Logged-out user taps Reservar

- GIVEN the user is not signed in
- WHEN the user taps "Reservar"
- THEN the user is navigated to the login screen
- AND after successful sign-in the user returns to this charger

#### Scenario: Logged-in user taps Reservar

- GIVEN the user is signed in
- WHEN the user taps "Reservar"
- THEN the reservation request sheet opens
- AND the user can pick a date + time or choose "Lo antes posible"

## Non-functional notes

- The screen SHALL hydrate via TanStack Query keyed on `charger:${id}` with 60s stale time.
- The screen SHALL show a LoadingState while the query is in-flight and an ErrorState on failure.
- Photo gallery performance: use `expo-image` for caching and progressive loading.
- Tapping the back arrow navigates to the previous screen (Mapa or wherever the user came from).
