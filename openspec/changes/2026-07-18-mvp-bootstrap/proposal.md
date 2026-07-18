# Proposal: MVP Bootstrap — Visual + Functional Foundation

| Field | Value |
|-------|-------|
| **Change slug** | `mvp-bootstrap` |
| **Status** | proposed |
| **Author** | sdd-propose (orchestrator: SDD) |
| **Date** | 2026-07-18 |
| **Mode** | hybrid (openspec + engram) |
| **Project** | enchufate-v2 (P2P EV charger marketplace, Uruguay) |
| **Source** | `.atl/exploration-report.md` (30 wireframes → 19 unique screens) |

---

## Why

Enchufate-V2 is greenfield: no `package.json`, no `app.json`, no Supabase wiring, no git. The wireframes lock a 5-tab UX, a 7-step host wizard, and a chat-aware reservation flow — but nothing is built. We need a single, end-to-end MVP slice that proves the visual + functional foundation works in the user's hands before iterating on individual features.

**Both sides matter from day 1:** guests (renteE) and hosts (propietario) are equally important. No payment integration in MVP — chat is the negotiation channel.

## What changes

**Scope — In (must-ship):**

| # | Capability | Notes |
|---|------------|-------|
| 1 | Expo SDK 54 + TS strict + Expo Router 6 + Supabase client bootstrap | `pnpm` only; `.gitignore` must exclude the 30 wireframe JPEGs in workspace root |
| 2 | Design system primitives (Button, Card, Input, Chip, StatusPill, BetaBanner, FAB) + tokens (color, spacing, radius, typography) | Light theme only |
| 3 | 5-tab navigation (Inicio, Mapa, Mensajes, Reservas, Perfil) with auth-aware per-tab empty states | Mensajes / Reservas / Perfil require login; Inicio / Mapa are public |
| 4 | Auth: email/password + Google OAuth via Supabase; "Olvidé mi contraseña"; "Crear cuenta" | Email verification kept (Supabase default) |
| 5 | Inicio (hero + 2 CTA cards) and Mapa (Google Maps + custom `cargador.png` pin + recenter FAB) | Public |
| 6 | Filtros bottom sheet (5 categories: Estado, Conector, Potencia, Precio, Distancia) | Filter state persists across re-renders |
| 7 | Charger detail screen (`app/charger/[id].tsx`) — photo gallery, map snippet, host, full description, "Reservar" CTA | NEW — not in wireframes; gap filled by exploration |
| 8 | Publicar wizard — 7 steps + success screen; auth-gated; step 6 = "Horario / Disponibilidad" (TBD — see open questions) | Native image picker (5 photos max) |
| 9 | Reservations: two-tab segmented list (Mis reservas / En mis cargadores), status pills, Cancelar action (with confirm modal) | Auth-gated |
| 10 | Mensajes: list + 1:1 thread with system message injection (`kind` column: `user | system_reservation_confirmed | system_reservation_cancelled | system_reservation_requested`) | Auth-gated |
| 11 | Profile: empty state + authenticated state (avatar, member-since, 3 stat cards, Mis cargadores, Publicar nuevo) | Auth-gated |
| 12 | Reservation detail screen (`app/reservation/[id].tsx`) | NEW — tap on a reservation card lands here |
| 13 | Reservation lifecycle: request → host confirm → confirmed → cancel; system messages injected into chat on state change | "Horario a coordinar" text field for MVP |
| 14 | Location permission requested ONLY on Mapa entry and Publicar step 2 (not at app start) | Native prompt + manual fallback |
| 15 | Error / empty / loading states on every screen | `useRequireAuth` hook + standard `<EmptyState />` / `<ErrorState />` / `<LoadingState />` |
| 16 | Push notification trigger: "Tu reserva fue confirmada" | Drives the system message into the chat |

