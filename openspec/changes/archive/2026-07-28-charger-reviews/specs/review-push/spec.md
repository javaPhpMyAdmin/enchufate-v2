# Review Push Notification Specification

## Purpose

Notify the renter via push notification when a reservation completes, prompting them to leave a review.

## Requirements

### Requirement: Completion Push Notification

The system SHALL send a push notification to the renter when their reservation transitions to `completada`. The notification title is "Reserva completada" and the body is "¿Cómo fue tu carga en {charger_title}? Dejanos tu review".

#### Scenario: Reservation completes and renter has push token

- GIVEN renter R has a reservation P with `start_at` and `end_at` in the past
- WHEN the `completada` DB trigger fires
- THEN a push notification is sent to R's device
- AND the notification body includes the charger title

#### Scenario: Renter without push token

- GIVEN renter R has not granted push permission
- WHEN the reservation transitions to `completada`
- THEN no push notification is sent
- AND the reservation still transitions to `completada`

### Requirement: Deep Link to Review

The system SHALL set the push notification's deep link to `/reservation/{id}` so the renter lands on the reservation detail where the "Dejar reseña" CTA is available.

#### Scenario: Tap notification opens reservation detail

- GIVEN the renter receives a completion push notification
- WHEN the renter taps the notification
- THEN the app opens to `/reservation/{id}` for the completed reservation

### Requirement: One Notification Per Completion

The system SHALL send at most one review-prompt notification per reservation. The notification is triggered by the `completada` transition, not by any subsequent update.

#### Scenario: No duplicate notifications

- GIVEN a reservation that is already `completada`
- WHEN no state change occurs
- THEN no additional notification is sent

### Requirement: Feature Gate

The system SHALL only send the review-prompt notification when `CHARGER_REVIEWS` is enabled.

#### Scenario: Flag disabled suppresses notification

- GIVEN `CHARGER_REVIEWS` is `false`
- WHEN a reservation transitions to `completada`
- THEN no review-prompt notification is sent
