# Design: Charger Reviews

## Technical Approach

Add a `reviews` table with RLS + denormalization trigger that keeps `chargers.avg_rating` and `chargers.review_count` in sync. Four hooks (TanStack Query) power the UI. A dedicated review form screen, a CTA on completed reservation cards, and live profile stat cards complete the feature. All gated by `CHARGER_REVIEWS` flag. Push notification on completion uses existing `send-push` Edge Function via client-side call (same pattern as `useConfirmReservation`).

## Architecture Decisions

| Decision | Options | Tradeoff | Choice |
|----------|---------|----------|--------|
| Rating denormalization | DB trigger vs app-level recalc | Trigger is simpler, always consistent, no N+1 on read; slight write overhead | DB trigger — single charger recalc is cheap |
| Review form location | Bottom sheet vs dedicated route | Sheet keeps context but复杂 layout; route is simpler, deep-linkable from push | Route `/review/[reservationId]` — matches push deep-link requirement |
| Push notification delivery | DB trigger (pg_net) vs client-side `send-push` | DB trigger needs pg_net extension + Edge Function; client-side follows existing `useConfirmReservation` pattern | Client-side — no new infra, feature-gated naturally |
| Profile stats aggregation | Real-time query vs cached in chargers table | Real-time avoids stale data but N queries; cached is instant but needs sync | Query aggregation — host typically has few chargers, 1 query is sufficient |

## Data Flow

```
Renter taps "Dejar reseña"
  → /review/[reservationId]
  → useCreateReview (validates completada + no existing review)
  → INSERT into reviews (RLS: renter of completada reservation only)
  → DB trigger handle_review_created recalculates avg_rating + review_count on chargers
  → TanStack invalidation: charger-reviews, charger-rating, profile-stats
  → UI updates: charger detail rating header, review list, profile stat cards
```

Push notification on completion:
```
useConfirmReservation.onSuccess (or manual complete action)
  → sendPushNotification([renterId], "Reserva completada", "¿Cómo fue tu carga en {title}?...")
  → deep-link: /reservation/{id} (where the "Dejar reseña" CTA lives)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/20260725000000_reviews.sql` | Create | reviews table, RLS, trigger, charger columns |
| `src/features/chargers/types.ts` | Modify | Add `avg_rating` and `review_count` to `Charger` interface |
| `src/lib/database.types.ts` | Regenerate | Run `supabase gen types typescript` after migration |
| `src/features/reviews/types.ts` | Create | `Review`, `ReviewerProfile` interfaces |
| `src/features/reviews/hooks/useReviews.ts` | Create | Paginated reviews query (20/page, desc) |
| `src/features/reviews/hooks/useCreateReview.ts` | Create | Mutation: validate + insert + invalidate |
| `src/features/reviews/hooks/useChargerRating.ts` | Create | Read `avg_rating` + `review_count` from charger row |
| `src/features/reviews/hooks/useReviewEligibility.ts` | Create | Check completed + no existing review |
| `src/features/reviews/components/ReviewCard.tsx` | Create | Avatar, name, stars, text, relative date |
| `src/features/reviews/components/StarPicker.tsx` | Create | 1-5 tappable stars, default 5 |
| `src/features/reviews/components/ReviewsSection.tsx` | Create | Rating header + review list + empty state |
| `app/review/[reservationId].tsx` | Create | Review form route |
| `app/charger/[id].tsx` | Modify | Replace hardcoded rating with live data + reviews section |
| `app/reservation/[id].tsx` | Modify | Add "Dejar reseña" CTA for renter on completada |
| `app/(tabs)/profile.tsx` | Modify | Live stat cards via aggregation query |
| `src/features/profile/hooks/useProfileStats.ts` | Create | Aggregate avg_rating + review_count across host's chargers |
| `src/features/reservations/hooks/useConfirmReservation.ts` | Modify | Add review-prompt push on completada transition |
| `src/lib/features.ts` | Modify | Flip `CHARGER_REVIEWS` to `true` |

## Key Interfaces

```typescript
// src/features/reviews/types.ts
export interface Review {
  id: string;
  charger_id: string;
  reviewer_id: string;
  reservation_id: string;
  rating: number; // 1-5
  text: string | null;
  created_at: string;
}

export interface ReviewerProfile {
  displayName: string;
  avatarUrl: string | null;
}

export interface ReviewWithReviewer extends Review {
  reviewer: ReviewerProfile;
}
```

```typescript
// src/features/reviews/hooks/useCreateReview.ts — mutation input
interface CreateReviewInput {
  reservationId: string;
  chargerId: string;
  rating: number; // 1-5
  text: string | null; // max 1000 chars
}
```

```typescript
// Charger type additions
interface Charger {
  // ...existing fields
  avg_rating: number;  // numeric, default 0
  review_count: number; // int, default 0
}
```

## Database Migration Detail

`supabase/migrations/20260725000000_reviews.sql`:

1. **reviews table**: `id` (uuid PK), `charger_id` (FK), `reviewer_id` (FK profiles), `reservation_id` (FK, UNIQUE), `rating` (int2, CHECK 1-5), `text` (text, nullable), `created_at` (timestamptz, default now())

2. **RLS policies**:
   - `reviews_select_authenticated`: `SELECT` for `auth.uid() IS NOT NULL`
   - `reviews_insert_renter_only`: `INSERT` where `reviewer_id = auth.uid()` AND `is_reservation_party(reservation_id)` AND reservation status = `completada`

3. **handle_review_created trigger**: `AFTER INSERT/UPDATE/DELETE` on reviews — recalc `AVG(rating)` and `COUNT(*)` for the affected charger, write to `chargers.avg_rating` (rounded to 1 decimal) and `chargers.review_count`

4. **Charger columns**: `ALTER TABLE chargers ADD COLUMN avg_rating numeric DEFAULT 0, ADD COLUMN review_count int DEFAULT 0`

## Push Notification

Add to `useConfirmReservation.onSuccess` (fire-and-forget, same pattern as existing confirmed push):
- Guard: `isFeatureEnabled('CHARGER_REVIEWS')`
- Query: fetch `renter_id` + `charger.title` from reservation
- Call: `sendPushNotification([renterId], 'Reserva completada', '¿Cómo fue tu carga en {title}? Dejanos tu review')`
- No deep-link in Expo push payload (handled by client routing on tap)

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| DB | RLS policies, trigger recalc, CHECK constraint | Manual SQL tests via Supabase SQL Editor |
| Hook | useCreateReview validation (duplicate, wrong status) | Manual: attempt double-submit, wrong user |
| UI | Review form flow, rating header, empty state | Manual: tap through complete flow |
| Integration | End-to-end: complete reservation → push → review → rating update | Manual E2E on device |

## Migration / Rollout

1. Run migration → `supabase gen types typescript` → update `database.types.ts`
2. Ship with `CHARGER_REVIEWS: false` — zero UI impact
3. Flip flag to `true` in a focused PR after verification

## Open Questions

- None — all decisions resolved by specs and existing patterns.
