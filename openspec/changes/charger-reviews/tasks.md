# Tasks: Charger Reviews

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~550–700 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | 3 PRs |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | DB migration + types + hooks | PR 1 | Foundation: table, RLS, trigger, Charger type update, all 4 hooks, feature types |
| 2 | Charger detail + profile + reservation CTA | PR 2 | UI: ReviewsSection, ReviewCard, StarPicker, Review form route, profile stat cards, reservation CTA |
| 3 | Push notification + feature flag flip | PR 3 | Integration: push on completion, flip CHARGER_REVIEWS to true |

---

## Phase 1: Database & Types

- [x] 1.1 Create `supabase/migrations/20260725000000_reviews.sql` — reviews table (id, charger_id, reviewer_id, reservation_id UNIQUE, rating CHECK 1–5, text, created_at), RLS policies (authenticated read, renter-only insert), `handle_review_created` trigger (AVG/COUNT → chargers.avg_rating/review_count), ALTER chargers ADD avg_rating + review_count columns
- [x] 1.2 Run `supabase gen types typescript` → update `src/lib/database.types.ts`
- [x] 1.3 Create `src/features/reviews/types.ts` — Review, ReviewerProfile, ReviewWithReviewer, CreateReviewInput interfaces
- [x] 1.4 Modify `src/features/chargers/types.ts` — add `avg_rating: number` and `review_count: number` to Charger interface

## Phase 2: Hooks

- [x] 2.1 Create `src/features/reviews/hooks/useReviews.ts` — TanStack Query, keyed `charger-reviews:${chargerId}`, 60s stale, paginated 20/page desc, joins reviewer profile (display_name, avatar_url)
- [x] 2.2 Create `src/features/reviews/hooks/useChargerRating.ts` — read avg_rating + review_count from charger row, keyed `charger-rating:${chargerId}`
- [x] 2.3 Create `src/features/reviews/hooks/useReviewEligibility.ts` — check reservation is `completada` + no existing review for it, keyed `review-eligibility:${reservationId}`
- [x] 2.4 Create `src/features/reviews/hooks/useCreateReview.ts` — mutation: validate (completada, renter, no dup) → INSERT → invalidate charger-reviews, charger-rating, profile-stats keys → success toast "¡Reseña enviada!" → close form
- [x] 2.5 Create `src/features/profile/hooks/useProfileStats.ts` — aggregate avg_rating (AVG) + review_count (SUM) across chargers WHERE owner_id = current user, keyed `profile-stats:${userId}`, 60s stale

## Phase 3: Charger Detail & Profile UI

- [ ] 3.1 Create `src/features/reviews/components/StarPicker.tsx` — 1–5 tappable stars, default 5, selectable prop
- [ ] 3.2 Create `src/features/reviews/components/ReviewCard.tsx` — avatar (or initials fallback), display name, star rating, text (if present), relative date via `formatRelativeTime`
- [ ] 3.3 Create `src/features/reviews/components/ReviewsSection.tsx` — rating header `{avg} · {count} reseña(s)` or "0.0 · sin reseñas", ReviewCard list, "Ver más" pagination, empty state "Sin reseñas todavía", error state, feature-gated via `isFeatureEnabled('CHARGER_REVIEWS')`
- [ ] 3.4 Modify `app/charger/[id].tsx` — replace hardcoded "0.0 · sin reseñas" with live avg_rating + review_count from `useChargerRating`; render `ReviewsSection` below host card, gated by flag
- [ ] 3.5 Modify `app/(tabs)/profile.tsx` — replace hardcoded "0.0" rating and "0" reseñas stat cards with live data from `useProfileStats`, gated by flag

## Phase 4: Review Creation Flow

- [ ] 4.1 Create `app/review/[reservationId].tsx` — review form route: StarPicker + TextInput (max 1000, placeholder "Contanos tu experiencia…") + "Enviar reseña" button, calls useCreateReview, validates eligibility via useReviewEligibility, shows error/inline states
- [ ] 4.2 Modify `app/reservation/[id].tsx` — add "Dejar reseña" button on `completada` renter cards (feature-gated), navigates to `/review/${reservationId}`; hide button if review already exists via useReviewEligibility

## Phase 5: Push Notification & Feature Flag

- [ ] 5.1 Modify `src/features/reservations/hooks/useConfirmReservation.ts` — on completada transition success, if `CHARGER_REVIEWS` enabled: query renter_id + charger.title, call `sendPushNotification([renterId], 'Reserva completada', '¿Cómo fue tu carga en {title}? Dejanos tu review')`, deep-link to `/reservation/{id}`
- [ ] 5.2 Modify `src/lib/features.ts` — flip `CHARGER_REVIEWS` from `false` to `true`
