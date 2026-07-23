/**
 * Feature flags — single source of truth for v2.1 vs MVP gating.
 *
 * MVP ships with the four core flows (chat, reservations, publish,
 * charger browse) all `true`. The v2.1-only flows (push, payments,
 * edit, reviews) are `false` until those subsystems land.
 *
 * **How to use**:
 *
 *   import { FEATURES, isFeatureEnabled } from '@/lib/features';
 *
 *   if (isFeatureEnabled('PUSH_NOTIFICATIONS')) {
 *     // wire up FCM/APNs
 *   }
 *
 * **Why an object instead of `EXPO_PUBLIC_FEATURE_*` env vars?**
 * The design called for env-var flags so the same build could ship
 * to two cohorts (beta vs prod). For MVP we have one cohort, so
 * code-level flags are simpler — the day we need cohort gating, the
 * names already line up with the env-var names we'd add
 * (`process.env.EXPO_PUBLIC_FEATURE_PUSH_NOTIFICATIONS === 'true'`).
 *
 * When a v2.1 feature ships: flip the flag from `false` to `true`
 * in a focused PR. The `isFeatureEnabled` helper is the only call
 * site that needs to change in feature code.
 */
export const FEATURES = {
  /** 1:1 chat between guest and host (Phase 5). */
  CHAT: true,
  /** Reservation request / confirm / cancel lifecycle (Phase 6). */
  RESERVATIONS: true,
  /** 7-step publish wizard for hosts (Phase 5). */
  PUBLISH: true,
  /** Push notifications via APNs / FCM. Deferred to v2.1. */
  PUSH_NOTIFICATIONS: true,
  /** In-app payment flow. Deferred to v2.1. */
  IN_APP_PAYMENTS: false,
  /** Edit / delete an existing charger. Deferred to v2.1. */
  EDIT_CHARGER: false,
  /** Reviews and ratings on chargers. Deferred to v2.1. */
  CHARGER_REVIEWS: false,
} as const;

export type FeatureFlag = keyof typeof FEATURES;

/**
 * Type-narrowed check for whether a feature is enabled.
 *
 * Prefer this over reading `FEATURES.X` directly so call sites get
 * autocomplete and exhaustiveness on the flag name.
 */
export function isFeatureEnabled(key: FeatureFlag): boolean {
  return FEATURES[key];
}
