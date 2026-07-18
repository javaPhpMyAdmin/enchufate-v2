# Home Specification

## Purpose

The Inicio tab acts as the brand entry surface for enchufate-V2, presenting a hero image and two primary calls-to-action: find a charger (renter) or publish a charger (host). This tab is public — no auth required.

## Requirements

### Requirement: Brand Header

The system SHALL render the "Enchufate" wordmark in bold (~24pt) at the top of the screen, followed by the full-width hero image (`home_card_.png` asset).

#### Scenario: Inicio renders for a logged-out user

- GIVEN the user is on the Inicio tab and is not signed in
- WHEN the screen renders
- THEN the wordmark and hero are visible
- AND no account-related UI is shown

### Requirement: Two Primary CTAs

The system SHALL render two CTA cards in this order:

1. **Buscar un cargador** — title, subtitle "Encontrá estaciones cerca de ti", white card.
2. **Publicar mi cargador** — full-width orange card, title, subtitle "Ganá dinero compartiendo tu punto".

Tapping "Buscar un cargador" navigates to the Mapa tab. Tapping "Publicar mi cargador" navigates to the Publicar wizard (auth-gated; if logged out, navigate to login with `returnTo = '/publish/1-name'`).

#### Scenario: Logged-out user taps Publicar mi cargador

- GIVEN the user is not signed in
- WHEN the user taps the orange Publicar CTA
- THEN the user is navigated to the login screen
- AND the login screen promises a return to the first wizard step on success

#### Scenario: Logged-in user taps Publicar mi cargador

- GIVEN the user is signed in
- WHEN the user taps the orange Publicar CTA
- THEN the first step of the wizard is opened

### Requirement: No Persistent User Data

The Inicio screen SHALL NOT display the user's name, avatar, or any session-bound content. It is a brand surface, not a dashboard.

#### Scenario: Inicio is identical for all logged-out users

- GIVEN two different logged-out sessions
- WHEN each renders Inicio
- THEN the rendered screen is byte-identical (no personalization)

## Non-functional notes

- The screen SHALL render within 200ms on a warm start (cached assets, no network).
- The hero image SHALL be lazy-loaded with a placeholder color while decoding.
- No location permission is requested on this tab.
