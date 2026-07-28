# Review Creation Specification

## Purpose

Allow renters to submit a review after a completed reservation via a dedicated CTA and form.

## Requirements

### Requirement: Review CTA on Completed Reservations

The system SHALL display a "Dejar reseña" button on `completada` reservation cards in the renter's "Mis reservas" list. The button is visible only when the current user is the renter AND no review exists for that reservation.

#### Scenario: Renter sees CTA on completed reservation

- GIVEN renter R has a `completada` reservation P with no review
- WHEN R views "Mis reservas"
- THEN reservation P shows a "Dejar reseña" button

#### Scenario: Host does not see CTA

- GIVEN host H has a `completada` reservation on their charger
- WHEN H views "En mis cargadores"
- THEN no "Dejar reseña" button appears

#### Scenario: CTA hidden after review submitted

- GIVEN renter R has a `completada` reservation P with an existing review
- WHEN R views "Mis reservas"
- THEN reservation P does not show the "Dejar reseña" button

#### Scenario: Non-completed reservation has no CTA

- GIVEN renter R has a `confirmada` reservation
- WHEN R views "Mis reservas"
- THEN no "Dejar reseña" button appears

### Requirement: Review Form

The system SHALL open a bottom sheet form when the user taps "Dejar reseña". The form contains: a star picker (1–5, default 5, tap to select), an optional text input (max 1000 chars, placeholder "Contanos tu experiencia…"), and a "Enviar reseña" submit button.

#### Scenario: User submits rating only

- GIVEN the form is open with rating = 4, text is empty
- WHEN the user taps "Enviar reseña"
- THEN a review is created with `rating = 4` and `text = null`

#### Scenario: User submits rating + text

- GIVEN the form is open with rating = 5, text = "Excelente carga"
- WHEN the user taps "Enviar reseña"
- THEN a review is created with `rating = 5` and `text = "Excelente carga"`

#### Scenario: Text exceeds 1000 chars is rejected

- GIVEN the form has 1001 characters of text
- WHEN the user taps "Enviar reseña"
- THEN a validation error appears and no review is created

### Requirement: Submit Validation

The system SHALL validate before submit: (1) reservation is `completada`, (2) current user is the renter, (3) no review already exists for this reservation. Failure to validate SHALL show an inline error and prevent submission.

#### Scenario: Duplicate review attempt

- GIVEN a review already exists for reservation P
- WHEN the renter taps "Enviar reseña" for P
- THEN the mutation is rejected and the user sees "Ya dejaste una reseña para esta reserva"

#### Scenario: Network error on submit

- GIVEN the mutation fails due to a network error
- WHEN the user taps "Enviar reseña"
- THEN the error is wrapped via `normalizeSupabaseError` and `error.userMessage` is displayed

### Requirement: Post-Submit Behavior

The system SHALL, on successful submission: (1) close the form, (2) show a success toast "¡Reseña enviada!", (3) invalidate query keys `charger-reviews:{id}`, `charger-rating:{id}`, and `profile-stats`.

#### Scenario: Successful submit updates UI

- GIVEN a valid review form
- WHEN the mutation succeeds
- THEN the bottom sheet closes
- AND the charger detail shows the new review
- AND the reservation card no longer shows "Dejar reseña"

### Requirement: Feature Gate

The system SHALL only render the "Dejar reseña" CTA when `CHARGER_REVIEWS` is enabled.

#### Scenario: Flag disabled hides CTA

- GIVEN `CHARGER_REVIEWS` is `false`
- WHEN a renter views a `completada` reservation
- THEN no review CTA or form is available