**Scope — Defer (v2.1):** reviews/ratings, host subscription billing (`is_subscribed` flag in schema only — no payment flow), in-app payments, edit/delete charger (3-dot menu shown but disabled), calendar/time picker beyond "Horario a coordinar", notification preferences, Help/FAQ, edit profile, multi-language.

**Scope — Out (do NOT build):** Apple Sign-In, phone auth, turn-by-turn navigation, Apple Wallet passes, vehicle telematics, dynamic pricing, social sharing, public charger profiles, admin dashboard.

## Capabilities (sdd-spec contract)

**New capabilities** (each becomes `openspec/specs/<name>/spec.md`):
- `auth` — login, signup, logout, password reset, Google OAuth
- `design-system` — tokens, primitives, theme
- `tab-navigation` — 5-tab structure with per-tab auth gates
- `home` — Inicio screen
- `map` — Mapa screen + pins + recenter + Filtros sheet
- `charger-detail` — charger profile view
- `charger-publish` — 7-step host wizard
- `reservations` — list + detail + lifecycle + cancel
- `messaging` — conversation list + thread + system message injection
- `profile` — empty + authenticated state
- `notifications` — reservation-confirmed push trigger

**Modified capabilities:** none (greenfield).

## Approach

Expo SDK 54 + TypeScript strict + Expo Router 6 (file-based) + Supabase (`@supabase/supabase-js`). **Package manager: `pnpm` (locked-in — do not use `npm` or `yarn`)**. Atomic design: `src/components/atoms`, `molecules`, `organisms`. Feature-based backend: `src/features/{auth,chargers,reservations,messages,profile}` with each feature exposing hooks + a Supabase data layer. RLS for every table; no service-role client in the app. **TanStack Query** (`@tanstack/react-query`) for cache + optimistic mutations. Zustand for cross-tab UI state (filters, auth session shadow). Reanimated 3 (not 4 — Expo Go crash). Rioplatense Spanish for UI copy; English for code, comments, identifiers.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `package.json`, `app.json`, `tsconfig.json` | New | Expo + TS strict + path alias `@/*` |
| `app/` (Expo Router) | New | `(public)`, `(auth)`, `charger/[id]`, `reservation/[id]` |
| `src/components/` (atomic) | New | atoms/molecules/organisms |
| `src/theme/` | New | tokens |
| `src/lib/supabase.ts` | New | client + typed schema |
| `src/features/*/` | New | auth, chargers, reservations, messages, profile |
| `supabase/migrations/` | New | `profiles`, `chargers`, `charger_photos`, `reservations`, `conversations`, `messages` (with `kind`), RLS policies |
| `supabase/functions/` | New | system-message injector on reservation state change |
| `assets/` | New | moves from workspace root |
| `.gitignore` | New | excludes JPEGs, `node_modules/`, `.expo/`, `.env*` |

## Phasing (recommended order)

1. **Foundation** — Expo init + TS + Router + Supabase client + `.gitignore` + asset moves + git init
2. **Design system** — tokens + Button / Card / Input / Chip / StatusPill / BetaBanner / FAB / loading-empty-error states
3. **Auth** — Supabase Auth wiring (email + Google) + `useRequireAuth` hook + login/signup/reset screens
4. **Public tabs** — Inicio + Mapa + Filtros sheet (no auth dependency)
5. **Auth-gated tabs** — Mensajes list/thread + Reservas list/detail + Profile (both states)
6. **Charger detail + Publicar wizard** — detail screen, then 7-step wizard with native image picker + step 6 (TBD)
7. **Reservation lifecycle** — request → confirm → cancel state machine + system-message injection + push trigger
8. **Polish** — location-permission UX, error boundaries, "Cargador publicado" success state

## Open questions

