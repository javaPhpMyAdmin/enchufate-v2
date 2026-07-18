# Charger Publish Specification

## Purpose

The Publicar wizard lets a host publish a new charger in 7 steps. It is auth-gated and uses the native image picker for photos. Step 6 (Horario / Disponibilidad) is per-day availability windows.

## Requirements

### Requirement: Auth Gate

The system SHALL redirect any unauthenticated user to the login screen with `returnTo = /publish/1-name` when they enter the wizard. Step progress is NOT preserved across login in MVP.

#### Scenario: Logged-out user enters Publicar from Inicio

- GIVEN the user is not signed in
- WHEN the user taps "Publicar mi cargador" on Inicio
- THEN the user is sent to the login screen
- AND on successful sign-in the user lands on step 1 of the wizard

### Requirement: Persistent Beta Banner

The system SHALL render the BetaBanner at the top of every wizard step. The banner reads: "Publicar es gratis durante la beta".

#### Scenario: Banner visible across steps

- GIVEN the user is on any step of the wizard
- WHEN the screen renders
- THEN the BetaBanner is visible at the top

### Requirement: Step 1 — Nombre y descripción

Fields:

| Field | Type | Validation |
|-------|------|------------|
| Título | string | required, 1–80 chars |
| Descripción | string | required, max 500 chars, with live counter `n/500` |

Primary CTA label: "Siguiente" (disabled until both fields are valid).

#### Scenario: Description counter updates as user types

- GIVEN the user has typed 17 characters in the description
- WHEN the screen re-renders
- THEN the counter shows "17/500"

### Requirement: Step 2 — Ubicación

The system SHALL auto-detect the device location and reverse-geocode it to a human-readable address. The user MAY edit the address manually.

Location permission is requested ONLY on this step (not at app start). If permission is denied, the user is asked to type the address manually.

#### Scenario: Location is auto-detected

- GIVEN location permission is granted
- WHEN the user reaches step 2
- THEN the "Ubicación detectada" card shows lat/lng and a reverse-geocoded address

#### Scenario: Location denied, manual entry

- GIVEN location permission is denied
- WHEN the user reaches step 2
- THEN a manual address field is shown with a helper: "Escribí la dirección manualmente"

### Requirement: Step 3 — Conector y potencia

Fields:

| Field | Type | Validation |
|-------|------|------------|
| Conector | enum (single select) | required, one of: `tipo_1`, `tipo_2`, `ccs`, `chademo`, `tesla` |
| Potencia (kW) | number | required, range 3.7–350, helper "Entre 3.7 y 350 kW" |

#### Scenario: User selects Tipo 2 and enters 22 kW

- GIVEN step 3
- WHEN the user picks "Tipo 2" and enters `22`
- THEN both fields are valid and "Siguiente" is enabled

### Requirement: Step 4 — Fotos

The system SHALL allow up to 5 photos via the native image picker (`expo-image-picker`). Photos are displayed in a 2-column grid with a red `X` delete button and an "Agregar" placeholder. A live counter `N de 5 seleccionadas` is shown.

#### Scenario: User picks 4 photos

- GIVEN the user taps "Agregar" and selects 4 photos from the device library
- WHEN the grid re-renders
- THEN 4 thumbnails are shown, the counter reads "4 de 5 seleccionadas", and the "Agregar" placeholder remains

### Requirement: Step 5 — Precio y tiempo mínimo

Fields:

| Field | Type | Validation |
|-------|------|------------|
| Precio por hora (USD) | number | required, > 0, prefix `USD`, suffix `/ hora` |
| Tiempo mínimo de reserva | enum | required, one of: `30`, `60`, `120`, `240`, `480` minutes (default 30) |

#### Scenario: Default minimum reservation

- GIVEN step 5 on first render
- WHEN the screen mounts
- THEN "30 min" is pre-selected in the chip group

### Requirement: Step 6 — Horario / Disponibilidad (per-day windows)

Fields: 7 day-of-week toggles (Lun–Dom), each with an optional time range (`start_time`, `end_time`). Default for every day: 24/7 (always available). The host MAY override any day to a custom window or mark it unavailable.

| Day | Default | Override options |
|-----|---------|------------------|
| Lunes a Domingo | 00:00 – 23:59 (always) | Custom HH:MM–HH:MM range, or "No disponible" |

#### Scenario: Owner restricts Sunday to 09:00–18:00

- GIVEN step 6
- WHEN the user sets Domingo to "09:00 – 18:00" and saves
- THEN the persisted schedule encodes that window
- AND the charger is bookable on Sunday only inside that window

### Requirement: Step 7 — Reglas del propietario

Optional textarea, placeholder "Ej: Pedí el chip de acceso por mensaje antes de llegar.", live counter `0/300`. Primary CTA label changes from "Siguiente" to "Publicar".

#### Scenario: User publishes with no rules

- GIVEN the user has filled all previous steps and leaves rules empty
- WHEN the user taps "Publicar"
- THEN the charger is created with `rules = null`
- AND the success screen renders

### Requirement: Success Screen

The system SHALL navigate to `/publish/success` after a successful create. The screen shows a check circle, "Cargador publicado", body copy "Tu cargador ya es visible en el mapa. Te avisaremos cuando alguien reserve.", and a "Ir a Mis cargadores" CTA that navigates to `/profile/my-chargers`.

#### Scenario: User lands on success after publish

- GIVEN a successful charger creation
- WHEN the success screen renders
- THEN "Ir a Mis cargadores" returns the user to their profile-owned list

## Non-functional notes

- Each step SHALL validate on blur and on "Siguiente" tap; errors are shown inline.
- The wizard SHALL preserve in-progress state in a Zustand store so accidental back navigation does not lose data within the same session.
- The wizard SHALL NOT allow skipping required fields; "Siguiente" stays disabled until the current step is valid.
- All photos MUST be uploaded via Supabase Storage with RLS limiting access to the charger owner.
- Reanimated 3 is used for step transition animations; Reanimated 4 is forbidden.
