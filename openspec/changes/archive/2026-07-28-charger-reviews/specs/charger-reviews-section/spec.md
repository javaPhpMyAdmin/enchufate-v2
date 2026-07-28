# Charger Detail Reviews Section Specification

## Purpose

Display reviews on the charger detail screen, replacing the hardcoded rating placeholder and adding a paginated review list.

## Requirements

### Requirement: Rating Header in Host Info Block

The system SHALL replace the hardcoded "0.0 · sin reseñas" in the Host Info Block with the live `avg_rating` and `review_count` from the `chargers` row. The format is `{avg_rating} · {review_count} reseña(s)`.

#### Scenario: Charger with live rating

- GIVEN charger C has `avg_rating = 4.5` and `review_count = 12`
- WHEN the charger detail screen renders
- THEN the host card shows "4.5 · 12 reseña(s)"

#### Scenario: Charger with no reviews

- GIVEN charger C has `avg_rating = 0` and `review_count = 0`
- WHEN the charger detail screen renders
- THEN the host card shows "0.0 · sin reseñas"

### Requirement: Reviews List Section

The system SHALL render a "Reseñas" section below the Host Info Block. Each review displays: reviewer display name, avatar (or initials fallback), star rating (1–5 filled stars), review text (if present), and relative date ("hace X días", "hace 1 mes").

#### Scenario: Reviews list renders multiple reviews

- GIVEN charger C has 3 reviews
- WHEN the section renders
- THEN all 3 reviews are shown, each with name, stars, text, and relative date

#### Scenario: Review without text shows stars only

- GIVEN a review with `text = null`
- WHEN the review renders
- THEN only the star rating and date are shown (no text block)

#### Scenario: Empty reviews state

- GIVEN charger C has 0 reviews
- WHEN the section renders
- THEN the text "Sin reseñas todavía" is displayed

### Requirement: Feature Gate

The system SHALL only render the reviews section when the `CHARGER_REVIEWS` feature flag is enabled.

#### Scenario: Flag disabled hides section

- GIVEN `CHARGER_REVIEWS` is `false`
- WHEN the charger detail screen renders
- THEN no reviews section is shown

#### Scenario: Flag enabled shows section

- GIVEN `CHARGER_REVIEWS` is `true`
- WHEN the charger detail screen renders
- THEN the reviews section is rendered

### Requirement: Reviews Query

The system SHALL fetch reviews via `useChargerReviews(chargerId)` using TanStack Query, keyed on `charger-reviews:${chargerId}`, with 60s stale time. The query SHALL paginate (20 per page) and sort by `created_at` descending.

#### Scenario: Paginated reviews load

- GIVEN charger C has 25 reviews
- WHEN the charger detail loads
- THEN the first 20 reviews are fetched and rendered
- AND a "Ver más" action loads the next page

#### Scenario: Query error shows error state

- GIVEN the reviews query fails
- WHEN the section renders
- THEN an error state is shown (not the "Sin reseñas todavía" empty state)
