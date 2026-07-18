# enchufate-V2 — Onboarding State

> **Status**: pre-development / greenfield
> **Date**: 2026-07-18
> **Phase**: post-`sdd-init`, pre-first-change

This document is the entry point for any agent (human or AI) picking up the
project. It describes what exists, what is planned, and what to do next.

---

## What exists now

| Path | Purpose |
|------|---------|
| `openspec/config.yaml` | SDD project config (rules per phase, planned stack) |
| `openspec/specs/` | Empty — main spec source of truth (delta specs merge here on archive) |
| `openspec/changes/` | Empty — active changes go here |
| `openspec/changes/archive/` | Empty — completed changes go here on archive |
| `openspec/ONBOARDING.md` | This file |
| `.atl/skill-registry.md` | Skill index for sub-agent routing |

## What does NOT exist yet

- No `package.json` — Expo project not yet bootstrapped
- No `tsconfig.json` — TypeScript config not yet applied
- No `app.json` — Expo app config not yet created
- No `src/` — feature-based folder structure not yet created
- No `supabase/` — no migrations, no RLS policies, no RPCs
- No `.env` — Supabase keys not yet wired (token was revoked; do not commit)
- No git history — repo not yet initialized
- No tests — `strict_tdd: false` until jest-expo is installed
- No AGENTS.md — team conventions not yet documented

## What exists in the workspace as assets (NOT code)

| File | Role | Disposition |
|------|------|-------------|
| `cargador.png` | Charger icon | Move to `assets/icons/` when project is bootstrapped |
| `home_card_.png` | Home hero image | Move to `assets/images/` |
| `icon.png` | App icon | Move to `assets/` |
| `WhatsApp Image 2026-07-18 at 13.40.*.jpeg` (30+ files) | Wireframe / mockup references from WhatsApp | **Exclude from git** — do not commit; move to `docs/wireframes/` (gitignored) or delete after V2 design is finalized |

## Next steps (in order)

1. **Bootstrap the Expo project** (when user is ready):
   ```bash
   npx create-expo-app@latest . --template blank-typescript
   ```
   This must run BEFORE the first SDD cycle so there is code to apply specs to.

2. **Apply TypeScript config**: enable strict mode, path alias `@/*` → `src/*`.

3. **Install Expo Router 6**: `npx expo install expo-router` and switch to file-based routing.

4. **Bootstrap Supabase client**: `src/lib/supabase.ts` with `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` (user must provide a fresh anon key — the V1 token was revoked).

5. **Set up the first SDD cycle** with one of:
   - `/sdd-new project-bootstrap` — formalize the bootstrapping work above
   - `/sdd-new auth-foundation` — start with Supabase Auth (email + Google OAuth)
   - `/sdd-explore` — first explore the wireframes (the 30+ WhatsApp JPEGs) to derive a feature list

## Persistence map (hybrid mode)

| Artifact | Filesystem | Engram |
|----------|------------|--------|
| Init context | `openspec/config.yaml` | `sdd-init/enchufate-v2` (id 207) |
| Testing capabilities | (in config.yaml) | `sdd/enchufate-v2/testing-capabilities` (id 208) |
| Skill registry | `.atl/skill-registry.md` | `skill-registry` (id 72) |
| Bootstrap state | `openspec/ONBOARDING.md` (this file) | `sdd/enchufate-v2-bootstrap/state` (id 209) |

## Strict TDD

`strict_tdd: false`. Will be re-evaluated after `npx create-expo-app` + Jest setup.
See `openspec/config.yaml` `rules.apply.tdd`.

## Risks

1. **No git repo yet** — `git init` should be the very first step before any code is written, so SDD artifacts get version-controlled from day one.
2. **No `.gitignore`** — the 30+ wireframe JPEGs in the workspace root must be excluded; create `.gitignore` with `*.jpeg`, `node_modules/`, `.expo/`, `dist/`, `*.log`, `.env*` at minimum.
3. **Supabase token revoked** — V2 cannot connect to the existing Supabase project until the user provides a fresh anon key.
4. **V1 drift** — V2 inherits lessons from V1 but should NOT import V1 code; the folder structure and migration history must be fresh.
5. **No tests** — feature work that produces user-facing behavior should add a test plan before implementation; revisit `strict_tdd` decision after the first sprint.

## Related projects

- **V1**: `/Users/marcelobatista/Desktop/enchufate-app` (working code, completed SDD cycles including `reservation-redesign`; serves as reference only)
- **V2**: this project (greenfield)
