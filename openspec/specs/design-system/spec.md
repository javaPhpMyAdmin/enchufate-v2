<!-- Merged from mvp-bootstrap change on 2026-07-19 -->
# Design System Specification

## Purpose

Provide the visual language for enchufate-V2: a tokenized set of design primitives and shared component states. Every screen SHALL compose from these tokens and primitives — no ad-hoc styling.

## Requirements

### Requirement: Design Tokens

The system SHALL expose the following tokens in `src/theme/`:

| Group | Tokens |
|-------|--------|
| Color | `primary` (#FF6B1F), `primary.disabled`, `primary.subtle`, `text.primary`, `text.secondary`, `text.onPrimary`, `success`, `danger`, `surface`, `background`, `border`, `info.bg`, `info.text` |
| Spacing | 4 / 8 / 12 / 16 / 20 / 24 / 32 |
| Radius | `card` 16, `button` 12, `chip` pill, `input` 12 |
| Typography | `display` 24, `title` 22, `heading` 18, `body` 16, `caption` 14, `tab` 12 (weights: regular, medium, semibold, bold) |

#### Scenario: Token usage in a screen

- GIVEN a developer imports tokens from `src/theme`
- WHEN they reference `colors.primary` and `radius.button`
- THEN the rendered UI uses the documented hex value and 12pt radius

### Requirement: Button Primitive

The system SHALL provide a `Button` with `primary`, `secondary`, and `text` variants. Width adapts: `100%` inside forms, `~150pt` on success screens, `auto` elsewhere. Disabled state uses `primary.disabled`.

#### Scenario: Primary button in enabled and disabled state

- GIVEN a login form with an empty email field
- WHEN the screen renders
- THEN "Iniciar sesión" is shown with the disabled peach color
- AND when the email becomes valid, the button switches to full orange

### Requirement: Card, Input, Chip, StatusPill, BetaBanner, FAB Primitives

The system SHALL provide:

- `Card` — 16pt radius, white fill, subtle shadow.
- `Input` — 12pt radius, 1pt gray border, 16pt text, optional show/hide for password.
- `Chip` — pill shape; selected = orange fill + white text; unselected = light gray fill + dark text.
- `StatusPill` — rounded rect, light tint bg + colored dot + colored text. Variants: `success` (Confirmada / Disponible), `danger` (Cancelada).
- `BetaBanner` — light blue bg, sparkle icon, 12pt radius, persistent across the Publicar wizard.
- `FAB` — circular, peach fill, centered icon, anchored bottom-right on Mapa.

#### Scenario: StatusPill variant rendering

- GIVEN a reservation with `status = 'confirmada'`
- WHEN the pill renders
- THEN it shows a green outline, green dot, and "Confirmada" text in `color.success`

### Requirement: Loading, Empty, and Error States

The system SHALL provide `LoadingState`, `EmptyState`, and `ErrorState` components for use on every list-bearing screen. Each accepts an icon, title, optional body, and optional CTA.

#### Scenario: Empty state on Reservas tab when not logged in

- GIVEN the user is logged out and taps the Reservas tab
- WHEN the screen renders
- THEN the EmptyState shows "Necesitás iniciar sesión para ver tus reservas"
- AND an orange "Iniciá sesión" CTA is shown

## Non-functional notes

- All copy in this app is Rioplatense Spanish voseo; no neutral Spanish.
- All primitives SHALL be implemented with accessibility labels and minimum 44×44pt touch targets.
- Light theme only for MVP; dark theme is out of scope.
- Reanimated 3 (NOT 4) for any animations; Expo Go crashes on Reanimated 4.
