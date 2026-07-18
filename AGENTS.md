# AGENTS.md — enchufate-v2

> Read this **before** you do anything else. Then read
> [`openspec/ONBOARDING.md`](./openspec/ONBOARDING.md) for project
> state and the active change under `openspec/changes/`.

## Project at a glance

- **What**: Peer-to-peer EV charger marketplace for Uruguay. Hosts
  publish chargers, guests discover them on a map, book a slot, and
  chat. Built for the Uruguayan market (UYU pricing, Spanish UI).
- **Stage**: Phase 1 (Foundation) shipped. Phases 2–8 add design
  system, auth, public + auth-gated tabs, charger publishing,
  reservation lifecycle, and polish.
- **Track the plan**: `openspec/changes/2026-07-18-mvp-bootstrap/tasks.md`.

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Expo SDK 54 + Expo Router 6 (file-based, typed routes) |
| Runtime | React Native 0.81 + React 19.1 |
| Language | TypeScript strict (`noUncheckedIndexedAccess`, `noImplicitOverride`) |
| Path alias | `@/*` → `src/*` (tsconfig + babel-preset-expo) |
| Server state | TanStack Query v5 (`@/lib/queryClient`) |
| Client state | Zustand (`@/stores/*`, lands in Phase 4) |
| Backend | Supabase (`@/lib/supabase`) — Postgres + Auth + Realtime + Storage |
| Auth storage | `expo-secure-store` via `@/lib/secureStorage` |
| Native deps installed | `expo-constants`, `expo-router`, `expo-secure-store`, `expo-status-bar`, `react-native-gesture-handler`, `react-native-safe-area-context`, `react-native-screens` |
| Package manager | **pnpm only** — see "Hard rules" below |

## Hard rules

1. **pnpm only.** `pnpm install`, `pnpm add <pkg>`, `pnpm dlx`. Never
   `npm` or `yarn` — the lockfile is `pnpm-lock.yaml`. Use
   `npx --yes expo install <pkg>` for SDK-versioned native deps so
   `expo` picks the SDK-54-compatible version.
2. **No app code in this batch / phase scaffolding.** Each phase has
   a scope. Don't reach ahead — Phase 2 builds design tokens, Phase
   3 builds auth, etc. If a task needs something from a later phase,
   flag it and stop.
3. **Rioplatense voseo for UI copy.** "Iniciá sesión", "Publicá tu
   cargador", "hace 5 min", "$ 15,50". Use `es-UY` for `Intl`
   formatters (number, date, relative time). Code comments and
   identifiers stay in English.
4. **No hex literals outside `src/theme/`.** Every color, spacing
   value, and radius must come from the design tokens. The only
   exceptions are: (a) the root `app.json` splash/icon, (b) the
   `+not-found.tsx` literal (pre-Phase 2), and (c) migration SQL.
5. **Conventional commits only.** No `Co-Authored-By` lines. Format:
   `type(scope): subject` — e.g. `feat(map): add useChargers hook`.
   Allowed types: `feat`, `fix`, `chore`, `docs`, `refactor`,
   `test`, `style`, `perf`.
6. **No secrets in commits.** `.env` is gitignored. Ship anon keys
   only; `service_role` is for Edge Functions on the server.
7. **No `git push` from a sub-agent.** Push and PRs are the user's
   call. Sub-agents commit locally only.
8. **No `*.jpeg` in git.** Wireframes are gitignored at
   `docs/wireframes/`. See `.gitignore`.

## SDD workflow

Every change goes through the same lifecycle:

1. **Find the active change** under `openspec/changes/`. The
   proposal/spec/design/tasks artifacts live there.
2. **Follow proposal → spec → design → tasks → apply → verify → archive.**
   - `sdd-propose` — intent, scope, approach.
   - `sdd-spec` — requirements + scenarios (acceptance criteria).
   - `sdd-design` — technical design and architecture.
   - `sdd-tasks` — implementation breakdown with review workload forecast.
   - `sdd-apply` — code the tasks.
   - `sdd-verify` — run the acceptance criteria.
   - `sdd-archive` — sync delta specs into `openspec/specs/`.
3. **Respect the workload forecast.** If `tasks.md` says
   `Chained PRs recommended: Yes`, split the work into stacked PRs
   per the `Chain strategy` field. Don't merge a >400-line batch
   into one PR without explicit `size:exception`.
