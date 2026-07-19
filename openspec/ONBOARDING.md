# enchufate-V2 — Onboarding State

> **Status**: MVP shipped (`mvp-bootstrap` change archived on 2026-07-19)
> **Date**: 2026-07-19
> **Branch**: `main` at `543fc1b`

This document is the entry point for any agent (human or AI) picking up the
project. It describes what exists, what is planned, and what to do next.

---

## Quick path (next steps for the user)

1. **Push the archive chore commit** (the orchestrator stages + commits;
   the user pushes `main`).
2. **Deploy the backend** to Supabase (see "Production deployment" below).
3. **Open the v2.1 backlog** to plan the deferred features (push
   notifications, in-app payments, edit charger, charger reviews).
4. **Run `pnpm expo prebuild --no-install`** to regenerate native iOS
   and Android projects before the first device build.

## What exists now

| Path | Purpose |
|------|---------|
| `openspec/specs/` | Source of truth for the 11 product capabilities (11 `spec.md` files, all marked with the `mvp-bootstrap` merge header) |
| `openspec/changes/` | Active change folder (currently empty — no active change) |
| `openspec/changes/archive/2026-07-18-mvp-bootstrap/` | Archived change: proposal, design, tasks (audit trail) |
| `openspec/config.yaml` | SDD project config (detected stack + per-phase rules) |
| `openspec/ONBOARDING.md` | This file |
| `AGENTS.md` | Team conventions source of truth (180 lines, project root) |
| `.atl/skill-registry.md` | Skill index for sub-agent routing |
| `app/` | Expo Router routes (root `_layout.tsx`, `(auth)/` group, `(tabs)/` 5-tab group, `+not-found.tsx`, `charger/[id]`, `reservation/[id]`, `publish/[step]`) |
| `src/components/{atoms,molecules,organisms}/` | Atomic design primitives |
| `src/features/{auth,chargers,reservations,messages,profile}/` | Feature-based hooks, types, stores, data |
| `src/lib/` | Pure utilities (`supabase`, `queryClient`, `error`, `format`, `features`, `secureStorage`, `location`, `database.types`) |
| `src/theme/` | Design tokens (the sole source of colors/spacing/radius/typography/shadows) |
| `src/stores/` | Zustand stores (`filterStore`, `publishWizardStore`, `authStore`) |
| `supabase/migrations/` | 4 SQL migrations (init_chargers, reservations + RLS, reservation lifecycle triggers, Edge Function companion migrations) |
| `supabase/functions/` | 2 Edge Functions (`system-message-injector`, `notify-reservation-confirmed`) |
| `assets/` | Committed app icon, splash, charger PNG, map pin, hero images |
| `android/`, `ios/` | Gitignored; prebuild artifacts (run `pnpm expo prebuild --no-install` to regenerate) |

## What does NOT exist yet

- No production deployment (the project is on `main` locally; not pushed,
  not deployed to TestFlight / Play Internal).
- No tests (`strict_tdd: false`; no test runner configured).
- No CI / CD pipeline.
- No Sentry / observability integration.
- No analytics.

## Recently archived

| Change | Date | Specs | Phases | Notes |
|--------|------|-------|--------|-------|
| `mvp-bootstrap` | 2026-07-18 → 2026-07-19 | 11 (auth, charger-detail, charger-publish, design-system, home, map, messaging, notifications, profile, reservations, tab-navigation) | 8 | First end-to-end MVP. ~15 PRs, ~72 work-unit commits, ~11000 source lines. 3 features enabled (CHAT, RESERVATIONS, PUBLISH), 4 deferred to v2.1. |

Full audit trail: `openspec/changes/archive/2026-07-18-mvp-bootstrap/`
(proposal.md, design.md 62KB, tasks.md 104KB with 73/73 tasks checked).

## Production deployment (user action)

After the archive chore commit is pushed, the user must run these from
the repo root to ship the MVP to production:

```bash
# 1. Push the archive commit to main
git push origin main

# 2. Apply migrations to the production Supabase project
pnpm exec supabase db push --project-ref qmoomdsaqywltaretbef

# 3. Regenerate the typed Supabase client
pnpm exec supabase gen types typescript \
  --project-id qmoomdsaqywltaretbef \
  --schema public > src/lib/database.types.ts

# 4. Deploy Edge Functions
pnpm exec supabase functions deploy system-message-injector \
  --project-ref qmoomdsaqywltaretbef
pnpm exec supabase functions deploy notify-reservation-confirmed \
  --project-ref qmoomdsaqywltaretbef

# 5. Verify env vars in EAS / production builds
#    EXPO_PUBLIC_SUPABASE_URL
#    EXPO_PUBLIC_SUPABASE_ANON_KEY
#    EXPO_PUBLIC_EAS_PROJECT_ID (if applicable)

# 6. Trigger native prebuild before the first device build
pnpm expo prebuild --no-install
```

## v2.1 backlog (deferred features)

These are explicitly out of MVP scope and live in `src/lib/features.ts`
as `false` flags:

| Feature | Flag | Notes |
|---------|------|-------|
| Push notifications (general) | `PUSH_NOTIFICATIONS` | The `notify-reservation-confirmed` Edge Function is shipped; the rest is deferred. |
| In-app payments | `IN_APP_PAYMENTS` | Chat is the negotiation channel in MVP. |
| Edit / delete charger | `EDIT_CHARGER` | 3-dot menu is shown but disabled on Mis cargadores. |
| Charger reviews & ratings | `CHARGER_REVIEWS` | Profile shows `0.0` rating and `0` reseñas as placeholders. |

## Persistence map (hybrid mode)

| Artifact | Filesystem | Engram |
|----------|------------|--------|
| Init context | `openspec/config.yaml` | `sdd-init/enchufate-v2` (id 233) |
| Skill registry | `.atl/skill-registry.md` | `skill-registry` (id 72) |
| Apply progress per phase | `openspec/changes/.../tasks.md` | `sdd/mvp-bootstrap/apply-phase-{N}` (ids 221, 226, 232, 235, 236, 237, 243, 244, 246, 248, 250, 253) |
| Archive report | `openspec/changes/archive/2026-07-18-mvp-bootstrap/` | `sdd/mvp-bootstrap/archive` (id TBD on save) |

## Strict TDD

`strict_tdd: false`. No test runner configured; jest in `pnpm-lock.yaml`
is transitive from Expo / Metro. Re-evaluate when the project adds
`jest-expo` + `@testing-library/react-native`.
See `openspec/config.yaml` `rules.apply.tdd`.

## Risks

1. **No production deployment yet** — the MVP is on `main` locally; the
   user must push + run `supabase db push` + deploy Edge Functions before
   the app talks to live Supabase.
2. **Anon key rotation** — two prior Supabase anon keys were burned via
   the chat; only the most recent (post-Phase 3) key in `.env` is valid.
3. **No git remote configured for the current branch** — `origin/main`
   tracks `javaPhpMyAdmin/enchufate-V2`; verify the remote before push.
4. **Native prebuild** — `android/` and `ios/` are gitignored; a fresh
   `expo prebuild --no-install` is required before the first device build.
5. **V1 drift** — V2 inherits lessons from V1 but should NOT import V1
   code. The folder structure and migration history are fresh.

## Related projects

- **V1**: `/Users/marcelobatista/Desktop/enchufate-app` (working code,
  completed SDD cycles including `reservation-redesign`; reference only)
- **V2**: this project (MVP shipped 2026-07-19)
