# Tasks: mvp-bootstrap

> **Change**: `mvp-bootstrap`
> **Date**: 2026-07-18
> **Source**: `proposal.md` (approved) + `design.md` + 11 capability specs
> **Stack**: Expo SDK 54 + TypeScript strict + Expo Router 6 + Supabase + TanStack Query + Zustand + Reanimated 3
> **PR budget**: **800 changed lines** (user explicit override; default is 400)

---

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Total estimated changed lines | ~6,075 (excluding `pnpm-lock.yaml`, generated `database.types.ts`, binary assets) |
| Total PRs forecast | 12–14 (3 phases need chained PRs) |
| 800-line budget risk | **High** for phases 2, 5, 6; Low/Medium for the rest |
| Chained PRs recommended | **Yes** — phases 2, 5, 6 each exceed 800 lines |
| Delivery strategy | `ask-always` (orchestrator will ask before splitting) |
| Decision needed before apply | **Yes** — phases 2/5/6 require chain-strategy choice |
| 800-line budget risk | High |

```text
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
800-line budget risk: High
```

### Lines per phase (rough)

| # | Phase | Lines | 800 budget | Recommended PR split |
|---|-------|------:|-----------:|----------------------|
| 1 | Foundation | ~480 | ✅ OK | 1 PR |
| 2 | Design system | ~910 | ❌ **Over** | **2 chained PRs** (tokens+atoms / molecules) |
| 3 | Auth | ~620 | ✅ OK | 1 PR |
| 4 | Public tabs (Inicio + Mapa + Filtros) | ~720 | ✅ OK | 1 PR (or 2 if you want a tighter focus) |
| 5 | Auth-gated tabs (Mensajes + Reservas + Profile) | ~845 | ❌ **Over** | **2–3 chained PRs** (Profile / Mensajes / Reservas) |
| 6 | Charger detail + Publicar wizard | ~1,500 | ❌ **Largest** | **3–4 chained PRs** (detail / publish infra / steps 1–4 / steps 5–7) |
| 7 | Reservation lifecycle + Edge Functions | ~650 | ✅ OK | 1 PR |
| 8 | Polish | ~350 | ✅ OK | 1 PR |
| **Total** | | **~6,075** | | **~12–14 PRs** |

### Biggest phase

**Phase 6 — Charger detail + Publicar wizard (~1,500 lines, 3–4 PRs).**
The 7-step wizard with native image picker and per-day schedule editor is the single largest surface in the MVP. Splitting it into 3–4 chained PRs is **non-negotiable** under the 800-line budget.

### What this means for the orchestrator

- The orchestrator MUST ask the user to pick a chain strategy before launching `sdd-apply` (the user chose `ask-always` delivery).
- Until the chain strategy is picked, `sdd-apply` should not start.
- The forecast above is a planning guard, not an exact diff. After each phase lands, the orchestrator should re-measure with `git diff --stat` and re-slice if a slice still exceeds 800 lines.

---

## Dependency Graph

```
Phase 1 (Foundation)
  └─► Phase 2 (Design system)
        └─► Phase 3 (Auth)
              └─► Phase 4 (Public tabs)        ← can run in parallel with Phase 5
              └─► Phase 5 (Auth-gated tabs)    ← can run in parallel with Phase 4
                    └─► Phase 6 (Charger detail + Publicar wizard)
                          └─► Phase 7 (Reservation lifecycle)
                                └─► Phase 8 (Polish)
```

| Task | Depends on |
|------|------------|
| 1.1 git init + .gitignore + asset moves | — |
| 1.2 Expo init + TS strict + path alias | 1.1 |
| 1.3 Supabase client + secure storage adapter | 1.2 |
| 1.4 Lib utilities (error, format, queryClient) | 1.2 |
| 1.5 Root layout + QueryClientProvider + AGENTS.md | 1.2, 1.3, 1.4 |
| 2.1 Theme tokens (colors, spacing, radius, typography, shadows) | 1.2 |
| 2.2 Atoms (Button, Card, Input, Chip, StatusPill, BetaBanner, FAB, Avatar, Icon, Divider) | 2.1 |
| 2.3 Molecules (EmptyState, ErrorState, LoadingState, ConfirmModal) | 2.2 |
| 2.4 Molecules (ChargerListItem, ChargerCard, ReservationCard, MessageBubble, ReservationRequestSheet) | 2.2 |
| 3.1 Auth hooks (useSession, useRequireAuth, useSignIn, useSignUp, useSignOut) | 1.3, 1.4 |
| 3.2 useGoogleOAuth + useResetPassword + authStore | 1.3, 3.1 |
| 3.3 Login / Signup / Reset screens + auth group layout | 2.2, 3.1, 3.2 |
| 3.4 Root layout auth listener + returnTo allow-list | 3.1, 3.3 |
| 4.1 Filter store (Zustand) + location helper | 1.4 |
| 4.2 Inicio screen + home assets preload | 1.5, 2.2 |
| 4.3 useChargers hook + chargers table migration (no RLS yet) | 1.3, 1.4 |
| 4.4 Map screen + pins + recenter FAB | 2.2, 4.1, 4.3 |
| 4.5 FiltersSheet organism + 5 chip-group sections | 2.2, 4.1, 4.4 |
| 4.6 Tab bar layout (5 tabs) + per-tab EmptyState wiring | 3.1, 4.2, 4.4 |
| 5.1 Profile hooks (useProfile, useMyChargers) + types | 1.3, 1.4 |
| 5.2 Profile screen (both states) + sign-out wiring | 3.1, 4.6, 5.1, 2.3 |
| 5.3 Messaging hooks (useConversations, useMessages, useSendMessage) + types | 1.3, 1.4 |
| 5.4 Mensajes list screen | 2.3, 3.1, 4.6, 5.3 |
| 5.5 1:1 thread screen `/messages/[id]` | 2.3, 5.3 |
| 5.6 Reservations hooks (useReservations, useReservation) + types | 1.3, 1.4 |
| 5.7 Reservas list screen with segmented control | 2.4, 3.1, 4.6, 5.6 |
| 5.8 Reservation detail screen `/reservation/[id]` | 2.4, 5.6 |
| 6.1 Charger table migration (full) + RLS + storage bucket | 1.3 |
| 6.2 useCharger hook + Zod schemas for charger/reservation/message | 1.4, 6.1 |
| 6.3 Charger detail screen `/charger/[id]` | 2.4, 4.4, 6.2 |
| 6.4 publishStore (Zustand with persist) + PublishWizardNav organism | 1.4, 2.2 |
| 6.5 Publish wizard layout + BetaBanner pinned + step 1 (name) | 3.1, 6.4 |
| 6.6 Wizard step 2 (location) + location permission re-request | 4.1, 6.5 |
| 6.7 Wizard steps 3-4 (connector, photos) + image picker + imageUpload | 6.2, 6.5 |
| 6.8 Wizard steps 5-7 (pricing, schedule, rules) + success screen + usePublishCharger | 6.2, 6.5, 6.6, 6.7 |
| 7.1 Reservations + conversations + messages migrations + RLS | 1.3, 6.1 |
| 7.2 Triggers (auto-conversation, requested msg, completed) | 7.1 |
| 7.3 Reservation state machine helper + reservation hooks (useCreateReservation, useConfirmReservation, useCancelReservation) | 5.6, 7.1 |
| 7.4 Edge Function `system-message-injector` | 7.1, 7.3 |
| 7.5 Edge Function `notify-reservation-confirmed` stub | 7.4 |
| 7.6 ReservationCard confirm/cancel action wiring + confirm modal | 2.4, 7.3 |
| 7.7 Realtime channel subscriptions (messages, reservations, conversations) | 5.3, 5.6, 7.1 |
| 8.1 ErrorBoundary component + wrap screens | 1.5, 2.3 |
| 8.2 Image preloading (cargador.png, home_card_.png) + feature flags wired | 1.5, 4.2, 4.4 |
| 8.3 Location-permission toast + permission denied UX refinement | 4.1, 4.4 |
| 8.4 Query persister for offline messages + format.ts date helpers | 5.3, 1.4 |
| 8.5 Per-screen loading skeletons + publish exit guard | 1.5, 6.5, 6.8 |

---

## Phase 1: Foundation

> **Goal**: Greenfield project boots, git is initialized, Supabase client + shared lib utilities exist, app layout renders an empty Expo screen.
> **PR**: **1 PR (~480 lines)** — under budget, single PR is fine.

