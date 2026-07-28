# Proposal: Charger Reviews

## Intent

Charger detail and profile show hardcoded "0.0" / "0" for ratings. Guests need to rate chargers after completed reservations — builds marketplace trust and gives hosts feedback.

## Scope

### In Scope

- `reviews` table + RLS + denormalization trigger for `avg_rating` / `review_count`
- Charger detail: reviews section with rating header + review list
- Profile: replace hardcoded stat cards with live data
- Reservation: "Dejar reseña" CTA on `completada` cards (renter only)
- Push notification via `send-push` Edge Function on completion
- Hooks: `useChargerReviews`, `useCreateReview`, `useChargerRating`

### Out of Scope

- Host responses, editing/deletion, photo reviews, moderation, search/map aggregation, notification preferences

## Capabilities

### New

- `charger-reviews`: Review CRUD, display, denormalized rating aggregates

### Modified

- `charger-detail`: reviews section below host card
- `profile`: live stat cards replacing hardcoded values
- `reservations`: "Dejar reseña" CTA on `completada` cards
- `notifications`: push on completion prompting review

## Approach

### Database

`reviews` table: `id` (uuid PK), `charger_id` (FK), `reviewer_id` (FK profiles), `reservation_id` (FK, UNIQUE), `rating` (int2, 1-5), `text` (text, nullable), `created_at`.

RLS: read = any authenticated user; write = renter of `completada` only via `is_reservation_party()` + status check.

Trigger on INSERT/UPDATE/DELETE: recalc `AVG(rating)` + `COUNT(*)` → `chargers.avg_rating` + `chargers.review_count`.

### Push

Extend `completada` transition trigger: "Reserva completada — Dejá tu reseña en {charger_title}".

### UI

- **Charger detail**: `ReviewsSection` — avg rating header + paginated review list
- **Profile**: query aggregated rating/review count by `owner_id`
- **Reservation cards**: "Dejar reseña" bottom sheet (star picker + optional text) on `completada` renter cards

### Hooks

- `useChargerReviews(chargerId)` — paginated, TanStack Query
- `useChargerRating(chargerId)` — denormalized from `chargers` row
- `useCreateReview()` — mutation, invalidates reviews + rating + profile

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `supabase/migrations/` | New | table, RLS, trigger |
| `src/features/chargers/` | Modified | `ReviewsSection`, hooks |
| `src/features/profile/` | Modified | live stat cards |
| `src/features/reservations/` | Modified | review CTA |
| `supabase/functions/send-push/` | Modified | completion prompt |
| `src/lib/features.ts` | Modified | flag → `true` |

## Risks

| Risk | Mitigation |
|------|------------|
| Self-review | RLS renter-only + one per reservation |
| Trigger perf | Per-review recalc, cheap at scale |

## Rollback Plan

1. `CHARGER_REVIEWS: false` — hides all UI
2. Drop `reviews` table + trigger via rollback migration

## Dependencies

`send-push` Edge Function, `is_reservation_party()` RLS helper, `completada` DB trigger

## Success Criteria

- [ ] Renter submits 1-5 star review + optional text on `completada`
- [ ] One review per reservation enforced at DB level
- [ ] Charger detail shows live avg rating + review list
- [ ] Profile stat cards show live aggregates
- [ ] Push notification fires on completion
- [ ] `CHARGER_REVIEWS: false` fully gates the feature
