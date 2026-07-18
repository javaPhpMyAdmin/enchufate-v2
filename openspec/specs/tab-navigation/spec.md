# Tab Navigation Specification

## Purpose

Define the bottom 5-tab navigation bar (Inicio · Mapa · Mensajes · Reservas · Perfil) and the per-tab auth gate that distinguishes public from authenticated surfaces.

## Requirements

### Requirement: Five-Tab Structure

The system SHALL render a bottom tab bar with exactly five tabs in this order: Inicio, Mapa, Mensajes, Reservas, Perfil. The active tab is shown in `color.primary`; inactive tabs in dark gray.

#### Scenario: Tab bar renders on a public surface

- GIVEN a logged-out user on the Inicio screen
- WHEN the screen renders
- THEN the tab bar shows all five tabs with Inicio marked active

#### Scenario: Tab bar hidden on full-screen flows

- GIVEN the user enters the Mensajes 1:1 thread OR the Publicar wizard
- WHEN the screen renders
- THEN the tab bar is not visible (the screen owns its own back navigation)

### Requirement: Per-Tab Auth Gate

The system SHALL allow public access to the Inicio and Mapa tabs. The system SHALL gate the Mensajes, Reservas, and Perfil tabs: when `session === null`, the tab content renders an EmptyState with an "Iniciá sesión" CTA instead of protected content.

| Tab | Auth required |
|-----|---------------|
| Inicio | No |
| Mapa | No |
| Mensajes | Yes |
| Reservas | Yes |
| Perfil | Yes |

#### Scenario: Logged-out user opens Reservas

- GIVEN the user is logged out
- WHEN the user taps the Reservas tab
- THEN the tab content shows "Necesitás iniciar sesión para ver tus reservas"
- AND an orange "Iniciá sesión" CTA is shown
- AND tapping the CTA navigates to the login screen with `returnTo = '/reservations'`

#### Scenario: Logged-in user opens Reservas

- GIVEN the user is signed in
- WHEN the user taps the Reservas tab
- THEN the tab content shows the segmented Mis reservas / En mis cargadores list

### Requirement: Active Tab State Persistence

The system SHALL preserve the active tab across navigation and re-renders. The system SHALL NOT reset to Inicio when the user returns from a deep link or after sign-in.

#### Scenario: User returns from deep link

- GIVEN the user is on the Mensajes tab
- WHEN the user opens a deep link to a charger detail and returns
- THEN the active tab is still Mensajes

## Non-functional notes

- The tab bar SHALL respect iOS safe-area inset for the home indicator.
- Tab transitions use the platform default (no custom animation) for MVP.
- The `useRequireAuth(returnTo)` hook centralizes the gate; never inline this check in screens.