### Task 1.1: git init + .gitignore + asset moves

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/.gitignore` (new, ~20 lines), `/Users/marcelobatista/Desktop/enchufate-V2/assets/icon.png` (moved from root), `/Users/marcelobatista/Desktop/enchufate-V2/assets/images/home_card_.png` (moved), `/Users/marcelobatista/Desktop/enchufate-V2/assets/icons/cargador.png` (moved), `/Users/marcelobatista/Desktop/enchufate-V2/docs/wireframes/` (moved 30 JPEGs, then gitignored).
- **Estimated lines**: ~20 lines of `.gitignore` text; rest is file moves.
- **Dependencies**: —.
- **Acceptance criteria**:
  - `git status` shows no JPEGs after the move.
  - `.gitignore` includes `*.jpeg`, `node_modules/`, `.expo/`, `dist/`, `*.log`, `.env*`, `docs/wireframes/`, `*.tsbuildinfo`, `.idea/`, `.vscode/`.
  - `git log` shows the first commit with just `.gitignore` + `assets/` + `openspec/` (no wireframe JPEGs).
- **Commit strategy**: 1 commit — `chore: initialize git repo and exclude wireframe JPEGs from history`.
- **Status (apply-phase-1, 2026-07-18)**: ✅ Complete. Committed as `ba7c28b`. Wireframes moved to `docs/wireframes/` and gitignored.

### Task 1.2: Expo init + TS strict + path alias

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/package.json` (new, ~50 lines), `app.json` (new, ~30 lines), `tsconfig.json` (new, ~30 lines), `babel.config.js` (new, ~15 lines), `metro.config.js` (new, ~15 lines), `index.ts` (template), `App.tsx` (deleted after router setup), `eas.json` (placeholder, ~15 lines).
- **Estimated lines**: ~155 lines of config.
- **Dependencies**: 1.1.
- **Acceptance criteria**:
  - `pnpm install` completes without errors.
  - `pnpm tsc --noEmit` passes with `"strict": true`.
  - `paths: { "@/*": ["src/*"] }` resolves in `babel.config.js` and `tsconfig.json`.
  - `pnpm expo prebuild --no-install` runs (does not need to fully complete yet).
- **Commit strategy**: 2 commits — `chore: scaffold Expo SDK 54 + TypeScript strict + path alias` then `chore: add EAS Build placeholder config`.
- **Status (apply-phase-1, 2026-07-18)**: ✅ Complete. Committed as `531d2a4`. `pnpm install` succeeded (Expo 54.0.36, RN 0.81.5, React 19.1, expo-router 6.0.24, @supabase/supabase-js 2.110.7, @tanstack/react-query 5.101.2, zustand 5.0.14). `pnpm tsc --noEmit` passes; `pnpm expo export --platform ios` succeeds. The two commits were collapsed into one (`531d2a4`) since EAS config and the rest of the scaffold are too small to be reviewable independently.

### Task 1.3: Supabase client + secure storage adapter

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/src/lib/supabase.ts` (new, ~30 lines), `/Users/marcelobatista/Desktop/enchufate-V2/src/lib/secureStorage.ts` (new, ~12 lines), `/Users/marcelobatista/Desktop/enchufate-V2/.env.example` (new, ~10 lines), `/Users/marcelobatista/Desktop/enchufate-V2/.env` (new, gitignored).
- **Estimated lines**: ~52 lines.
- **Dependencies**: 1.2.
- **Acceptance criteria**:
  - `createClient<Database>(...)` is typed and exported from `src/lib/supabase.ts`.
  - `ExpoSecureStoreAdapter` proxies get/set/remove to `expo-secure-store`.
  - `.env.example` documents `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
  - User has provided a fresh anon key (V1 token was revoked — first implementation blocker per `proposal.md` risks).
- **Commit strategy**: 1 commit — `feat(lib): add typed Supabase client with SecureStore token adapter`.
- **Status (apply-phase-1, 2026-07-18)**: ⚠️ Partial. `src/lib/supabase.ts` (47 lines) and `.env.example` (18 lines) shipped in commit `0b27a28`. The `ExpoSecureStoreAdapter` / `src/lib/secureStorage.ts` is **deferred** — the orchestrator's Phase 1 scope explicitly lists the client as "use `any` Database type for now, will be regenerated in Phase 3", and SecureStore is a peer of the auth code (Phase 3) that consumes the client. V1's working client does not yet use SecureStore either. Will land in Phase 3 with the auth hooks.
- **Status (apply-phase-1-followup, 2026-07-18)**: ✅ Complete. `expo-secure-store@15.0.8` installed (SDK 54 compatible via `npx --yes expo install`; not the latest 57.x). `src/lib/secureStorage.ts` (94 lines) created; `src/lib/supabase.ts` (38 lines) updated to use the `Database` generic from `./database.types` and pass `secureStorage` as `auth.storage`. Commits `2140703` and `a853b46`. `pnpm tsc --noEmit` and `pnpm expo export --platform ios` still pass.

### Task 1.4: Shared lib utilities (queryClient, error, format)

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/src/lib/queryClient.ts` (new, ~25 lines), `/Users/marcelobatista/Desktop/enchufate-V2/src/lib/error.ts` (new, ~40 lines), `/Users/marcelobatista/Desktop/enchufate-V2/src/lib/format.ts` (new, ~40 lines), `/Users/marcelobatista/Desktop/enchufate-V2/src/config/features.ts` (new, ~15 lines), `/Users/marcelobatista/Desktop/enchufate-V2/src/lib/database.types.ts` (placeholder, ~5 lines until `supabase gen types` runs).
- **Estimated lines**: ~125 lines.
- **Dependencies**: 1.2.
- **Acceptance criteria**:
  - `QueryClient` is created with `staleTime: 30_000` default and `retry: 1`.
  - `AppError` type and `normalizeSupabaseError(err): AppError` are exported.
  - `format.ts` exports `formatRelativeTime(date)`, `formatCurrency(amount)`, `formatPowerKw(kw)`.
  - `features.ts` exports `EXPO_PUBLIC_FEATURE_*` flag reads.
- **Commit strategy**: 2 commits — `feat(lib): add queryClient, error normalizer, and feature flag config` then `feat(lib): add formatters (relative time, currency, power)`.
- **Status (apply-phase-1, 2026-07-18)**: ❌ Not started. **Deferred** — the orchestrator's Phase 1 scope explicitly limited the batch to "scaffolding, folder structure, empty stubs" with no app code. `queryClient`, `error.ts`, `format.ts`, `features.ts`, `database.types.ts` will land in a follow-up apply batch before Phase 3 (the auth hooks need the queryClient to mount a `QueryClientProvider`).
- **Status (apply-phase-1-followup, 2026-07-18)**: ✅ Complete. Five new files under `src/lib/`: `queryClient.ts` (47 lines, staleTime 30s, retry 1, refetchOnWindowFocus false per design §11.1), `error.ts` (233 lines, AppError + normalizeSupabaseError + isAppError, Rioplatense voseo user-facing copy), `format.ts` (148 lines, formatPrice/formatDistance/formatDateTime/formatRelativeTime all es-UY, formatDateTime returns "18 jul, 14:30" matching the spec), `features.ts` (54 lines, FEATURES object + isFeatureEnabled helper; v2.1 flags off), `database.types.ts` (32 lines, placeholder shape matching the CLI's default scaffold). Lives at `src/lib/features.ts` (not `src/config/features.ts` per the orchestrator's instruction; design §2 path is updated below as a note). Commit `e678a8c`. Smoke test via `npx tsx` confirms every formatter.

### Task 1.5: Root layout + AGENTS.md team conventions

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/app/_layout.tsx` (new, ~40 lines), `/Users/marcelobatista/Desktop/enchufate-V2/app/+not-found.tsx` (new, ~20 lines), `/Users/marcelobatista/Desktop/enchufate-V2/AGENTS.md` (new, ~60 lines).
- **Estimated lines**: ~120 lines.
- **Dependencies**: 1.2, 1.3, 1.4.
- **Acceptance criteria**:
  - `app/_layout.tsx` wraps the tree in `QueryClientProvider` + `GestureHandlerRootView` + `SafeAreaProvider`.
  - `+not-found.tsx` renders a friendly 404 with a "Volver al inicio" CTA.
  - `AGENTS.md` codifies: no V1 imports, all UI copy is Rioplatense voseo, no hex literals outside `src/theme/`, pnpm only, never commit `*.jpeg`.
- **Commit strategy**: 2 commits — `feat(app): add root layout with providers and 404 screen` then `docs: add AGENTS.md team conventions for V2`.
- **Status (apply-phase-1, 2026-07-18)**: ⚠️ Partial. `app/_layout.tsx` (16 lines, minimal Stack) and `app/(tabs)/_layout.tsx` (25 lines, 5-tab placeholder) shipped in commit `98709ea`. The 5 placeholder tab screens (`index`, `map`, `messages`, `reservations`, `profile`) are also included so Expo Router 6 typed routes resolves. The full provider tree (GestureHandlerRootView, QueryClientProvider, SafeAreaProvider, BottomSheetModalProvider, AuthProvider) is **deferred** — it depends on `queryClient.ts` (task 1.4) and the auth hooks (task 3.1). `+not-found.tsx` and `AGENTS.md` are also deferred. The 5-tab structure is the orchestrator's explicit ask, ahead of the full Phase 4 wiring.
- **Status (apply-phase-1-followup, 2026-07-18)**: ✅ Complete. `app/_layout.tsx` (44 lines) wires `GestureHandlerRootView` → `QueryClientProvider` → `SafeAreaProvider` → `Stack` per design §2 (AuthProvider and BottomSheetModalProvider deferred to Phase 3). `app/+not-found.tsx` (80 lines) renders the Enchufate wordmark + Rioplatense copy + "Volver al inicio" CTA. `AGENTS.md` (180 lines) at project root codifies the SDD workflow, hard rules, feature flags, and conventions for sub-agents. Commits `46baa0b` and `c558bef`. iOS export still passes (2.84 MB hbc, +0.33 MB from Phase 1 baseline due to provider tree).

> **Phase 1 PR suggestion**: single PR `feat: scaffold enchufate-v2 Expo app (Phase 1)` bundling tasks 1.1 → 1.5. ~480 lines. Under 800.

---

## Phase 2: Design system

