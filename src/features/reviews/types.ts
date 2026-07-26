/**
 * Reviews — canonical TypeScript shapes for the `public.reviews` table.
 *
 * Mirrors the migration at
 * `supabase/migrations/20260725000000_reviews.sql`.
 */

/** Raw row from the `reviews` table. */
export interface Review {
  id: string;
  charger_id: string;
  reviewer_id: string;
  reservation_id: string;
  /** 1–5 integer rating. */
  rating: number;
  /** Optional free-text review body. */
  text: string | null;
  /** ISO 8601 timestamp. */
  created_at: string;
}

/** Public profile fields joined for the reviewer. */
export interface ReviewerProfile {
  displayName: string;
  avatarUrl: string | null;
}

/** A review with its reviewer profile inlined (Supabase join). */
export interface ReviewWithReviewer extends Review {
  reviewer: ReviewerProfile;
  /** Host's response text, if any. */
  response?: string | null;
  /** ISO timestamp of when the host responded. */
  responded_at?: string | null;
}

/** Input for the create-review mutation. */
export interface CreateReviewInput {
  reservationId: string;
  chargerId: string;
  /** 1–5 integer rating. */
  rating: number;
  /** Optional free-text review body (max 1000 chars enforced server-side). */
  text: string | null;
}
