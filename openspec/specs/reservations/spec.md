<!-- Merged from mvp-bootstrap change on 2026-07-19 -->
# Reservations Specification

## Purpose

Manage the reservation lifecycle (request → confirm → cancel) and expose two views of the data: renter-facing "Mis reservas" and host-facing "En mis cargadores". State transitions inject system messages into the chat thread.

## Requirements

### Requirement: Auth Gate

The system SHALL gate the Reservas tab. Logged-out users see an EmptyState with an "Iniciá sesión" CTA and `returnTo = /reservations`.

#### Scenario: Logged-out user opens Reservas

- GIVEN the user is not signed in
- WHEN the user taps the Reservas tab
- THEN the EmptyState renders with copy "Necesitás iniciar sesión para ver tus reservas"

### Requirement: Two-Tab Segmented List

The system SHALL render a segmented control with two tabs: **Mis reservas** (renter view) and **En mis cargadores** (host view). Each list shows reservation cards sorted by date descending.

Each card displays: status pill (top-left), date (top-right), charger title, truncated address, time block (`Horario a coordinar` text or `start_at – end_at`), and power (`⚡ NkW`).

| Field | Source |
|-------|--------|
| Status pill | `reservations.status` |
| Date | `reservations.start_at` (or `created_at` fallback) |
| Charger title | joined from `chargers.title` |
| Address | joined from `chargers.address` |
| Time block | `start_at – end_at` if both set; else `horario_a_coordinar` text |
| Power | joined from `chargers.power_kw` |

#### Scenario: Renter sees one Confirmada and one Cancelada

- GIVEN the renter has one confirmed and one cancelled reservation
- WHEN the Mis reservas tab renders
- THEN the list shows both cards with the matching colored status pills

#### Scenario: Host sees the guest's name

- GIVEN the host has one incoming reservation from "Marcelo"
- WHEN the En mis cargadores tab renders
- THEN the card shows "Marcelo Batista" with a green `M` avatar below the address

### Requirement: Reservation State Machine

The system SHALL enforce the following states and transitions:

| From | To | Trigger | Actor |
|------|----|---------|-------|
| (none) | `solicitada` | Renter taps "Reservar" and submits the request sheet | Renter |
| `solicitada` | `confirmada` | Host taps "Confirmar" from the chat thread or the host reservation card | Host |
| `confirmada` | `cancelada` | Either party taps "Cancelar" and confirms the modal | Renter or Host |
| `solicitada` | `cancelada` | Renter taps "Cancelar" before host confirmation | Renter |

Terminal state: `cancelada`. There is no path back from `cancelada` or `confirmada` except by creating a new reservation.

#### Scenario: Renter requests a reservation

- GIVEN the renter is on a charger detail
- WHEN the renter submits the request sheet
- THEN a `reservations` row is created with `status = 'solicitada'`
- AND the chat thread receives a `system_reservation_requested` message (see messaging spec)

#### Scenario: Host confirms a solicitud

- GIVEN a reservation with `status = 'solicitada'`
- WHEN the host taps "Confirmar"
- THEN `status` becomes `confirmada`
- AND the chat thread receives a `system_reservation_confirmed` message
- AND the renter receives a push notification "Tu reserva fue confirmada" (see notifications spec)

### Requirement: Reservation Detail Screen

The system SHALL navigate to `/reservation/[id]` when a user taps a reservation card. The detail screen shows the charger (with link to charger detail), the other party's name, the time block, the status, and a "Chatear" CTA that opens the corresponding 1:1 thread.

#### Scenario: Tap on a reservation card

- GIVEN a logged-in user taps a Confirmada card on Mis reservas
- WHEN the navigation completes
- THEN the detail screen renders with the charger info, the host's name, and a "Chatear" button

### Requirement: Cancel with Confirmation Modal

The system SHALL show a confirmation modal before any cancel action. The modal copy is "¿Cancelar la reserva de Cargador {title}?" with two actions: `Cancelar` (closes modal) and `Cancelar y volver` (commits the cancel).

#### Scenario: User confirms cancel

- GIVEN a Confirmada reservation
- WHEN the user taps "Cancelar" and then "Cancelar y volver" in the modal
- THEN `status` becomes `cancelada`
- AND the chat thread receives a `system_reservation_cancelled` message
- AND the card updates to show the Cancelada pill

#### Scenario: User dismisses the modal

- GIVEN a Confirmada reservation
- WHEN the user taps "Cancelar" and then "Cancelar" in the modal
- THEN the modal closes
- AND the reservation status is unchanged

### Requirement: System Message Injection on State Change

The system SHALL inject a system message into the corresponding conversation on every state transition. The mapping is:

| State transition | Injected `kind` value | Spanish copy |
|------------------|----------------------|--------------|
| request created | `system_reservation_requested` | "Hola, me gustaría reservar tu cargador {charger_title}" |
| `solicitada` → `confirmada` | `system_reservation_confirmed` | "Listo! Tu reserva fue confirmada. Chateamos para coordinar." |
| any → `cancelada` | `system_reservation_cancelled` | "La reserva fue cancelada." |

#### Scenario: Confirm injects confirmed message

- GIVEN a solicitada reservation
- WHEN the host confirms
- THEN a single message with `kind = 'system_reservation_confirmed'` is inserted into `messages`
- AND the message appears in the chat thread for both parties immediately

## Non-functional notes

- Reservation state transitions are server-authoritative; the client optimistically updates the UI but rolls back on Supabase error.
- Cancelled reservations are never deleted; they remain visible with the Cancelada pill for the audit trail.
- "Horario a coordinar" is stored as a free-text field; structured `start_at` / `end_at` are optional ISO columns.
- A reservation that violates the charger's per-day availability window SHALL be rejected at request time with a clear error.
- Time storage supports BOTH: optional `start_at` / `end_at` ISO columns and free-text `horario_a_coordinar` (Q5 default).