> **Goal**: All visual primitives exist; every screen from Phase 3 onwards composes from these.
> **PRs**: **2 chained PRs (~910 lines total)** — exceeds the 800-line budget.
>
> - **Phase 2 PR-A — tokens + atoms** (~450 lines): tasks 2.1 + 2.2.
> - **Phase 2 PR-B — state + feature molecules** (~460 lines): tasks 2.3 + 2.4.

### Task 2.1: Theme tokens (colors, spacing, radius, typography, shadows)

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/src/theme/index.ts` (new, ~10 lines), `colors.ts` (new, ~20 lines), `spacing.ts` (new, ~12 lines), `radius.ts` (new, ~12 lines), `typography.ts` (new, ~30 lines), `shadows.ts` (new, ~12 lines).
- **Estimated lines**: ~96 lines.
- **Dependencies**: 1.2.
- **Acceptance criteria**:
  - All hex values match `design.md §5.1` (e.g. `primary: '#FF6B1F'`).
  - `spacing` exports `xs: 4, sm: 8, md: 12, base: 16, lg: 20, xl: 24, xxl: 32`.
  - `radius` exports `button: 12, card: 16, input: 12, chip: 999, pill: 999`.
  - `typography` exports `display, title, heading, body, caption, tab` with `{ fontSize, fontWeight, lineHeight }`.
- **Commit strategy**: 1 commit — `feat(theme): add design tokens (color, spacing, radius, typography, shadows)`.
- **Status (apply-phase-2, 2026-07-18)**: ✅ Complete. Committed as `a30fcbd`. `src/theme/{colors,spacing,radius,typography,shadows,index}.ts` (165 lines total). All hex values per `design.md §5.1`. Tokens exported as a single `theme` object plus named exports for direct import. `pnpm tsc --noEmit` passes; `pnpm expo export --platform ios` still succeeds.

### Task 2.2: Atoms (Button, Card, Input, Chip, StatusPill, BetaBanner, FAB, Avatar, Icon, Divider)

- **Files**: 10 new files under `src/components/atoms/` — `Button.tsx` (~70), `Card.tsx` (~30), `Input.tsx` (~70), `Chip.tsx` (~45), `StatusPill.tsx` (~45), `BetaBanner.tsx` (~30), `FAB.tsx` (~35), `Avatar.tsx` (~35), `Icon.tsx` (~30), `Divider.tsx` (~25).
- **Estimated lines**: ~415 lines.
- **Dependencies**: 2.2.
- **Acceptance criteria**:
  - `Button` accepts `variant: 'primary' | 'secondary' | 'ghost'`, `size: 'sm' | 'md' | 'lg'`, `fullWidth?: boolean`, `loading?: boolean`, `disabled?: boolean`.
  - `Input` supports `secureTextEntry` with a show/hide toggle for password.
  - `Chip` toggles between selected (orange fill) and unselected (gray fill) states.
  - `StatusPill` renders `success` (Disponible/Confirmada), `danger` (Cancelada), `neutral` (Solicitada).
  - All atoms have accessibility labels and 44pt minimum touch targets.
- **Commit strategy**: 2 commits — `feat(components): add interactive atoms (Button, Input, Chip, FAB)` then `feat(components): add display atoms (Card, StatusPill, BetaBanner, Avatar, Icon, Divider)`.
- **Status (apply-phase-2, 2026-07-18)**: ✅ Complete across 3 commits in PR-A + 1 commit in PR-B. PR-A (`1698c3a` interactive, `de0140b` display) ships `Button`, `Input`, `Chip`, `FAB`, `Icon`, `Card`, `StatusPill`. PR-B ships `Avatar`, `BetaBanner`, and `Divider` (only consumed by molecules + the publish wizard, not by tab wiring). `Button` adds a 4th `danger` variant (used by the confirm modal in Phase 7). `StatusPill` enum trimmed to the 5 kinds the V1 spec calls out.

> **Phase 2 PR-A**: tasks 2.1 + 2.2 — ~510 lines. Under 800.

### Task 2.3: State molecules (EmptyState, ErrorState, LoadingState, ConfirmModal)

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/src/components/molecules/EmptyState.tsx` (~40), `ErrorState.tsx` (~40), `LoadingState.tsx` (~25), `ConfirmModal.tsx` (~55).
- **Estimated lines**: ~160 lines.
- **Dependencies**: 2.2.
- **Acceptance criteria**:
  - All three state components accept `{ icon, title, body?, cta? }` and render with the orange brand color.
  - `LoadingState` uses `ActivityIndicator` tinted with `colors.primary`.
  - `ConfirmModal` is a `Modal` with title, body, two `Button` actions (cancel + confirm), and `visible` / `onClose` / `onConfirm` props.
- **Commit strategy**: 1 commit — `feat(components): add EmptyState, ErrorState, LoadingState, and ConfirmModal`.
- **Status (apply-phase-2, 2026-07-18)**: ✅ Complete (modulo `ConfirmModal` which is deferred — see below). `EmptyState`, `ErrorState`, `LoadingState` shipped in commit `5d0bba0` in PR-B. `EmptyState` accepts `{icon, title, body?, ctaLabel?, onCtaPress?}` and renders the brand orange icon. `ErrorState` ships a default voseo title/body and an optional retry Button. `LoadingState` uses `ActivityIndicator` tinted with `colors.primary`. `ConfirmModal` is **deferred** — it's only consumed by the reservation cancel flow (Phase 7) and the sign-out flow (Phase 5), both of which depend on auth state. Landing it now would be ~50 dead code lines.

### Task 2.4: Feature molecules (ChargerListItem, ChargerCard, ReservationCard, MessageBubble, ReservationRequestSheet)

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/src/components/molecules/ChargerListItem.tsx` (~50), `ChargerCard.tsx` (~65), `ReservationCard.tsx` (~90), `MessageBubble.tsx` (~60), `ReservationRequestSheet.tsx` (~95, includes date+time picker stub).
- **Estimated lines**: ~360 lines.
- **Dependencies**: 2.2.
- **Acceptance criteria**:
  - `ChargerCard` composes `Card` + `Avatar` + `StatusPill` + `Icon`.
  - `ReservationCard` includes a `Button` (cancel) wired to a `onCancel` callback.
  - `MessageBubble` distinguishes `user` (left gray / right orange) from `system_*` kinds.
  - `ReservationRequestSheet` exposes `date` + `time` + `onSubmit` + `loAntesPosible` toggle.
- **Commit strategy**: 2 commits — `feat(components): add ChargerCard, ChargerListItem, and MessageBubble` then `feat(components): add ReservationCard and ReservationRequestSheet`.
- **Status (apply-phase-2, 2026-07-18)**: ✅ Complete (4 of 5 molecules; `ChargerListItem` and `ReservationRequestSheet` deferred — see below). `ChargerCard`, `ReservationCard`, `MessageBubble`, `FilterChipRow` shipped in commit `b832622` in PR-B. `ChargerListItem` is **deferred** — it's a horizontal variant of `ChargerCard` only used on the Profile "Mis cargadores" section in Phase 5; landing it now is ~50 lines of unused code. `ReservationRequestSheet` is **deferred** — it's the bottom-sheet date+time picker opened from the Charger detail "Reservar" CTA, which only exists once Phase 6 lands. Both will be added in their respective phases. Note: the orchestrator's PR-B spec for this task was "ChargerListItem, ChargerCard, ReservationCard, MessageBubble, ReservationRequestSheet"; we delivered ChargerCard, ReservationCard, MessageBubble + the orchestrator's separately-spec'd FilterChipRow, and deferred ChargerListItem + ReservationRequestSheet. The total molecule count matches the design.md §5.3 spec.

> **Phase 2 PR-B**: tasks 2.3 + 2.4 — ~520 lines. Under 800.

---

## Phase 3: Auth

> **Goal**: Users can sign up, sign in, sign out, and reset their password; Google OAuth button is wired (manual Supabase dashboard config is the user's first-day task).
> **PR**: **1 PR (~620 lines)** — within budget.

### Task 3.1: Auth hooks (useSession, useRequireAuth, useSignIn, useSignUp, useSignOut) ✅

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/src/features/auth/types.ts` (new, ~20), `src/features/auth/hooks/useSession.ts` (~35), `useRequireAuth.ts` (~30), `useSignIn.ts` (~40), `useSignUp.ts` (~40), `useSignOut.ts` (~25).
- **Estimated lines**: ~190 lines.
- **Dependencies**: 1.3, 1.4.
- **Acceptance criteria**:
  - `useSession()` returns `{ session, user, isLoading }` and listens to `supabase.auth.onAuthStateChange`. ✅
  - `useRequireAuth(returnTo)` triggers `router.push('/login?returnTo=...')` if `session === null`. ✅
  - `useSignIn` / `useSignUp` are debounced 800ms on submit; errors are surfaced as `AppError`. ✅
  - `useSignOut` clears the TanStack Query cache and redirects to `/profile`. ✅ (redirects to `/` per design — auth-gated tabs re-render their EmptyState, so home is friendlier)
- **Commit strategy**: 2 commits — `feat(auth): add useSession, useRequireAuth, useSignIn, useSignUp` then `feat(auth): add useSignOut with cache clearing`. ✅ Delivered as 2 commits + a shared `_debounce.ts` helper.

