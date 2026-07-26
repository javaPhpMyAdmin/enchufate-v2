# Reviews Table Specification

## Purpose

Define the `reviews` table schema, constraints, RLS policies, and denormalization trigger for charger ratings.

## Requirements

### Requirement: Reviews Table Schema

The system SHALL create a `reviews` table with columns: `id` (uuid PK, default `gen_random_uuid()`), `charger_id` (uuid FK → `chargers.id`), `reviewer_id` (uuid FK → `profiles.id`), `reservation_id` (uuid FK → `reservations.id`, UNIQUE), `rating` (int2, NOT NULL, CHECK 1–5), `text` (text, nullable), `created_at` (timestamptz, default `now()`).

#### Scenario: Insert a valid review

- GIVEN a renter with a `completada` reservation for charger X
- WHEN the renter inserts a review with `rating = 4` and `text = 'Muy buen cargador'`
- THEN the row is created with all default fields populated

#### Scenario: Rating out of bounds rejected

- GIVEN a review insert with `rating = 0`
- WHEN the database evaluates the CHECK constraint
- THEN the insert fails with a constraint violation

#### Scenario: Duplicate reservation rejected

- GIVEN a review already exists for reservation R
- WHEN another insert targets `reservation_id = R`
- THEN the insert fails on the UNIQUE constraint

### Requirement: Reviews RLS Policies

The system SHALL enforce RLS on the `reviews` table. Any authenticated user MAY read reviews. Only the renter of a `completada` reservation MAY insert a review for that reservation.

#### Scenario: Renter inserts review on own completed reservation

- GIVEN renter R completed reservation P for charger C
- WHEN R inserts a review with `reservation_id = P`
- THEN the insert succeeds

#### Scenario: Host cannot insert a review on their own charger

- GIVEN host H owns charger C
- WHEN H inserts a review with `charger_id = C`
- THEN the insert is denied by RLS (host is not the renter of any reservation for C)

#### Scenario: Unauthenticated read denied

- GIVEN no active session
- WHEN querying the `reviews` table
- THEN RLS denies access (no matching policy for anonymous users)

#### Scenario: Authenticated user reads all reviews

- GIVEN a signed-in user U
- WHEN querying `reviews` for charger C
- THEN all reviews for charger C are returned

### Requirement: Denormalization Trigger

The system SHALL create a trigger on `reviews` (INSERT, UPDATE, DELETE) that recalculates `AVG(rating)` and `COUNT(*)` for the affected charger and writes the results to `chargers.avg_rating` (numeric, 1 decimal) and `chargers.review_count` (int).

#### Scenario: First review updates charger aggregates

- GIVEN charger C has no reviews
- WHEN a review with `rating = 5` is inserted for C
- THEN `C.avg_rating = 5.0` and `C.review_count = 1`

#### Scenario: Delete recalculates aggregates

- GIVEN charger C has two reviews (ratings 4 and 5)
- WHEN the rating-4 review is deleted
- THEN `C.avg_rating = 5.0` and `C.review_count = 1`

#### Scenario: Update recalculates aggregates

- GIVEN charger C has one review (rating 3)
- WHEN that review is updated to rating 5
- THEN `C.avg_rating = 5.0` and `C.review_count = 1`

### Requirement: Chargers Table Extensions

The system SHALL add `avg_rating` (numeric, default 0) and `review_count` (int, default 0) columns to the `chargers` table.

#### Scenario: New charger has zero aggregates

- GIVEN a newly published charger
- WHEN the charger row is created
- THEN `avg_rating = 0` and `review_count = 0`
