# Enchufate V2

Peer-to-peer EV charger marketplace for Uruguay. Discover chargers nearby, book a slot, chat with the host.

> **Status**: Phase 1 (Foundation). The Expo app boots, Supabase client is wired, and the 5-tab skeleton renders. Subsequent phases add auth, chargers, reservations, and messaging.

---

## Quickstart

```bash
# 1. Install deps
pnpm install

# 2. Provide your Supabase credentials
cp .env.example .env
# then edit .env and fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY

# 3. Start the dev server
pnpm start
```

Press `i` for iOS, `a` for Android, or `w` for web.

> **Without a Supabase anon key the app will crash on launch** — `src/lib/supabase.ts` throws if the env vars are missing. Use any placeholder URL/key to bypass the crash and explore the empty UI.

## Stack

- Expo SDK 54 + Expo Router 6 (file-based, typed routes)
- React Native 0.81 + React 19
- TypeScript strict + `@/*` path alias → `src/*`
- Supabase (`@supabase/supabase-js`)
- TanStack Query (server state cache)
- Zustand (cross-tab UI state)

## Project layout

```
app/                       # Expo Router file-based routes
  _layout.tsx              # Root layout
  (tabs)/                  # 5-tab bottom bar
src/
  components/              # Atomic design (atoms, molecules, organisms)
  features/                # Feature-scoped hooks + types
    auth/ chargers/ reservations/ messages/ profile/
  lib/                     # Supabase client, shared utilities
  theme/                   # Design tokens (Phase 2 fills in the values)
supabase/                  # Migrations + Edge Functions (lands Phase 3+)
openspec/                  # SDD artifacts (proposal, specs, design, tasks)
docs/wireframes/           # V2 design mockups (gitignored)
```

## Scripts

| Script | What it does |
|---|---|
| `pnpm start` | Start the Expo dev server |
| `pnpm android` | Open Android |
| `pnpm ios` | Open iOS |
| `pnpm web` | Open web bundle |
| `pnpm typecheck` | Run `tsc --noEmit` |
| `pnpm lint` | Run ESLint (expo config) |

## What comes next

See `openspec/changes/2026-07-18-mvp-bootstrap/tasks.md` for the full phase plan. Phase 1 is the foundation; Phases 2-8 add the design system, auth, public + auth-gated tabs, charger publishing, reservation lifecycle, and polish.