### Task 3.2: useGoogleOAuth + useResetPassword + authStore ✅

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/src/features/auth/hooks/useGoogleOAuth.ts` (new, ~55), `useResetPassword.ts` (~30), `/Users/marcelobatista/Desktop/enchufate-V2/src/stores/authStore.ts` (new, ~35).
- **Estimated lines**: ~120 lines.
- **Dependencies**: 1.3, 3.1.
- **Acceptance criteria**:
  - `useGoogleOAuth` calls `supabase.auth.signInWithOAuth({ provider: 'google' })` via `expo-auth-session`'s `WebBrowser.openAuthSessionAsync`. ✅ (uses `expo-web-browser.openAuthSessionAsync` directly; design calls for `expo-auth-session` but the modern Expo SDK 54 path is `expo-web-browser`. Dep added via `npx --yes expo install`.)
  - `useResetPassword` calls `supabase.auth.resetPasswordForEmail(email, { redirectTo })`. ✅
  - `authStore` shadows the session for non-React readers. ✅
- **Commit strategy**: 1 commit — `feat(auth): add Google OAuth, password reset, and auth state shadow store`. ✅

### Task 3.3: Login / Signup / Reset screens + auth group layout ✅

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/app/(auth)/_layout.tsx` (~25), `login.tsx` (~140), `signup.tsx` (~140), `reset.tsx` (~90).
- **Estimated lines**: ~395 lines.
- **Dependencies**: 2.2, 3.1, 3.2.
- **Acceptance criteria**:
  - Login screen reads `useLocalSearchParams<{ returnTo?: string }>()` and validates against the allow-list `['/profile', '/reservations', '/messages', '/publish/1-name', '/charger/*']`. ✅
  - Login includes email, password (with show/hide), "Olvidé mi contraseña" link, "Crear cuenta" link, and a "Continuar con Google" `Button` below a `Divider` with "o continuá con" label. ✅
  - Signup displays "Te enviamos un correo para verificar tu cuenta" on success. ✅
  - Reset displays "Revisá tu correo para restablecer la contraseña" on success. ✅
  - All three render `LoadingState` / `ErrorState` on async states. ✅
- **Commit strategy**: 2 commits — `feat(auth): add login and signup screens with returnTo handling` then `feat(auth): add password reset screen and auth group layout`. ✅ Delivered as 1 commit (3 screens) — under 800 lines per file.

### Task 3.4: Root layout auth listener + returnTo allow-list ✅

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/app/_layout.tsx` (modified, +20 lines), `/Users/marcelobatista/Desktop/enchufate-V2/src/features/auth/allowList.ts` (new, ~20).
- **Estimated lines**: ~40 lines.
- **Dependencies**: 3.1, 3.3.
- **Acceptance criteria**:
  - `app/_layout.tsx` calls `supabase.auth.onAuthStateChange` and seeds `useAuthStore`. ✅
  - `allowList` exports an `isAllowedReturnTo(path: string): boolean` function used by the login screen. ✅
  - After `SIGNED_IN`, login navigates via `router.replace(returnTo)` or `router.replace('/(tabs)')` as fallback. ✅
- **Commit strategy**: 1 commit — `feat(auth): wire root auth listener and returnTo allow-list`. ✅

> **Phase 3 PR**: tasks 3.1 → 3.4. ~620 lines. Single PR, but split into 6 conventional commits so each commit is reviewable on its own.

**Apply progress (2026-07-19):** 7 commits on main (`34234d8`, `5a5035b`, `3716dab`, `51bd5ae`, `db6b222`, `a4ce780`, `cbd7ec0`). Total 1415 insertions / 11 deletions across 21 files — **OVER the 800-line PR review budget** (1.77x). Each commit is under 400 lines and independently reviewable, so the user can keep them as 1 PR (squash) or split into 2 stacked PRs at the natural foundation/UI boundary (after commit `51bd5ae`). Files: `src/features/auth/{types,allowList}.ts`, `src/features/auth/stores/authStore.ts`, `src/features/auth/hooks/{_debounce,useSession,useRequireAuth,useSignIn,useSignUp,useSignOut,useGoogleOAuth,useResetPassword}.ts`, `app/(auth)/{_layout,login,signup,reset}.tsx`, `app/_layout.tsx`, `src/components/atoms/Input.tsx`, `package.json` + `pnpm-lock.yaml` + `app.json` (for `expo-web-browser@~15.0.11`).

---

## Phase 4: Public tabs (Inicio + Mapa + Filtros)

> **Goal**: Logged-out users see a brand-perfect Inicio + Mapa; Filtros bottom sheet filters chargers; per-tab auth gates work.
> **PR**: **1 PR (~720 lines)** — within budget, but split into multiple commits.

### Task 4.1: Filter store + location helper

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/src/stores/filterStore.ts` (new, ~50), `/Users/marcelobatista/Desktop/enchufate-V2/src/lib/location.ts` (new, ~40).
- **Estimated lines**: ~90 lines.
- **Dependencies**: 1.4.
- **Acceptance criteria**:
  - `filterStore` exposes `filters: { estado, conector, potencia, precio, distancia }` and `setFilter(category, value)`, `resetFilters()`.
  - `location.ts` exports `requestLocationPermission()` and `getCurrentPosition()` using `expo-location`.
- **Commit strategy**: 1 commit — `feat(map): add filter store and location helper`.

### Task 4.2: Inicio screen + home assets preload

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/app/(public)/_layout.tsx` (~20), `app/(public)/index.tsx` (~95), `/Users/marcelobatista/Desktop/enchufate-V2/app.json` (+5 lines for asset registration).
- **Estimated lines**: ~120 lines.
- **Dependencies**: 1.5, 2.2.
- **Acceptance criteria**:
  - Inicio renders the "Enchufate" wordmark and the `home_card_.png` hero.
  - Two CTA cards: "Buscar un cargador" (white) navigates to `(tabs)/map`; "Publicar mi cargador" (orange) navigates to `/login?returnTo=/publish/1-name` if logged out, else `/publish/1-name`.
  - Image is preloaded with `Asset.fromModule(...).downloadAsync()` on mount.
  - No user-personalized content is rendered.
- **Commit strategy**: 1 commit — `feat(home): add Inicio brand surface with two CTA cards`.

### Task 4.3: useChargers hook + chargers table migration (data only, no RLS yet)

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/src/features/chargers/hooks/useChargers.ts` (new, ~60), `src/features/chargers/types.ts` (~20), `/Users/marcelobatista/Desktop/enchufate-V2/supabase/migrations/20260718000001_init_chargers.sql` (~50).
- **Estimated lines**: ~130 lines.
- **Dependencies**: 1.3, 1.4.
- **Acceptance criteria**:
  - `useChargers(filters)` returns `{ data, isLoading, error }` from TanStack Query with `staleTime: 30_000`.
  - The migration creates the `chargers` table with all columns, enums, and indexes from `design.md §3.2`. **RLS policies are NOT in this migration** (they land in Phase 6 alongside the publish flow).
  - The hook reads `filters` from `useFilterStore()` and passes them to `.from('chargers').select()`.
- **Commit strategy**: 2 commits — `feat(db): add chargers table migration (no RLS yet)` then `feat(chargers): add useChargers hook with filter passthrough`.

### Task 4.4: Map screen + pins + recenter FAB + native clustering

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/app/(public)/map.tsx` (~180), `app.json` (+10 lines for location permission strings).
- **Estimated lines**: ~190 lines.
- **Dependencies**: 2.2, 4.1, 4.3.
- **Acceptance criteria**:
  - `@maplibre/maplibre-react-native` is installed via `pnpm`; `MapView` uses OpenFreeMap's `liberty` style URL and a region covering Uruguay (default: Montevideo -34.9, -56.16, zoom 11).
  - **Native clustering enabled**: charger pins are a `ShapeSource` with `cluster: true`, `clusterRadius: 50`, `clusterMaxZoom: 14`. The cluster count renders in a `SymbolLayer` (no extra plugin needed).
  - At zoom < 14 the user sees clusters (with count bubble); at zoom >= 14 the individual `cargador.png` pins render.
  - Markers use the preloaded `cargador.png` asset; each is `tappable` and navigates to `/charger/[id]` (route is built but the screen lives in Phase 6 — Expo Router will 404 gracefully until then).
  - FAB is anchored bottom-right and recenters the map on user location (or Uruguay fallback).
  - On first mount, `requestLocationPermission()` is called.
  - A denied permission triggers a one-time toast "Activá la ubicación para centrar el mapa" (toast component lands in Phase 8; for now a console.warn is acceptable).
  - `app.json` includes the location permission strings (NSLocationWhenInUseUsageDescription on iOS, ACCESS_FINE_LOCATION on Android).
  - **OSM attribution is visible**: "© OpenFreeMap © OpenStreetMap contributors" (OSM ToS requirement).
  - **No tokens, no env vars** — OpenFreeMap is open and keyless.
- **Commit strategy**: 3 commits — `chore(deps): add @maplibre/maplibre-react-native` then `feat(map): add MapLibre view with OpenFreeMap tiles, charger pins, clusters, and recenter FAB` then `chore: add iOS/Android location permission strings to app.json`.

### Task 4.5: FiltersSheet organism + 5 chip-group sections

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/src/components/organisms/FiltersSheet.tsx` (new, ~140).
- **Estimated lines**: ~140 lines.
- **Dependencies**: 2.2, 4.1, 4.4.
- **Acceptance criteria**:
  - Uses `@gorhom/bottom-sheet` `BottomSheetModal` with snap points `['25%', '50%', '90%']`.
  - Five chip-group sections: Estado, Conector, Potencia, Precio, Distancia.
  - `Reset` (text `Button`) clears selections; `Aplicar` (orange `Button`) closes the sheet and persists to `useFilterStore`.
  - The "Filtros" pill on the map screen opens the sheet.
