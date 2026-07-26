# Profile Stats Specification

## Purpose

Replace hardcoded stat card values (Rating: `0.0`, Reseñas: `0`) with live aggregated data from the charger reviews system.

## Requirements

### Requirement: Live Rating Stat Card

The system SHALL replace the hardcoded "0.0" Rating stat card with the average rating across all chargers owned by the current user. The value is derived from `chargers.avg_rating` for chargers where `owner_id = current user`.

#### Scenario: Host with rated chargers

- GIVEN host H owns 2 chargers with `avg_rating` values of 4.0 and 4.5
- WHEN the Profile tab renders
- THEN the Rating card shows "4.3" (rounded to 1 decimal)

#### Scenario: Host with no reviews

- GIVEN host H owns 1 charger with `avg_rating = 0`
- WHEN the Profile tab renders
- THEN the Rating card shows "0.0"

#### Scenario: Host with no chargers

- GIVEN host H owns 0 chargers
- WHEN the Profile tab renders
- THEN the Rating card shows "0.0"

### Requirement: Live Reseñas Count Stat Card

The system SHALL replace the hardcoded "0" Reseñas stat card with the total review count across all chargers owned by the current user. The value is derived from `chargers.review_count` for chargers where `owner_id = current user`.

#### Scenario: Host with reviewed chargers

- GIVEN host H owns 2 chargers with `review_count` values of 5 and 3
- WHEN the Profile tab renders
- THEN the Reseñas card shows "8"

#### Scenario: Host with no reviews

- GIVEN host H owns 1 charger with `review_count = 0`
- WHEN the Profile tab renders
- THEN the Reseñas card shows "0"

### Requirement: Stats Query

The system SHALL fetch profile stats via a dedicated query (keyed on `profile-stats:${userId}`) that aggregates `avg_rating` and `review_count` from the user's chargers. The query SHALL use TanStack Query with 60s stale time.

#### Scenario: Stats update after new review

- GIVEN host H has 0 reviews
- WHEN a guest submits a review on H's charger
- THEN the next Profile tab render shows updated Rating and Reseñas values

#### Scenario: Query error preserves previous values

- GIVEN the stats query previously succeeded
- WHEN the query refetch fails
- THEN the stat cards show the last known values (stale-while-revalidate)

### Requirement: Feature Gate

The system SHALL only show live review stats when `CHARGER_REVIEWS` is enabled. When disabled, the cards SHALL show the hardcoded MVP values (`0.0` and `0`).

#### Scenario: Flag disabled shows placeholders

- GIVEN `CHARGER_REVIEWS` is `false`
- WHEN the Profile tab renders
- THEN Rating shows "0.0" and Reseñas shows "0"