| # | Question | Default if no answer |
|---|----------|---------------------|
| Q1 | **Wizard step 6**: what fields? Most likely "Horario / Disponibilidad" (per-day windows). | Per-day availability windows (Mon–Sun × time ranges) |
| Q2 | **Reservation request model**: renter picks a date+time, or just sends a chat message? | Hybrid: renter taps "Reservar" → date+time picker → system injects templated chat request |
| Q3 | **Cancelar** requires a reason / confirmation modal? | Confirmation modal: "¿Cancelar la reserva de Cargador X?" |
| Q4 | **Email verification**: required (Supabase default) or skipped in beta? | Required, kept simple |
| Q5 | **Reservation time storage**: free text ("Horario a coordinar") or structured block (start/end ISO)? | Both: optional `start_at` / `end_at` + free-text fallback |
| Q6 | **Push notifications**: only "reserva confirmada" or also new chat message? | "Reserva confirmada" only; chat notifications deferred |

## Acceptance criteria

- [ ] All 19 unique screens from the exploration are reachable and visually on-brand (orange `#FF6B1F`, Rioplatense voseo copy, 16pt card radius, 12pt button radius, pill chips).
- [ ] Auth gate is correct: Inicio + Mapa work logged-out; Mensajes / Reservas / Perfil show contextual "Iniciá sesión" empty states.
- [ ] A guest can find a charger on Mapa, tap a pin, see the detail, send a reservation request, and have it appear in the host's "En mis cargadores".
- [ ] A host can confirm a reservation from the chat, and the system injects "Listo! Tu reserva fue confirmada…" into the thread.
- [ ] Either party can cancel a `Confirmada` reservation via a confirmation modal; the system injects "La reserva fue cancelada." into the chat.
- [ ] A host can complete the 7-step wizard and see the charger on the map and in "Mis cargadores".
- [ ] Location permission is requested ONLY on Mapa entry and on Publicar step 2 (verified by manual test on iOS + Android).
- [ ] Every screen has explicit loading, empty, and error states.
- [ ] `is_subscribed` boolean exists on `profiles` (no payment flow); schema leaves room for v2.1 subscription.
- [ ] RLS enabled on every Supabase table; verified by integration test that a guest cannot UPDATE another user's charger.
- [ ] `expo prebuild --no-install && npx expo export` builds without errors.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Wizard step 6 built wrong if user picks something other than Horario | Med | Q1 carries to spec phase; default to availability windows |
| 400-line PR budget exceeded (MVP is large) | High | Use chained PRs per phasing step 1–8; orchestrator enforces budget via `sdd-tasks` |
| Google OAuth misconfigured in Supabase | Med | Document manual setup in `auth-foundation` task; add to verify checklist |
| V1 drift: developers import V1 patterns | Med | `sdd-init` already warns; AGENTS.md will codify "no V1 imports" |
| Push notifications need APNs/FCM keys not yet provisioned | Med | Reservation lifecycle works without push; push is a polish step |
| Supabase anon key still revoked | High | First implementation task MUST be "user provides fresh anon key" |
| 30 wireframe JPEGs accidentally committed | Med | `.gitignore` in step 1; verify with `git status` before first commit |

## Rollback plan

- **Code rollback**: revert the chained PRs in reverse order; each PR is a self-contained slice with its own rollback.
- **Database rollback**: every migration ships with a paired `down.sql`; archive phase never auto-runs destructive migrations without explicit user approval.
- **Feature flag** (per phase): wrap public-facing surface (Mapa, Publicar) behind `EXPO_PUBLIC_FEATURE_*` env so we can disable mid-flight without redeploy.
- **Branch safety**: never delete a phase branch until the next phase ships to production.

## Dependencies

- **Package manager**: `pnpm` ≥ 8 (locked-in; no `npm` / no `yarn` in this project)
- Fresh Supabase anon key + service-role key from user (current V1 token revoked)
- Google Cloud OAuth client (Web) + Supabase dashboard configuration for Google provider
- Expo Go installed for QA; EAS Build account for production builds (post-MVP)
- APNs key (Apple) + FCM service account (Google) for push — provision in polish phase

## Next phase

`sdd-spec` — write delta specs for the 11 new capabilities listed above, especially `charger-publish` (wizard) and `reservations` (lifecycle + system message injection).