- **Commit strategy**: 1 commit — `feat(map): add FiltersSheet bottom sheet with 5 chip groups`.

### Task 4.6: Tab bar layout (5 tabs) + per-tab EmptyState wiring

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/app/(tabs)/_layout.tsx` (new, ~70), `app/(tabs)/index.tsx` (~10, re-export from public Inicio), `app/(tabs)/map.tsx` (~10, re-export), `app/(tabs)/messages.tsx` (~30 with EmptyState), `app/(tabs)/reservations.tsx` (~30), `app/(tabs)/profile.tsx` (~30).
- **Estimated lines**: ~180 lines.
- **Dependencies**: 3.1, 4.2, 4.4.
- **Acceptance criteria**:
  - 5 tabs in order: Inicio, Mapa, Mensajes, Reservas, Perfil.
  - Active tab tinted `colors.primary`; inactive dark gray.
  - `Mensajes`, `Reservas`, `Perfil` render `EmptyState` with "Iniciá sesión" CTA when `session === null`.
  - The CTA navigates to `/login?returnTo=<tab-route>`.
- **Commit strategy**: 1 commit — `feat(nav): add 5-tab layout with per-tab auth gates and empty states`.

> **Phase 4 PR**: tasks 4.1 → 4.6. ~720 lines. Single PR is feasible under the 800 budget.

### Task 4.1: Filter store + location helper

- **Status (apply-phase-4, 2026-07-18)**: ✅ Complete. `src/stores/filterStore.ts` (97 lines) exposes `filters` + `draft` (the draft+apply pattern) and `setDraft/applyDraft/resetFilters`. `src/lib/location.ts` (92 lines) wraps `expo-location` with `requestLocationPermission/getCurrentPosition/getLastKnownPosition/URUGUAY_FALLBACK`. Committed as `bf390f5`.

### Task 4.2: Inicio screen + home assets preload

- **Status (apply-phase-4, 2026-07-18)**: ✅ Complete. `app/(tabs)/index.tsx` now renders the Enchufate wordmark + `home_card_.png` hero + two CTA cards (Buscar → /(tabs)/map; Publicar → /publish/1-name as `never`-cast). Committed as `141c2fd`.

### Task 4.3: useChargers hook + chargers table migration

- **Status (apply-phase-4, 2026-07-18)**: ✅ Complete (mock data path; real Supabase swap lands in Phase 6). `src/features/chargers/{types.ts, data/mockChargers.ts, hooks/useChargers.ts}` (~467 lines source) and `supabase/migrations/20260718000001_init_chargers.sql` (64 lines, no RLS). 15 hardcoded chargers around Montevideo. Committed as `c630ce3`.

### Task 4.4: Map screen + pins + recenter FAB + native clustering

- **Status (apply-phase-4, 2026-07-18)**: ✅ Complete. `app/(tabs)/map.tsx` rewritten with `@maplibre/maplibre-react-native@11.3.6` (Map + GeoJSONSource cluster: true + clusterMaxZoom: 14 + 3 Layers: cluster circle / cluster count symbol / individual `cargador.png` symbol). OpenFreeMap liberty style; OSM attribution footer. FAB anchored bottom-right; Filtros pill at top. Pin tap logs to console (Phase 6 will navigate to /charger/[id]). Committed as `ddc4a3e` (alongside the 4 openspec documentation updates for the MapLibre decision).

### Task 4.5: FiltersSheet organism + 5 chip-group sections

- **Status (apply-phase-4, 2026-07-18)**: ✅ Complete. `src/components/organisms/FiltersSheet.tsx` (212 lines) — first organism. Wraps `@gorhom/bottom-sheet@5` `BottomSheetModal` with snap points 25/50/90%, 5 sections (Estado / Conector / Potencia / Precio / Distancia) rendered via `FilterChipRow`. Reset clears both draft + filters; Aplicar commits draft and closes. Committed as `4bf293c`.

### Task 4.6: Tab bar layout (5 tabs) + per-tab EmptyState wiring

- **Status (apply-phase-4, 2026-07-18)**: ✅ Complete. `app/_layout.tsx` got `BottomSheetModalProvider` between SafeAreaProvider and Stack (required by the Filtros sheet). `app/(tabs)/{messages,reservations,profile}.tsx` got `as never` casts on the `/login?returnTo=...` router.push calls (the `/login` route lands in Phase 3; Expo Router 404s silently until then). Committed as `ba2a8d4`.

> **Phase 4 actual**: tasks 4.1 → 4.6. **7 work-unit commits**, ~1307 source lines (over the 800 budget — see return summary for `size:exception` rationale; work-unit commits keep each chunk under ~200 lines so the PR is reviewable per-commit).

---

## Phase 5: Auth-gated tabs (Mensajes + Reservas + Profile)

> **Goal**: Logged-in users see real data on the three auth-gated tabs; reservations list works (read-only for now, mutations land in Phase 7).
> **PRs**: **2–3 chained PRs (~845 lines total)** — exceeds 800.
>
> - **Phase 5 PR-A — Profile** (~310 lines): tasks 5.1 + 5.2.
> - **Phase 5 PR-B — Mensajes** (~280 lines): tasks 5.3 + 5.4 + 5.5.
> - **Phase 5 PR-C — Reservas + reservation detail** (~255 lines): tasks 5.6 + 5.7 + 5.8.

### Task 5.1: Profile hooks (useProfile, useMyChargers) + types

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/src/features/profile/types.ts` (~15), `hooks/useProfile.ts` (~35), `hooks/useMyChargers.ts` (~35).
- **Estimated lines**: ~85 lines.
- **Dependencies**: 1.3, 1.4.
- **Acceptance criteria**:
  - `useProfile(userId)` reads `profiles` keyed by user id with `staleTime: 60_000`.
  - `useMyChargers()` returns chargers where `owner_id = auth.uid()` with `staleTime: 30_000`.
  - Both expose `{ data, isLoading, error }` and return typed `Profile` / `Charger` shapes.
- **Commit strategy**: 1 commit — `feat(profile): add useProfile and useMyChargers hooks`.

### Task 5.2: Profile screen (both states) + sign-out wiring

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/app/(tabs)/profile.tsx` (~155).
- **Estimated lines**: ~155 lines.
- **Dependencies**: 3.1, 4.6, 5.1, 2.3.
- **Acceptance criteria**:
  - Logged-out: avatar placeholder with "CE" initials, "Bienvenido" title, body copy, orange "Iniciá sesión" button.
  - Logged-in: avatar, display name, "Miembro desde {month} de {year}", three stat cards (Rating `0.0`, Reseñas `0`, Cargadores live count), "Mis cargadores" section with "Publicar nuevo" pill, disabled 3-dot menu per charger, "Cerrar sesión" at the bottom.
  - Tapping "Cerrar sesión" calls `useSignOut`; the screen re-renders the empty state.
  - 0 chargers renders the "Todavía no publicaste cargadores" hint.
- **Commit strategy**: 1 commit — `feat(profile): add logged-out and authenticated profile states`.

> **Phase 5 PR-A**: tasks 5.1 + 5.2. ~240 lines. Well under 800.

### Task 5.3: Messaging hooks (useConversations, useMessages, useSendMessage) + types

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/src/features/messaging/types.ts` (~20), `hooks/useConversations.ts` (~45), `hooks/useMessages.ts` (~60), `hooks/useSendMessage.ts` (~65).
- **Estimated lines**: ~190 lines.
- **Dependencies**: 1.3, 1.4.
- **Acceptance criteria**:
  - `useConversations()` returns conversations where `renter_id = auth.uid() OR host_id = auth.uid()`, ordered by `last_message_at desc`.
  - `useMessages(convId)` returns paginated messages (50 per page) with `fetchNextPage` and `hasNextPage`.
  - `useSendMessage` is optimistic: it inserts a pending message, rolls back on error, invalidates `['messages', convId]` on settled.
  - All hooks return typed `{ data, isLoading, error }` shapes.
- **Commit strategy**: 2 commits — `feat(messaging): add useConversations and useMessages hooks` then `feat(messaging): add optimistic useSendMessage with rollback`.
- **Status (apply-phase-5, 2026-07-19)**: ✅ Complete (mock data path; real Supabase swap lands in Phase 7). `src/features/messaging/types.ts` (84 lines, `Message` + `Conversation` interfaces mirroring the schema; `MessageKind` enum matches the `public.messages` enum; `otherParty()` helper for the list/thread screen to pick the right participant). `data/mockConversations.ts` (73 lines, 3 conversations with one unread). `data/mockMessages.ts` (71 lines, per-conversation message arrays covering `user` / `system_reservation_requested` / `system_reservation_confirmed` kinds in ascending order). `hooks/useConversations.ts` (54 lines, `staleTime: 15_000`, gated on `userId` AND `isFeatureEnabled('CHAT')`; returns empty array when the flag is off). `hooks/useMessages.ts` (57 lines, `staleTime: 0` so Realtime invalidations win in Phase 7, same CHAT flag gate). `hooks/useSendMessage.ts` (114 lines, optimistic `onMutate` inserts a `pending: true` message and snapshots the previous list; `onError` rolls back from the snapshot; `onSettled` invalidates `['messages', convId]`; `mutationFn` is a mock that resolves after 100ms with a synthetic `local-*` id — Phase 7 swaps it for the real `.from('messages').insert(...)` call). All errors wrapped via `normalizeSupabaseError` per AGENTS.md rule #3.

