<!-- Merged from edit-charger change on 2026-07-28 -->
# Charger Edit Specification

## Purpose

Allow hosts to edit their published chargers via a single-screen form. The edit screen fetches current charger data, pre-fills all fields, validates using the shared Zod schemas, and saves via Supabase update plus photo storage operations.

## Requirements

### Requirement: Edit Screen Access

The system SHALL provide a single-screen edit form at `app/edit-charger/[id].tsx`. The screen is accessible only to the charger owner. Non-owners MUST NOT see any edit affordance.

#### Scenario: Owner opens edit screen

- GIVEN the user is the charger owner
- WHEN the user navigates to `/edit-charger/{id}`
- THEN the edit form loads with all fields pre-filled from the fetched charger data

#### Scenario: Non-owner attempts direct navigation

- GIVEN the user is not the charger owner
- WHEN the user navigates to `/edit-charger/{id}`
- THEN the system navigates away or shows an error; no edit form is rendered

### Requirement: Pre-filled Fields

The system SHALL pre-fill every editable field from the fetched charger data: title, description, address, connector type, power (kW), price per hour (USD), minimum reservation time, rules, and schedule. The `status` field MUST NOT be editable.

#### Scenario: All fields reflect saved values

- GIVEN a charger with title "Cochera Centro", connector `tipo_2`, power 22 kW, price $8/hr
- WHEN the edit form renders
- THEN each field displays the corresponding saved value

### Requirement: Field Validation

The system SHALL validate all fields using the rules from `chargerSchema` in `src/lib/schemas/charger.ts`. Validation runs on blur and on save. Inline errors use the Spanish messages defined in the Zod schema.

| Field | Type | Validation |
|-------|------|------------|
| Título | string | required, 1–80 chars |
| Descripción | string | optional, max 500 chars, live counter |
| Dirección | string | required |
| Conector | enum | required, one of: `tipo_1`, `tipo_2`, `ccs`, `chademo`, `tesla` |
| Potencia (kW) | number | required, 3.7–350 |
| Precio/hora (USD) | number | required, > 0 |
| Tiempo mínimo | enum | required, one of: 30, 60, 120, 240, 480 min |
| Reglas | string \| null | optional, max 300 chars, live counter |
| Horario | jsonb | required, 7-day schedule with per-day windows |

#### Scenario: Validation blocks save on invalid data

- GIVEN the user clears the title field
- WHEN the user taps "Guardar"
- THEN the save is blocked and an inline error "El título es obligatorio" is shown

#### Scenario: Valid form allows save

- GIVEN all required fields are valid
- WHEN the user taps "Guardar"
- THEN the mutation fires

### Requirement: Photo Management

The system SHALL display existing photos as thumbnails with a delete action. The user MAY add new photos via the native image picker. Total photos MUST NOT exceed 5. Photo deletions remove the file from Supabase Storage on save; new photos upload to the charger's storage path on save.

#### Scenario: User removes a photo and adds another

- GIVEN the charger has 3 photos and the user removes 1
- WHEN the user adds 2 new photos
- THEN the thumbnail grid shows 4 photos and the counter reads "4 de 5"

#### Scenario: Photo limit enforced

- GIVEN the charger has 5 photos
- WHEN the user tries to add another
- THEN the "Agregar" action is hidden or disabled

### Requirement: Save Mutation

The system SHALL persist changes via `useUpdateCharger` which wraps `supabase.from('chargers').update()`. On success, the system SHALL invalidate query keys `['charger', id]`, `['chargers']`, and `['my-chargers', userId]` and navigate back.

#### Scenario: Successful save

- GIVEN the user modified the price and tapped "Guardar"
- WHEN the mutation succeeds
- THEN the system navigates back and the detail screen shows the updated price

#### Scenario: Network error on save

- GIVEN the device has no network
- WHEN the user taps "Guardar"
- THEN an error state is shown with `error.userMessage` and the user remains on the form

### Requirement: Photo Upload and Delete on Save

The system SHALL batch photo operations: deletions remove files from Supabase Storage, additions upload new files, and the photos array is updated in a single update call. Photo operations MUST be idempotent — retrying after a partial failure does not duplicate uploads.

#### Scenario: Photo replacement

- GIVEN the user deletes 1 photo and adds 1 photo
- WHEN "Guardar" is tapped
- THEN the old photo is removed from Storage, the new photo is uploaded, and the charger record reflects the updated photos array

### Requirement: Loading and Error States

The system SHALL show a loading indicator while the charger data is being fetched. On fetch failure, the system SHALL show an error state. While the save mutation is pending, the "Guardar" button MUST be disabled.

#### Scenario: Charger fetch in progress

- GIVEN the user navigates to the edit screen
- WHEN the TanStack Query is in-flight
- THEN a loading indicator is displayed instead of the form

## Non-functional notes

- The screen SHALL reuse `chargerSchema` fields from `src/lib/schemas/charger.ts` — same validation as publish, different UX.
- Query invalidation MUST cover all keys that cache charger data to prevent stale reads.
- All copy is Rioplatense Spanish voseo; code and identifiers in English.
