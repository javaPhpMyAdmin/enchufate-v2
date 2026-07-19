<!-- Merged from mvp-bootstrap change on 2026-07-19 -->
# Notifications Specification

## Purpose

Send a single push notification in MVP: "Tu reserva fue confirmada" — fired when a host confirms a reservation. The push is the user-facing counterpart of the system message injected into the chat.

## Requirements

### Requirement: Reservation Confirmed Push

The system SHALL send a push notification to the renter when their reservation transitions from `solicitada` to `confirmada`. The notification title is "Reserva confirmada" and the body is "Tu reserva en {charger_title} fue confirmada. Chateá para coordinar."

#### Scenario: Host confirms a reservation

- GIVEN a reservation with `status = 'solicitada'` and a renter who has a push token
- WHEN the host confirms the reservation
- THEN the system sends a push notification to the renter's device
- AND the notification, when tapped, deep-links to `/reservation/{id}`

#### Scenario: Renter without push token still sees the system message

- GIVEN a renter who has not granted push permission
- WHEN the host confirms the reservation
- THEN no push is sent
- AND the `system_reservation_confirmed` chat message is still injected

### Requirement: APNs and FCM Transport

The system SHALL register the device with APNs (iOS) and FCM (Android) on first launch and persist the resulting push token on the `profiles` row.

#### Scenario: Device registers a push token

- GIVEN a signed-in user on a fresh install
- WHEN the app finishes onboarding
- THEN the device token is written to `profiles.push_token`

### Requirement: Chat Notifications Deferred

The system SHALL NOT send push notifications for new chat messages in MVP. This is deferred to v2.1.

#### Scenario: New chat message does not trigger a push

- GIVEN the renter is signed in with a push token
- WHEN the host sends a new chat message
- THEN no push notification is sent
- AND the message is delivered via realtime channel only

## Non-functional notes

- Push provider credentials (APNs key + FCM service account) are provisioned during the polish phase of the rollout; the reservation lifecycle MUST work without push enabled.
- The push trigger is server-side: a Supabase function listens to the reservation state change and dispatches via the configured provider.
- Deep-link payload format: `{ reservation_id: string }`. The client routes to `/reservation/{id}`.
- Notification preferences screen is OUT of scope for MVP (deferred to v2.1).