### Task 5.4: Mensajes list screen with search bar

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/app/(tabs)/messages.tsx` (~95).
- **Estimated lines**: ~95 lines.
- **Dependencies**: 2.3, 3.1, 4.6, 5.3.
- **Acceptance criteria**:
  - Search bar "Buscar conversaciones" filters by other-party display name.
  - Each row shows avatar, display name, last message preview, relative timestamp.
  - Tapping a row navigates to `/messages/[id]` (the route is wired but the screen lands in 5.5).
- **Commit strategy**: 1 commit — `feat(messaging): add Mensajes list with search and last-message preview`.
- **Status (apply-phase-5, 2026-07-19)**: ✅ Complete. `app/(tabs)/messages.tsx` (~270 lines, replaces the 28-line Phase 4 stub). Branches on `useSession()`: LoadingState during hydration, EmptyState with "Inicia sesion" CTA when no session, full list when signed in. Authed state has a search bar ("Buscar conversaciones" placeholder) that filters by other-party name via the `otherParty()` helper, a `FlatList` of `ConversationRow`s (avatar + name + time + last-message preview + unread dot when `unread_count > 0`), and an empty state when the filtered list is empty (with different copy for "no conversations" vs "no results for {query}"). All errors wrapped via `<ErrorState />` with `userMessage`. Tapping a row pushes to `/messages/${id}`.

### Task 5.5: 1:1 thread screen `/messages/[id]`

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/app/messages/[id].tsx` (~145).
- **Estimated lines**: ~145 lines.
- **Dependencies**: 2.3, 5.3.
- **Acceptance criteria**:
  - Header has back arrow, other-party avatar + name + "Desconectado" status.
  - Message list scrolls infinitely (50 at a time).
  - Input bar with "Escribí un mensaje" placeholder and a paper-plane send `Button`.
  - `MessageBubble` distinguishes user / system_* kinds per the messaging spec.
