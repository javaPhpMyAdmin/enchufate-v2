<!-- Merged from mvp-bootstrap change on 2026-07-19 -->
# Profile Specification

## Purpose

Show the user identity and owned-charger inventory. The Perfil tab has two distinct states: empty (logged-out) and authenticated (logged-in).

## Requirements

### Requirement: Auth Gate

The system SHALL gate the Perfil tab. Logged-out users see the EmptyState described below; the EmptyState's CTA navigates to the login screen with `returnTo = /profile`.

### Requirement: Empty State

The system SHALL render a circular avatar placeholder with "CE" initials, a "Bienvenido" title, body copy "Iniciá sesión para gestionar tu cuenta, ver tus reservas y publicar tu cargador.", and a full-width orange "Iniciá sesión" button.

#### Scenario: Logged-out user opens Perfil

- GIVEN the user is not signed in
- WHEN the Perfil tab renders
- THEN the EmptyState is shown
- AND tapping "Iniciá sesión" navigates to the login screen

### Requirement: Authenticated Header

When the user is signed in, the system SHALL render:

- Avatar (user photo or initials fallback)
- Display name
- "Miembro desde {month} de {year}" (derived from `profiles.created_at`)

#### Scenario: Authenticated header renders member-since

- GIVEN a user who joined in March 2024
- WHEN the Perfil tab renders
- THEN "Miembro desde marzo de 2024" is visible

### Requirement: Three Stat Cards

The system SHALL render three stat cards in a row: Rating, Reseñas, Cargadores. Icons: star, chat, lightning bolt. For MVP, Rating and Reseñas show `0.0` and `0` respectively (no review system yet); Cargadores shows the count of chargers owned by the user.

| Stat | Source | MVP value |
|------|--------|-----------|
| Rating | placeholder | `0.0` |
| Reseñas | placeholder | `0` |
| Cargadores | `chargers` where `owner_id = current user` | live count |

#### Scenario: User with 3 chargers sees 3 in the third card

- GIVEN a user owns 3 chargers
- WHEN the Perfil tab renders
- THEN the third stat card displays `3`

### Requirement: Mis Cargadores Section

The system SHALL render a "Mis cargadores" section header with an orange "Publicar nuevo" pill that navigates to `/publish/1-name`. Below, a list of owned chargers each showing photo, title, address, power, connector, price, and a status pill. A 3-dot menu is shown but disabled in MVP (edit/delete deferred to v2.1).

#### Scenario: User taps Publicar nuevo

- GIVEN the user is on the Perfil tab
- WHEN the user taps "Publicar nuevo"
- THEN the wizard step 1 is opened

#### Scenario: User with 0 chargers sees an empty hint

- GIVEN the user owns no chargers
- WHEN the Mis cargadores section renders
- THEN a hint "Todavía no publicaste cargadores" is shown above the list area

### Requirement: Sign Out

The system SHALL provide a "Cerrar sesión" action at the bottom of the authenticated profile. Tapping it ends the session and clears the TanStack Query cache.

#### Scenario: User signs out

- GIVEN the user is signed in and on the Perfil tab
- WHEN the user taps "Cerrar sesión"
- THEN the session ends
- AND the screen returns to the EmptyState

## Non-functional notes

- The Perfil screen SHALL NOT request location permission (location is requested only on Mapa entry and Publicar step 2).
- A 3-dot menu is shown next to each charger in Mis cargadores but is disabled in MVP; this is a v2.1 affordance.
- All copy is Rioplatense Spanish voseo (e.g. "Iniciá sesión", "Publicá tu cargador").
- The screen SHALL re-fetch the charger count via TanStack Query when the user returns from a successful publish.