4. **Mark tasks `[x]` as you go** in `openspec/changes/.../tasks.md`.
   Don't batch the checkbox updates at the end.
5. **Save apply-progress to Engram** at topic key
   `sdd/{change-name}/apply-phase-{N}` so the next sub-agent can
   pick up where the previous one stopped.

## Feature flags

All v2.1 features live behind a single typed object in
`@/lib/features.ts`. Before adding new functionality:

1. Read `src/lib/features.ts`.
2. If the feature already has a flag, branch on
   `isFeatureEnabled('KEY')`.
3. If it doesn't, propose a new flag in the change's `design.md`
   and add it to the `FEATURES` object as `false` until the
   subsystem ships.

The current flags:

| Flag | State | Phase |
|------|-------|-------|
| `CHAT` | on | 5 |
| `RESERVATIONS` | on | 6 |
| `PUBLISH` | on | 5 |
| `PUSH_NOTIFICATIONS` | off | v2.1 |
| `IN_APP_PAYMENTS` | off | v2.1 |
| `EDIT_CHARGER` | off | v2.1 |
| `CHARGER_REVIEWS` | off | v2.1 |

## Things we never touch

- **`/Users/marcelobatista/Desktop/enchufate-app/`** — V1 lives there.
  Do not import code, copy patterns, or read V1 source for
  inspiration beyond what's documented in the V2 specs. The V1
  wireframes, however, are a legitimate reference and inform V2
  design.
- **`docs/wireframes/`** — gitignored WhatsApp mockups. Read them
  locally; never `git add` them.
- **`.atl/`, `.agents/`, `skills-lock.json`** — gentle-ai tooling
  state. Sub-agents write here; project source does not.
- **`supabase/.temp/`** — Supabase CLI scratch dir. Gitignored.

## V1 reference (read-only)

V1 is a working Expo + Supabase app at
`/Users/marcelobatista/Desktop/enchufate-app/`. Useful as a sanity
check for "how does this work in practice" but never as a source
to copy. The V1 SDD cycle `reservation-redesign` resolved several
decisions (e.g. `Horario a coordinar` as the default scheduling
mode) that V2 inherits — those are documented in
`openspec/specs/reservations/spec.md`.

## Conventions

- **Feature-scoped folders**: `src/features/{auth,chargers,reservations,messages,profile}/`
  each contain `hooks/`, `types.ts`, and (later) `mutations/`. A
  hook is owned by one feature; cross-feature reuse goes through
  the store or a shared util.
- **Pure utilities only in `src/lib/`**. No React imports, no
  Supabase queries, no `process.env` reads except in
  `src/lib/supabase.ts` and `src/lib/secureStorage.ts`.
- **Type-safe Supabase calls**: `supabase.from('chargers').select()`
  is typed via the `Database` generic in `src/lib/database.types.ts`.
  The file is regenerated by `supabase gen types typescript` after
  every migration — do not hand-edit it.
- **Errors as `AppError`**: every feature hook wraps Supabase /
  network / unknown errors via `normalizeSupabaseError` before
  returning. UI reads `error.userMessage` and `error.isNetworkError`
  — never the raw `Error.message`.
- **Formatters are pure and locale-aware**: `@/lib/format` exports
  `formatPrice`, `formatDistance`, `formatDateTime`,
  `formatRelativeTime`. No side effects, no React.

## Quick commands

```bash
pnpm install              # install deps (pnpm only)
pnpm typecheck            # tsc --noEmit
pnpm start                # expo dev server
pnpm ios                  # native iOS dev (requires prebuild)
pnpm android              # native Android dev (requires prebuild)
pnpm expo export --platform ios   # bundle for iOS (Metro only, no native build)
```

First time you run a native build:

```bash
pnpm expo prebuild --no-install
pnpm ios   # or pnpm android
```

## Sanity checks before any commit

- `git status` — only project files staged, no `*.jpeg`, no
  `node_modules`, no `.env`.
- `pnpm tsc --noEmit` — zero errors.
- `pnpm expo export --platform ios` — succeeds with the new code.

If any check fails, fix it before committing. If a sanity check
fails for an environmental reason (e.g. network), document it in the
return summary — do not skip silently.