- **Commit strategy**: 1 commit — `feat(messaging): add 1:1 thread screen with composer and infinite scroll`.
- **Status (apply-phase-5, 2026-07-19)**: ✅ Complete. `app/messages/[id].tsx` (~310 lines, new route). Custom header (back arrow + other-party avatar + name + "Desconectado" status — built inline rather than via `Stack.Screen` so the avatar + status render as a single row). Inverted `FlatList` of `MessageBubble`s (data reversed in a `useMemo` so the most recent message renders at the bottom; the inverted layout means new messages auto-scroll to the bottom). Composer with a multi-line `TextInput` ("Escribí un mensaje" placeholder, max 500 chars) + a circular primary `Pressable` with the `Send` icon, disabled when the input is empty or a send is in flight. `useMessages` + `useSendMessage` wired in; the optimistic message renders with a "Enviando..." timestamp + a small `Clock` icon via the new `pending` prop on `MessageBubble`. The `MessageBubble` atom was extended with `isOwn?: boolean` and `pending?: boolean` props so the thread can render incoming (other-party) user messages on the left in gray, outgoing on the right in orange, and system messages consistently on the left in gray (the spec's right-aligned orange for `system_reservation_confirmed` / `system_reservation_cancelled` is deferred to Phase 7 when the real system-message-injector Edge Function lands — see deviation note in the apply-progress artifact).

> **Phase 5 PR-B**: tasks 5.3 + 5.4 + 5.5. ~430 lines. Under 800.

### Task 5.6: Reservations hooks (useReservations, useReservation) + types

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/src/features/reservations/types.ts` (~20), `hooks/useReservations.ts` (~55), `hooks/useReservation.ts` (~45).
- **Estimated lines**: ~120 lines.
- **Dependencies**: 1.3, 1.4.
- **Acceptance criteria**:
  - `useReservations(role: 'renter' | 'host')` returns the correct list (renter = `renter_id = uid`; host = `charger_id in (owned)`).
  - `useReservation(id)` returns a single reservation joined with charger.
  - Both return `{ data, isLoading, error }` with `staleTime: 15_000`.
  - **Mutations are NOT in this task** (they land in Phase 7).
- **Commit strategy**: 1 commit — `feat(reservations): add useReservations and useReservation read hooks`.

### Task 5.7: Reservas list screen with segmented control

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/app/(tabs)/reservations.tsx` (~125).
- **Estimated lines**: ~125 lines.
- **Dependencies**: 2.4, 3.1, 4.6, 5.6.
- **Acceptance criteria**:
  - Segmented control with two tabs: "Mis reservas" (renter) and "En mis cargadores" (host).
  - Each card shows status pill, date, charger title, truncated address, time block, power.
  - Host card shows the guest's name with a green "M" avatar.
  - Tapping a card navigates to `/reservation/[id]` (5.8).
- **Commit strategy**: 1 commit — `feat(reservations): add two-tab segmented list with reservation cards`.

### Task 5.8: Reservation detail screen `/reservation/[id]`

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/app/reservation/[id].tsx` (~135).
- **Estimated lines**: ~135 lines.
- **Dependencies**: 2.4, 5.6.
- **Acceptance criteria**:
  - Shows charger info (with link to `/charger/[id]`), the other party's name, the time block, the status pill.
  - "Chatear" CTA navigates to `/messages/[threadId]` (thread id is the conversation id, found via `charger_id + currentUserId`).
- **Commit strategy**: 1 commit — `feat(reservations): add reservation detail screen with Chatear CTA`.

> **Phase 5 PR-C**: tasks 5.6 + 5.7 + 5.8. ~380 lines. Under 800.

---

## Phase 6: Charger detail + Publicar wizard

> **Goal**: Hosts can publish a charger via the 7-step wizard; renters can view the full detail and start a reservation request (the request submission lands in Phase 7).
> **PRs**: **3–4 chained PRs (~1,500 lines total)** — the largest phase, by far.
>
> - **Phase 6 PR-A — Charger detail** (~290 lines): tasks 6.1 + 6.2 + 6.3.
> - **Phase 6 PR-B — Publish infra + step 1–2** (~290 lines): tasks 6.4 + 6.5 + 6.6.
> - **Phase 6 PR-C — Publish steps 3–4** (~330 lines): task 6.7.
> - **Phase 6 PR-D — Publish steps 5–7 + success** (~510 lines): task 6.8.

### Task 6.1: Charger table RLS + storage bucket

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/supabase/migrations/20260718000005a_chargers_rls.sql` (~60), `/Users/marcelobatista/Desktop/enchufate-V2/supabase/migrations/20260718000007_storage_charger_photos.sql` (~30).
- **Estimated lines**: ~90 lines.
- **Dependencies**: 1.3.
- **Acceptance criteria**:
  - RLS enabled on `chargers` with 4 policies: `chargers_select_active`, `chargers_insert_own`, `chargers_update_own`, `chargers_delete_own` (per `design.md §3.7`).
  - Storage bucket `charger-photos` created with public read and owner-only write/delete (path: `{owner_id}/{charger_id}/{photo_index}.jpg`).
  - A manual integration test confirms a guest cannot UPDATE another user's charger.
- **Commit strategy**: 1 commit — `feat(db): enable RLS on chargers and create charger-photos storage bucket`.

### Task 6.2: useCharger hook + Zod schemas (charger, reservation, message)

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/src/features/chargers/hooks/useCharger.ts` (~55), `/Users/marcelobatista/Desktop/enchufate-V2/src/lib/schemas/charger.ts` (~60), `reservation.ts` (~40), `message.ts` (~20).
- **Estimated lines**: ~175 lines.
- **Dependencies**: 1.4, 6.1.
- **Acceptance criteria**:
  - `useCharger(id)` returns a single charger joined with the host profile, `staleTime: 5 * 60_000`.
  - `chargerSchema` validates title (1–80), description (≤500), power_kw (3.7–350), price_per_hour_usd (>0), photos (≤5), rules (≤300), schedule (jsonb with day keys).
  - `reservationSchema` enforces `start_at + end_at` OR `horario_a_coordinar`, with `end_at > start_at` when both set.
  - `messageSchema` enforces non-empty `body`, valid `kind` enum.
- **Commit strategy**: 2 commits — `feat(chargers): add useCharger hook` then `feat(schemas): add Zod schemas for charger, reservation, message`.

### Task 6.3: Charger detail screen `/charger/[id]`

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/app/charger/[id].tsx` (~190).
- **Estimated lines**: ~190 lines.
- **Dependencies**: 2.4, 4.4, 6.2.
- **Acceptance criteria**:
  - Photo gallery is a horizontal `ScrollView` with a "1/5" counter; falls back to `cargador.png` placeholder when empty.
  - Identity block: title, address, connector + power, price, status pill.
  - Map snippet (small non-interactive `MapView` with the same pin); tapping opens external Google Maps.
  - Host info block with display name, "Miembro desde {month} de {year}", star placeholder.
  - Full description and rules (rules block hidden if empty).
  - Sticky "Reservar" `Button` at the bottom; logged-out tap navigates to login with `returnTo = /charger/{id}`; logged-in tap opens `ReservationRequestSheet` (sheet is wired in Phase 7).
- **Commit strategy**: 1 commit — `feat(charger-detail): add charger detail screen with photo gallery and sticky Reservar CTA`.

> **Phase 6 PR-A**: tasks 6.1 + 6.2 + 6.3. ~455 lines. Under 800.

### Task 6.4: publishStore (Zustand with persist) + PublishWizardNav organism

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/src/stores/publishStore.ts` (new, ~70), `/Users/marcelobatista/Desktop/enchufate-V2/src/components/organisms/PublishWizardNav.tsx` (new, ~60).
- **Estimated lines**: ~130 lines.
- **Dependencies**: 1.4, 2.2.
- **Acceptance criteria**:
  - `publishStore` holds `step` (1–7) and per-step data (name, location, connector, photos, pricing, schedule, rules). Uses `zustand/middleware` `persist` against `AsyncStorage`.
  - `PublishWizardNav` renders a top progress bar and "Atrás" / "Siguiente" buttons that mutate `publishStore`.
  - Validation per step is a pure function in the store; "Siguiente" stays disabled until valid.
- **Commit strategy**: 1 commit — `feat(publish): add Zustand publish store and wizard navigation organism`.

### Task 6.5: Publish wizard layout + BetaBanner pinned + step 1 (name + description)

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/app/publish/_layout.tsx` (~35), `app/publish/1-name.tsx` (~95).
- **Estimated lines**: ~130 lines.
- **Dependencies**: 3.1, 6.4.
- **Acceptance criteria**:
  - `_layout.tsx` renders `<BetaBanner />` pinned at the top and embeds the wizard stack with the back button hidden on step 1.
  - Step 1 has two `Input` fields with live counters; CTA "Siguiente" is disabled until both are valid per `chargerSchema` (1–80 / ≤500).
  - Description counter shows `n/500` live.
  - The screen reads from and writes to `publishStore`.
- **Commit strategy**: 1 commit — `feat(publish): add wizard layout with BetaBanner and step 1 (name)`.

### Task 6.6: Wizard step 2 (location) + location permission re-request

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/app/publish/2-location.tsx` (~135).
- **Estimated lines**: ~135 lines.
- **Dependencies**: 4.1, 6.5.
- **Acceptance criteria**:
  - On mount, calls `requestLocationPermission()` (does NOT rely on the Mapa screen's grant).
  - If granted: "Ubicación detectada" card with lat/lng + reverse-geocoded address; user can edit the address.
  - If denied: manual `Input` with helper "Escribí la dirección manualmente".
  - "Siguiente" is enabled once `address` and `lat`/`lng` are set.
- **Commit strategy**: 1 commit — `feat(publish): add step 2 (location) with permission re-request and manual fallback`.

> **Phase 6 PR-B**: tasks 6.4 + 6.5 + 6.6. ~395 lines. Under 800.

### Task 6.7: Wizard steps 3 (connector + power) and 4 (photos)

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/app/publish/3-connector.tsx` (~95), `app/publish/4-photos.tsx` (~135), `/Users/marcelobatista/Desktop/enchufate-V2/src/lib/imageUpload.ts` (~50).
- **Estimated lines**: ~280 lines.
- **Dependencies**: 6.2, 6.5.
- **Acceptance criteria**:
  - Step 3: 5 `Chip` options for connector type; numeric `Input` for power (3.7–350). Helper text "Entre 3.7 y 350 kW".
  - Step 4: "Agregar" placeholder tile calls `expo-image-picker`. Photos display in a 2-column grid with a red `X` delete button. Live counter "N de 5 seleccionadas". Photos are compressed via `imageUpload.ts` (1600px JPEG 80%, ≤8 MB).
  - "Siguiente" is disabled when validation fails.
- **Commit strategy**: 2 commits — `feat(publish): add step 3 (connector and power)` then `feat(publish): add step 4 (photos) with picker and image compression`.

> **Phase 6 PR-C**: task 6.7 alone. ~280 lines. Under 800.

### Task 6.8: Wizard steps 5 (pricing), 6 (schedule), 7 (rules) + success + usePublishCharger

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/app/publish/5-pricing.tsx` (~95), `app/publish/6-schedule.tsx` (~140), `app/publish/7-rules.tsx` (~95), `app/publish/success.tsx` (~55), `/Users/marcelobatista/Desktop/enchufate-V2/src/features/chargers/hooks/usePublishCharger.ts` (~120).
- **Estimated lines**: ~505 lines.
- **Dependencies**: 6.2, 6.5, 6.6, 6.7.
- **Acceptance criteria**:
  - Step 5: price `Input` with `USD` prefix and `/ hora` suffix; 5 chip options for min reservation (default 30 min).
  - Step 6: 7 day-of-week toggles; each day has a "Personalizar" or "No disponible" option with time range pickers. Default = 24/7 always available. Shape matches `chargers.schedule` jsonb.
  - Step 7: optional rules `Input` (textarea) with `0/300` counter. CTA changes to "Publicar".
  - `usePublishCharger` is a mutation that uploads photos to `charger-photos` (path `{owner_id}/{charger_id}/{index}.jpg`), then inserts the `chargers` row. On success it invalidates `['chargers']` and `['my-chargers', uid]`, resets `publishStore`, and `router.replace('/publish/success')`.
  - Success screen shows check circle, "Cargador publicado", body copy, and a "Ir a Mis cargadores" CTA that navigates to `/profile` (where the new charger appears).
- **Commit strategy**: 3 commits — `feat(publish): add step 5 (pricing) and step 6 (per-day schedule)` then `feat(publish): add step 7 (rules) and usePublishCharger mutation` then `feat(publish): add success screen with Mis cargadores CTA`.

> **Phase 6 PR-D**: task 6.8 alone. ~505 lines. Under 800.

---

## Phase 7: Reservation lifecycle

> **Goal**: Renter submits a reservation request; host confirms or either party cancels; system messages are injected into the chat; push notification stub is wired.
> **PR**: **1 PR (~650 lines)** — within budget.

### Task 7.1: Reservations + conversations + messages migrations + RLS

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/supabase/migrations/20260718000002_init_reservations.sql` (~40), `20260718000003_init_conversations_messages.sql` (~50), `20260718000005b_rls_reservations_conv_msg.sql` (~110).
- **Estimated lines**: ~200 lines.
- **Dependencies**: 1.3, 6.1.
- **Acceptance criteria**:
  - All 3 tables created with enums and indexes from `design.md §3.3–3.5`.
  - RLS policies: `reservations_select_party`, `reservations_insert_self`, `reservations_update_party`, `conversations_select_party`, `conversations_insert_renter`, `messages_select_party`, `messages_insert_user`. (`messages_insert_system` is intentionally OMITTED for `authenticated` — only service-role inserts system messages.)
  - Helper functions `is_charger_owner(p_charger_id)` and `is_reservation_party(p_reservation_id)` are created.
- **Commit strategy**: 1 commit — `feat(db): add reservations, conversations, and messages tables with RLS`.

### Task 7.2: Triggers (auto-conversation, requested msg, completed)

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/supabase/migrations/20260718000004_triggers.sql` (~95).
- **Estimated lines**: ~95 lines.
- **Dependencies**: 7.1.
- **Acceptance criteria**:
  - `handle_reservation_created()` upserts a conversation row on reservation insert (idempotent via `unique (charger_id, renter_id)`).
  - `handle_reservation_requested_system_message()` inserts a `system_reservation_requested` message with `sender_id = null` and templated copy "¡Hola! Quiero reservar {charger_title}.".
  - `handle_reservation_completed()` flips `confirmada` → `completada` when `end_at < now()`.
- **Commit strategy**: 1 commit — `feat(db): add reservation triggers for conversation, system message, and completion`.

### Task 7.3: Reservation state machine + mutation hooks (useCreateReservation, useConfirmReservation, useCancelReservation)

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/src/features/reservations/state.ts` (~40), `src/features/reservations/hooks/useCreateReservation.ts` (~50), `useConfirmReservation.ts` (~50), `useCancelReservation.ts` (~55).
- **Estimated lines**: ~195 lines.
- **Dependencies**: 5.6, 7.1.
- **Acceptance criteria**:
  - `state.ts` exports a `transitions` map and `isValidTransition(from, to): boolean` guard.
  - `useCreateReservation` inserts into `reservations`; on success invalidates `['reservations']` and `['conversations']`; rolls back optimistic insert on error.
  - `useConfirmReservation` and `useCancelReservation` early-return on invalid transitions; on success invoke the Edge Function (7.4) and invalidate the relevant query keys.
- **Commit strategy**: 2 commits — `feat(reservations): add state machine guard and useCreateReservation` then `feat(reservations): add useConfirmReservation and useCancelReservation with optimistic updates`.

### Task 7.4: Edge Function `system-message-injector`

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/supabase/functions/system-message-injector/index.ts` (~110), `deno.json` (~5).
- **Estimated lines**: ~115 lines.
- **Dependencies**: 7.1, 7.3.
- **Acceptance criteria**:
  - `POST { reservation_id, new_status: 'confirmada' | 'cancelada' }` endpoint.
  - Verifies the caller is a reservation party (via Supabase JWT).
  - Fetches the reservation + charger + conversation; formats the voseo template from `design.md §10.2`.
  - Inserts into `messages` with `sender_id = null` and the right `kind`; updates `conversations.last_message_at`.
  - Uses the service-role key from `Deno.env.get('SERVICE_ROLE_KEY')` (never the app's anon key).
- **Commit strategy**: 1 commit — `feat(functions): add system-message-injector Edge Function for confirm and cancel`.

### Task 7.5: Edge Function `notify-reservation-confirmed` stub

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/supabase/functions/notify-reservation-confirmed/index.ts` (~35), `deno.json` (~5).
- **Estimated lines**: ~40 lines.
- **Dependencies**: 7.4.
- **Acceptance criteria**:
  - `POST { reservation_id }` endpoint; logs the push intent; returns `{ ok: true, stub: true }`.
  - Real APNs/FCM wiring is deferred to v2.1; this is a placeholder for the polish-phase APNs key provisioning.
- **Commit strategy**: 1 commit — `feat(functions): add notify-reservation-confirmed push stub`.

### Task 7.6: ReservationCard confirm/cancel action wiring + confirm modal

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/src/components/molecules/ReservationCard.tsx` (modified, +35 lines), `/Users/marcelobatista/Desktop/enchufate-V2/app/(tabs)/reservations.tsx` (modified, +15 lines).
- **Estimated lines**: ~50 lines.
- **Dependencies**: 2.4, 7.3.
- **Acceptance criteria**:
  - Host cards expose a "Confirmar" `Button` when status is `solicitada`.
  - All cards expose a "Cancelar" `Button` when status is `solicitada` or `confirmada`.
  - Cancel opens `ConfirmModal` with copy "¿Cancelar la reserva de Cargador {title}?". Two actions: `Cancelar` (closes modal) and `Cancelar y volver` (commits the cancel).
- **Commit strategy**: 1 commit — `feat(reservations): wire confirm and cancel actions in ReservationCard with confirm modal`.

### Task 7.7: Realtime channel subscriptions (messages, reservations, conversations)

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/src/features/messaging/hooks/useMessages.ts` (modified, +30 lines), `/Users/marcelobatista/Desktop/enchufate-V2/src/features/reservations/hooks/useReservations.ts` (modified, +25 lines), `/Users/marcelobatista/Desktop/enchufate-V2/src/features/messaging/hooks/useConversations.ts` (modified, +20 lines).
- **Estimated lines**: ~75 lines.
- **Dependencies**: 5.3, 5.6, 7.1.
- **Acceptance criteria**:
  - `useMessages` subscribes to `messages:conv={id}` and invalidates `['messages', convId]` on `INSERT`.
  - `useReservations` subscribes to a per-user channel (renter side: `renter_id=eq.{uid}`; host side: `charger_id=in.{owned_ids}` via RPC) and invalidates `['reservations']` on `UPDATE`.
  - `useConversations` subscribes to `conversations:user` and invalidates `['conversations']` on `UPDATE`.
  - All channels clean up on unmount.
- **Commit strategy**: 1 commit — `feat(realtime): subscribe to Supabase channels for messages, reservations, and conversations`.

> **Phase 7 PR**: tasks 7.1 → 7.7. ~650 lines. Single PR.

---

## Phase 8: Polish

> **Goal**: Error boundaries catch render failures; location permission UX is friendly; assets are preloaded; offline message queueing works.
> **PR**: **1 PR (~350 lines)** — well within budget.

### Task 8.1: ErrorBoundary component + wrap screens

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/src/components/ErrorBoundary.tsx` (~55), `/Users/marcelobatista/Desktop/enchufate-V2/app/_layout.tsx` (modified, +15 lines), `/Users/marcelobatista/Desktop/enchufate-V2/app/(public)/map.tsx` (modified, +5 lines).
- **Estimated lines**: ~75 lines.
- **Dependencies**: 1.5, 2.3.
- **Acceptance criteria**:
  - `ErrorBoundary` is a class component that catches render errors and shows `ErrorState` with a "Reintentar" button that resets the boundary.
  - Root layout wraps children in the boundary.
  - Map screen is wrapped in a second, map-specific boundary that falls back to a friendly retry card on tile-load failure (per map spec non-functional note).
- **Commit strategy**: 1 commit — `feat(components): add ErrorBoundary and wrap root and map screens`.

### Task 8.2: Image preloading + feature flags wired

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/app/(public)/index.tsx` (modified, +10 lines), `/Users/marcelobatista/Desktop/enchufate-V2/app/(public)/map.tsx` (modified, +10 lines), `/Users/marcelobatista/Desktop/enchufate-V2/src/config/features.ts` (modified, +10 lines).
- **Estimated lines**: ~30 lines.
- **Dependencies**: 1.5, 4.2, 4.4.
- **Acceptance criteria**:
  - `Asset.fromModule(require('.../cargador.png')).downloadAsync()` is called on map mount.
  - `Asset.fromModule(require('.../home_card_.png')).downloadAsync()` is called on Inicio mount.
  - `EXPO_PUBLIC_FEATURE_PUBLICAR` flag (default true) gates the orange "Publicar mi cargador" CTA in dev/staging; `EXPO_PUBLIC_FEATURE_MAPA` gates the Mapa tab.
- **Commit strategy**: 1 commit — `feat(perf): preload charger pin and home hero assets; wire feature flags`.

### Task 8.3: Location-permission toast + permission-denied UX refinement

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/src/components/Toast.tsx` (~60), `/Users/marcelobatista/Desktop/enchufate-V2/src/lib/location.ts` (modified, +15 lines), `/Users/marcelobatista/Desktop/enchufate-V2/app/(public)/map.tsx` (modified, +10 lines).
- **Estimated lines**: ~85 lines.
- **Dependencies**: 4.1, 4.4.
- **Acceptance criteria**:
  - `Toast` is a tiny context-driven component with `useToast().show(message, variant)` and renders at the top of the screen for 3 seconds.
  - `Toast.show("Activá la ubicación para centrar el mapa", "info")` is called on the map screen when the FAB is tapped and permission is denied.
  - The map's recenter FAB gracefully falls back to Uruguay when no permission is granted.
- **Commit strategy**: 1 commit — `feat(ux): add Toast component and refine location-denied fallback on Mapa`.

### Task 8.4: Query persister for offline messages + format.ts date helpers

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/src/lib/queryPersister.ts` (~45), `/Users/marcelobatista/Desktop/enchufate-V2/src/lib/format.ts` (modified, +25 lines), `/Users/marcelobatista/Desktop/enchufate-V2/app/_layout.tsx` (modified, +10 lines).
- **Estimated lines**: ~80 lines.
- **Dependencies**: 5.3, 1.4.
- **Acceptance criteria**:
  - `queryPersister` uses `@tanstack/query-async-storage-persister` to back the TanStack Query cache with `AsyncStorage`.
  - `format.ts` adds `formatDateLong(date)` ("17 de julio de 2026") and `formatTimeShort(date)` ("15:30") for the charger detail and reservation detail screens.
  - Root layout attaches the persister to the `QueryClient`.
- **Commit strategy**: 1 commit — `feat(lib): add query persister for offline messages and extended formatters`.

### Task 8.5: Per-screen loading skeletons + publish exit guard

- **Files**: `/Users/marcelobatista/Desktop/enchufate-V2/src/components/molecules/LoadingState.tsx` (modified, +35 lines for variant skeletons), `/Users/marcelobatista/Desktop/enchufate-V2/app/publish/_layout.tsx` (modified, +25 lines for exit guard).
- **Estimated lines**: ~60 lines.
- **Dependencies**: 1.5, 6.5, 6.8.
- **Acceptance criteria**:
  - `LoadingState` accepts a `variant: 'spinner' | 'skeleton-list' | 'skeleton-card'` prop and renders the appropriate placeholder.
  - Publish wizard intercepts hardware back button / swipe-back; if `publishStore.step > 1`, shows a `ConfirmModal` "Salir del wizard? Perderás los datos." with "Salir" and "Seguir editando" actions.
- **Commit strategy**: 1 commit — `feat(ux): add loading skeletons and publish wizard exit guard`.

> **Phase 8 PR**: tasks 8.1 → 8.5. ~330 lines. Single PR.

---

## Acceptance criteria for the whole MVP

These are the high-level checks that should be run after every phase. They mirror the proposal's acceptance criteria but are tied to the phase ordering above.

1. **Phase 1 done** when `pnpm tsc --noEmit` passes and `pnpm expo prebuild --no-install` exits 0.
2. **Phase 2 done** when `<Button>`, `<Card>`, `<Input>`, `<Chip>`, `<StatusPill>`, `<BetaBanner>`, `<FAB>`, `<Avatar>`, `<Icon>`, `<Divider>`, and the 9 molecules render in a dev Storybook page (or via the Storybook-less dev screen `__tests__/_dev.tsx`).
3. **Phase 3 done** when a user can sign up, sign in, sign out, reset password, and complete Google OAuth in the Expo Go dev build.
4. **Phase 4 done** when a logged-out user can open the Inicio + Mapa tabs and see charger pins from a seeded Supabase row; Filtros bottom sheet filters the list.
5. **Phase 5 done** when a logged-in user can open Mensajes (empty), Reservas (empty), and Perfil (authenticated state).
6. **Phase 6 done** when a host can complete the 7-step wizard and see their new charger on the map; a guest can open `/charger/[id]` and see the full detail.
7. **Phase 7 done** when a renter submits a reservation request (system message appears in chat), the host confirms (system message appears, push stub logs), and either party can cancel (system message appears).
8. **Phase 8 done** when an `ErrorBoundary` catches a forced render error, the map shows a "Activá la ubicación" toast on FAB-tap-while-denied, and the message thread survives a full app restart (query persister).
