# Messaging Specification

## Purpose

Provide 1:1 chat between renter and host, with system-generated messages that reflect reservation state changes. The chat is the negotiation channel in MVP — no in-app payments.

## Requirements

### Requirement: Auth Gate

The system SHALL gate the Mensajes tab. Logged-out users see an EmptyState with an "Iniciá sesión" CTA and `returnTo = /messages`.

#### Scenario: Logged-out user opens Mensajes

- GIVEN the user is not signed in
- WHEN the user taps the Mensajes tab
- THEN the EmptyState renders with copy "Necesitás iniciar sesión para ver tus conversaciones"

### Requirement: Conversation List

The system SHALL render a list of conversations for the signed-in user. Each row shows the other party's avatar, display name, last message preview, and a relative timestamp ("hace 22 min"). A search bar "Buscar conversaciones" filters the list by name.

#### Scenario: User searches for a host

- GIVEN the user has 10 conversations
- WHEN the user types "Mar" in the search bar
- THEN only conversations with matching host names are visible

### Requirement: 1:1 Thread Screen

The system SHALL render a thread screen at `/messages/[threadId]` with: a header (back arrow, other party's avatar + name + "Desconectado" status), a scrollable message list, and an input bar "Escribí un mensaje" with a paper-plane send button.

#### Scenario: User sends a text message

- GIVEN the user is in a 1:1 thread
- WHEN the user types "Ok perfecto" and taps the send button
- THEN a row with `kind = 'user'` and `body = 'Ok perfecto'` is inserted
- AND the message appears immediately in the thread (optimistic)
- AND the server persists it via Supabase Realtime

### Requirement: Message `kind` Enum

The system SHALL tag every message with one of these `kind` values:

| `kind` | Source | Visual |
|--------|--------|--------|
| `user` | Renter or host typed text | Incoming: light gray bubble, left-aligned. Outgoing: orange bubble, right-aligned. |
| `system_reservation_requested` | Generated when a reservation is created | Light gray bubble, left-aligned, mentions charger title |
| `system_reservation_confirmed` | Generated on `solicitada` → `confirmada` | Orange bubble, right-aligned, two-line copy |
| `system_reservation_cancelled` | Generated on any → `cancelada` | Orange bubble, right-aligned, single line |

#### Scenario: System confirmed message is visually distinct

- GIVEN a confirmed reservation
- WHEN the user opens the thread
- THEN the message with `kind = 'system_reservation_confirmed'` renders as an orange right-aligned bubble with copy "Listo! Tu reserva fue confirmada. Chateamos para coordinar."

#### Scenario: User message and system message coexist

- GIVEN a thread with one system request and two user messages
- WHEN the thread renders
- THEN the message list shows the system request at the top in a gray bubble, then the two user messages in correct chronological order

### Requirement: Realtime Updates

The system SHALL subscribe to `INSERT`s on `messages` for the current thread via Supabase Realtime. New messages SHALL appear without a manual refresh.

#### Scenario: Host sends a message while renter is in the thread

- GIVEN the renter is viewing the thread
- WHEN the host inserts a new message
- THEN the renter's UI updates within 2 seconds

### Requirement: Sending is Offline-Safe

The system SHALL queue outgoing messages when offline and flush on reconnect. Each queued message is shown with a `pending` indicator until the server confirms.

#### Scenario: User sends a message while offline

- GIVEN the device is offline
- WHEN the user sends "Estoy en camino"
- THEN the message appears locally with a pending icon
- AND when connectivity returns, the message is sent and the icon disappears

## Non-functional notes

- Messages are paginated 50 at a time; older messages are loaded via infinite scroll.
- The system SHALL NOT send push notifications for chat messages in MVP (deferred to v2.1 — see notifications spec).
- Tap-to-copy on a message is OUT of scope for MVP.
- Read receipts (`✓✓`) are visual only in MVP; no client-side tracking is required beyond rendering.
