# Design: MVP Bootstrap — Visual + Functional Foundation

> **Change**: `mvp-bootstrap`
> **Date**: 2026-07-18
> **Mode**: hybrid (openspec + engram)
> **Stack**: Expo SDK 54 + TypeScript strict + Expo Router 6 + Supabase + TanStack Query + Zustand + Reanimated 3
> **Source**: `proposal.md` (approved) + 11 capability specs + `.atl/exploration-report.md`

---

## TL;DR

Enchufate-V2 is a 5-tab Expo Router 6 app backed by a single Supabase project. UI consumes feature hooks (`src/features/*`) that wrap TanStack Query; the cache is the single source of truth for server state. Zustand holds cross-tab UI state (filters, wizard draft). The reservation lifecycle is server-authoritative: two transitions (`confirmada`, `cancelada`) run through one Supabase Edge Function that injects templated chat messages and dispatches the (deferred) push notification. RLS gates every table; the app only ever holds the anon key.

---

## 1. Architecture overview

**Mental model.** Expo Router 6 owns the route tree (`app/`) and deep-link routing. Every screen renders an atomic component tree (`src/components/atoms|molecules|organisms`) that delegates data to a feature hook (`src/features/<name>/hooks/*`). The hook calls `@tanstack/react-query`, which talks to `src/lib/supabase.ts` — a typed client instantiated once with the anon key. Server state lives in TanStack Query's cache (keyed by resource), cross-tab UI state lives in Zustand stores, local screen state lives in `useState` / `useReducer`. Realtime is wired through `supabase.channel(...)` subscriptions that invalidate query keys on `INSERT/UPDATE`. Mutations are optimistic and roll back on Supabase error.

**Layer diagram.**

```
┌────────────────────────────────────────────────────────────────────────┐
│  UI layer (src/components/atoms|molecules|organisms + app/* routes)    │
│  ─ Button, Card, Input, ChargerCard, MessageBubble, EmptyState, FAB    │
└────────────────────────────┬───────────────────────────────────────────┘
                             │ renders, dispatches user input
┌────────────────────────────▼───────────────────────────────────────────┐
│  Screen logic (app/<route>.tsx)                                        │
│  ─ composes hooks, owns local state, returns JSX                       │
└────────────────────────────┬───────────────────────────────────────────┘
                             │ reads/writes
┌────────────────────────────▼───────────────────────────────────────────┐
│  Feature hooks (src/features/<name>/hooks/*)                           │
│  ─ useChargers, useCharger, useReservations, useConversations,         │
│    useMessages, useProfile, useSession, useRequireAuth                 │
└────────────────────────────┬───────────────────────────────────────────┘
                             │ queries/mutations
┌────────────────────────────▼───────────────────────────────────────────┐
│  Data layer                                                            │
│  ─ TanStack Query (cache + optimistic mutations)                       │
│  ─ Supabase client (src/lib/supabase.ts, typed with Database generic)  │
│  ─ Zod schemas (src/lib/schemas/*) for input validation                │
└────────────────────────────┬───────────────────────────────────────────┘
                             │ HTTPS + WebSocket
┌────────────────────────────▼───────────────────────────────────────────┐
│  Supabase backend                                                      │
│  ─ Postgres + RLS + Triggers (auth.users → profiles)                   │
│  ─ Edge Functions (system-message-injector)                            │
│  ─ Auth (email + Google OAuth)                                         │
│  ─ Realtime (Postgres replication on messages, reservations)           │
│  ─ Storage (charger-photos bucket, public read, owner write)           │
└────────────────────────────────────────────────────────────────────────┘
```

**Cross-cutting state stores (Zustand).**

| Store | Purpose | Consumed by |
|-------|---------|-------------|
| `useAuthStore` | Shadow of `supabase.auth.session`; lets non-React code (e.g. error reporters) read auth state | Root layout, `useRequireAuth` |
| `useFilterStore` | Map filter selections (Estado, Conector, Potencia, Precio, Distancia) | Mapa screen, Filtros sheet |
| `usePublishStore` | Wizard draft state (step data across 7 steps) | `/publish/*` routes |

**State ownership table.**

| State type | Lives in | Examples | Why |
|------------|----------|----------|-----|
| Server data (REST-ish) | TanStack Query cache | charger list, charger detail, reservations, conversations, messages history, profile | Cache, dedupe, stale-while-revalidate, optimistic mutations |
| Real-time streams | Supabase Realtime channel + Query invalidation | new messages, reservation state changes | Push to client without polling; Query is the cache write target |
| Auth session | Supabase client + `useAuthStore` shadow | session, user, expiresAt | Supabase owns it; shadow is for sync reads |
| Cross-tab UI | Zustand | filters, wizard draft | Survives tab switches and route pops |
| Local screen state | `useState` / `useReducer` | form values before submit, sheet open/closed | Ephemeral; doesn't need global cache |
| Form submission status | TanStack Query mutation state | `useReservations().create.isPending` | Built-in loading/error semantics |

---

## 2. Directory structure

**Rationale.** Expo Router 6 owns the `app/` directory; that is the route table and must follow file-based conventions (parens for groups, `[id]` for dynamic segments, `_layout.tsx` for nested layouts). Everything else — components, hooks, libs, theme, features, supabase, tests — lives under `src/` with the `@/*` path alias. This split keeps the framework's "magic" folder (`app/`) isolated from the bulk of the application code, which is portable to a different routing scheme if we ever migrate.

```
enchufate-V2/
├── app/                              # Expo Router 6 — file-based routes ONLY
│   ├── _layout.tsx                   # Root layout: providers, QueryClientProvider, AuthProvider
│   ├── (public)/
│   │   ├── _layout.tsx               # Stack for public tabs
│   │   ├── index.tsx                 # Inicio (Home)
│   │   └── map.tsx                   # Mapa (Google Maps)
│   ├── (auth)/                       # Auth-gated route group
│   │   ├── _layout.tsx               # Tab bar layout
│   │   ├── login.tsx
│   │   ├── signup.tsx
│   │   ├── reset.tsx
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx           # 5-tab bar
│   │   │   ├── index.tsx             # Inicio (re-export from (public))
│   │   │   ├── map.tsx               # Mapa (re-export)
│   │   │   ├── messages.tsx          # Mensajes (gated)
│   │   │   ├── reservations.tsx      # Reservas (gated)
│   │   │   └── profile.tsx           # Perfil (gated)
│   │   └── messages/
│   │       └── [id].tsx              # 1:1 thread
│   ├── charger/
│   │   └── [id].tsx                  # Charger detail
│   ├── reservation/
│   │   └── [id].tsx                  # Reservation detail
│   ├── publish/
│   │   ├── _layout.tsx               # Wizard stack (BetaBanner pinned)
│   │   ├── 1-name.tsx
│   │   ├── 2-location.tsx
│   │   ├── 3-connector.tsx
│   │   ├── 4-photos.tsx
│   │   ├── 5-pricing.tsx
│   │   ├── 6-schedule.tsx            # Inferred from F3
│   │   ├── 7-rules.tsx
│   │   └── success.tsx
│   └── +not-found.tsx
│
├── src/
│   ├── components/
│   │   ├── atoms/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Chip.tsx
│   │   │   ├── StatusPill.tsx
│   │   │   ├── BetaBanner.tsx
│   │   │   ├── FAB.tsx
│   │   │   ├── Avatar.tsx
│   │   │   ├── Icon.tsx               # Wrapper over @expo/vector-icons
│   │   │   └── Divider.tsx
│   │   ├── molecules/
│   │   │   ├── ChargerCard.tsx
│   │   │   ├── ReservationCard.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── ErrorState.tsx
│   │   │   ├── LoadingState.tsx
│   │   │   ├── ConfirmModal.tsx
│   │   │   ├── ReservationRequestSheet.tsx
│   │   │   └── ChargerListItem.tsx
│   │   └── organisms/
│   │       ├── FiltersSheet.tsx
│   │       ├── PublishWizardNav.tsx
│   │       └── ChatHeader.tsx
│   ├── features/
│   │   ├── auth/
│   │   │   ├── hooks/
│   │   │   │   ├── useSession.ts
│   │   │   │   ├── useRequireAuth.ts
│   │   │   │   ├── useSignIn.ts
│   │   │   │   ├── useSignUp.ts
│   │   │   │   ├── useSignOut.ts
│   │   │   │   ├── useGoogleOAuth.ts
│   │   │   │   └── useResetPassword.ts
│   │   │   └── types.ts
│   │   ├── chargers/
│   │   │   ├── hooks/
│   │   │   │   ├── useChargers.ts
│   │   │   │   ├── useCharger.ts
│   │   │   │   └── usePublishCharger.ts
│   │   │   └── types.ts
│   │   ├── reservations/
│   │   │   ├── hooks/
│   │   │   │   ├── useReservations.ts
│   │   │   │   ├── useReservation.ts
│   │   │   │   ├── useCreateReservation.ts
│   │   │   │   ├── useConfirmReservation.ts
│   │   │   │   └── useCancelReservation.ts
│   │   │   └── types.ts
│   │   ├── messages/
│   │   │   ├── hooks/
│   │   │   │   ├── useConversations.ts
│   │   │   │   ├── useMessages.ts
│   │   │   │   └── useSendMessage.ts
│   │   │   └── types.ts
│   │   └── profile/
│   │       ├── hooks/
│   │       │   ├── useProfile.ts
│   │       │   └── useMyChargers.ts
│   │       └── types.ts
│   ├── stores/
│   │   ├── authStore.ts
│   │   ├── filterStore.ts
│   │   └── publishStore.ts
│   ├── lib/
│   │   ├── supabase.ts               # createClient<Database>(...)
│   │   ├── database.types.ts         # generated: supabase gen types typescript
│   │   ├── queryClient.ts            # QueryClient + default options
│   │   ├── secureStorage.ts          # expo-secure-store wrapper
│   │   ├── location.ts               # expo-location helpers
│   │   ├── imageUpload.ts            # compress + upload to charger-photos
│   │   ├── error.ts                  # AppError + normalizeSupabaseError
│   │   ├── format.ts                 # date/time, "hace X min", currency
│   │   └── schemas/                  # Zod schemas
│   │       ├── charger.ts
│   │       ├── reservation.ts
│   │       └── message.ts
│   ├── theme/
│   │   ├── index.ts                  # re-exports
│   │   ├── colors.ts
│   │   ├── spacing.ts
│   │   ├── radius.ts
│   │   ├── typography.ts
│   │   └── shadows.ts
│   └── config/
│       └── features.ts               # EXPO_PUBLIC_FEATURE_* flags
│
├── supabase/
│   ├── config.toml                   # project id, port, etc.
│   ├── migrations/
│   │   ├── 20260718000000_init_profiles.sql
│   │   ├── 20260718000001_init_chargers.sql
│   │   ├── 20260718000002_init_reservations.sql
│   │   ├── 20260718000003_init_conversations_messages.sql
│   │   ├── 20260718000004_triggers.sql
│   │   ├── 20260718000005_rls_policies.sql
│   │   ├── 20260718000006_realtime_publication.sql
│   │   └── 20260718000007_storage_charger_photos.sql
│   └── functions/
│       ├── system-message-injector/
│       │   ├── index.ts              # POST { reservation_id, new_status }
│       │   └── deno.json
│       └── notify-reservation-confirmed/
│           ├── index.ts              # stub: writes notifications row in MVP
│           └── deno.json
│
├── assets/
│   ├── icon.png                      # from workspace root
│   ├── images/
│   │   └── home_card_.png            # from workspace root
│   ├── icons/
│   │   └── cargador.png              # from workspace root
│   └── fonts/                        # if any (TBD)
│
├── __tests__/
│   ├── setup.ts                      # jest-expo setup, mocks
│   ├── theme/
│   │   ├── colors.test.ts
│   │   ├── spacing.test.ts
│   │   └── radius.test.ts
│   ├── components/
│   │   ├── Button.test.tsx           # snapshot + variant render
│   │   ├── StatusPill.test.tsx
│   │   └── EmptyState.test.tsx
│   ├── lib/
│   │   ├── format.test.ts            # "hace 22 min"
│   │   └── error.test.ts             # normalizeSupabaseError
│   └── hooks/
│       ├── useChargers.test.ts       # mocked Supabase
│       └── useMessages.test.ts       # mocked Supabase
│
├── .env.example                      # EXPO_PUBLIC_SUPABASE_URL=...
├── .env                              # gitignored
├── .gitignore                        # *.jpeg, node_modules/, .expo/, .env*
├── app.json
├── babel.config.js
├── metro.config.js
├── tsconfig.json                     # strict + paths { "@/*": ["src/*"] }
├── eas.json                          # post-MVP; placeholder
├── jest.config.js                    # jest-expo preset
├── jest.setup.js
├── package.json
├── pnpm-lock.yaml
├── AGENTS.md                         # team conventions (V2-specific)
└── openspec/                         # OpenSpec artifacts (unchanged)
```

**Path alias.** `tsconfig.json` declares `paths: { "@/*": ["src/*"] }` and `babel.config.js` adds `babel-plugin-module-resolver` so runtime imports resolve the same way. The `@/` alias is used everywhere outside `app/`.

---

## 3. Supabase schema

All migrations live under `supabase/migrations/` and run in lexical order. Migrations are append-only; destructive changes ship with paired `down.sql`.

### 3.1 `profiles`

```sql
create type subscription_status as enum ('inactive', 'active', 'past_due', 'cancelled');

create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null,
  full_name       text,
  avatar_url      text,
  is_subscribed   boolean not null default false,           -- placeholder; v2.1 billing
  subscription_status subscription_status not null default 'inactive',
  push_token      text,                                     -- APNs/FCM device token (v2.1)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_profiles_email on public.profiles (email);

-- Auto-create profile on auth.users insert
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

### 3.2 `chargers`

```sql
create type connector_type as enum ('tipo_1', 'tipo_2', 'ccs', 'chademo', 'tesla');
create type charger_status as enum ('active', 'paused');

create table public.chargers (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  title           text not null check (char_length(title) between 1 and 80),
  description     text not null check (char_length(description) <= 500),
  address         text not null,
  lat             double precision not null,
  lng             double precision not null,
  connector_type  connector_type not null,
  power_kw        numeric(6, 2) not null check (power_kw between 3.7 and 350),
  price_per_hour_usd numeric(8, 2) not null check (price_per_hour_usd > 0),
  min_reservation_minutes integer not null default 30
                       check (min_reservation_minutes in (30, 60, 120, 240, 480)),
  photos          text[] not null default '{}'::text[] check (array_length(photos, 1) <= 5),
  rules           text check (rules is null or char_length(rules) <= 300),
  schedule        jsonb not null default '{
    "mon":[{"from":"00:00","to":"23:59"}],
    "tue":[{"from":"00:00","to":"23:59"}],
    "wed":[{"from":"00:00","to":"23:59"}],
    "thu":[{"from":"00:00","to":"23:59"}],
    "fri":[{"from":"00:00","to":"23:59"}],
    "sat":[{"from":"00:00","to":"23:59"}],
    "sun":[{"from":"00:00","to":"23:59"}]
  }'::jsonb,
  status          charger_status not null default 'active',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_chargers_owner on public.chargers (owner_id);
create index idx_chargers_status on public.chargers (status);
create index idx_chargers_geo on public.chargers using gist (point(lng, lat));
```

**Schedule shape (jsonb).** Each key is a day-of-week (`mon`..`sun`); the value is an array of `{ from: "HH:MM", to: "HH:MM" }` windows. Empty array = "No disponible" that day. Default = 24/7 every day. Validated at the data layer (Zod) before INSERT/UPDATE; a Postgres `CHECK` validates top-level keys but not time-string format.

### 3.3 `reservations`

```sql
create type reservation_status as enum ('solicitada', 'confirmada', 'cancelada', 'completada');

create table public.reservations (
  id                      uuid primary key default gen_random_uuid(),
  charger_id              uuid not null references public.chargers(id) on delete cascade,
  renter_id               uuid not null references public.profiles(id) on delete cascade,
  start_at                timestamptz,
  end_at                  timestamptz,
  horario_a_coordinar     text,
  status                  reservation_status not null default 'solicitada',
  cancelled_by            uuid references public.profiles(id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  -- Q5 default: time storage is hybrid (either structured OR free text)
  constraint chk_time_or_text check (
    (start_at is not null and end_at is not null)
    or horario_a_coordinar is not null
  ),
  constraint chk_time_order check (start_at is null or end_at is null or end_at > start_at)
);

create index idx_reservations_charger on public.reservations (charger_id);
create index idx_reservations_renter on public.reservations (renter_id);
create index idx_reservations_status on public.reservations (status);
create index idx_reservations_start_at on public.reservations (start_at);
```

### 3.4 `conversations`

```sql
create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  charger_id      uuid not null references public.chargers(id) on delete cascade,
  renter_id       uuid not null references public.profiles(id) on delete cascade,
  host_id         uuid not null references public.profiles(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  -- one conversation per (charger, renter) pair; host is implied by charger.owner_id
  unique (charger_id, renter_id)
);

create index idx_conversations_renter on public.conversations (renter_id);
create index idx_conversations_host on public.conversations (host_id);
create index idx_conversations_last_message_at on public.conversations (last_message_at desc);
```

### 3.5 `messages`

```sql
create type message_kind as enum (
  'user',
  'system_reservation_requested',
  'system_reservation_confirmed',
  'system_reservation_cancelled'
);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid references public.profiles(id) on delete set null,  -- null for system
  body            text not null,
  kind            message_kind not null default 'user',
  created_at      timestamptz not null default now()
);

create index idx_messages_conversation_created
  on public.messages (conversation_id, created_at desc);
```

### 3.6 Triggers

```sql
-- Auto-create conversation when a reservation is created (idempotent via unique constraint)
create or replace function public.handle_reservation_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host_id uuid;
  v_conv_id uuid;
begin
  select owner_id into v_host_id from public.chargers where id = new.charger_id;

  insert into public.conversations (charger_id, renter_id, host_id)
  values (new.charger_id, new.renter_id, v_host_id)
  on conflict (charger_id, renter_id) do update set last_message_at = now()
  returning id into v_conv_id;

  return new;
end;
$$;

create trigger trg_reservation_created
  after insert on public.reservations
  for each row execute function public.handle_reservation_created();

-- System message injection on reservation state transitions
-- Decision: only the "requested" message is auto-injected via trigger.
-- "confirmed" and "cancelled" are dispatched by the Edge Function because they
-- also need to send push and need the full body context.
create or replace function public.handle_reservation_requested_system_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv_id uuid;
  v_charger_title text;
begin
  select id, title into v_conv_id, v_charger_title
  from public.conversations c
  join public.chargers ch on ch.id = c.charger_id
  where c.charger_id = new.charger_id and c.renter_id = new.renter_id;

  insert into public.messages (conversation_id, sender_id, body, kind)
  values (
    v_conv_id,
    null,  -- system message
    format('¡Hola! Quiero reservar %s.', v_charger_title),
    'system_reservation_requested'
  );

  update public.conversations set last_message_at = now() where id = v_conv_id;

  return new;
end;
$$;

create trigger trg_reservation_requested_msg
  after insert on public.reservations
  for each row execute function public.handle_reservation_requested_system_message();

-- Auto-mark completed reservations
create or replace function public.handle_reservation_completed()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'confirmada'
     and new.end_at is not null
     and new.end_at < now()
     and old.status <> 'completada' then
    new.status := 'completada';
  end if;
  return new;
end;
$$;

create trigger trg_reservation_completed
  before update on public.reservations
  for each row execute function public.handle_reservation_completed();
```

### 3.7 RLS policies

**Helper functions** (used in policies):

```sql
create or replace function public.is_charger_owner(p_charger_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.chargers where id = p_charger_id and owner_id = auth.uid());
$$;

create or replace function public.is_reservation_party(p_reservation_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.reservations r
    where r.id = p_reservation_id
      and (r.renter_id = auth.uid() or public.is_charger_owner(r.charger_id))
  );
$$;
```

| Table | Policy name | Operation | Rule |
|-------|-------------|-----------|------|
| `profiles` | `profiles_select_all` | SELECT | `true` — anyone can read profile metadata for hosts shown in listings |
| `profiles` | `profiles_update_own` | UPDATE | `id = auth.uid()` |
| `profiles` | `profiles_insert_own` | INSERT | `id = auth.uid()` (rare; trigger handles it normally) |
| `chargers` | `chargers_select_active` | SELECT | `status = 'active' OR owner_id = auth.uid()` |
| `chargers` | `chargers_insert_own` | INSERT | `owner_id = auth.uid()` |
| `chargers` | `chargers_update_own` | UPDATE | `owner_id = auth.uid()` |
| `chargers` | `chargers_delete_own` | DELETE | `owner_id = auth.uid()` |
| `reservations` | `reservations_select_party` | SELECT | `renter_id = auth.uid() OR is_charger_owner(charger_id)` |
| `reservations` | `reservations_insert_self` | INSERT | `renter_id = auth.uid()` and `status = 'solicitada'` |
| `reservations` | `reservations_update_party` | UPDATE | `renter_id = auth.uid() OR is_charger_owner(charger_id)` (host confirm; both cancel) |
| `conversations` | `conversations_select_party` | SELECT | `renter_id = auth.uid() OR host_id = auth.uid()` |
| `conversations` | `conversations_insert_renter` | INSERT | `renter_id = auth.uid()` and `host_id = (select owner_id from chargers where id = charger_id)` |
| `messages` | `messages_select_party` | SELECT | conversation party: `exists (select 1 from conversations c where c.id = conversation_id and (c.renter_id = auth.uid() or c.host_id = auth.uid()))` |
| `messages` | `messages_insert_user` | INSERT | sender_id = auth.uid() AND conversation party check (user messages) |
| `messages` | `messages_insert_system` | INSERT | restricted to `service_role` only — system messages are inserted by the Edge Function (see §10) |

> **Note on system messages**: regular authenticated users cannot INSERT `kind != 'user'` rows. The `messages_insert_system` policy is omitted for `authenticated` role; only the Edge Function (which authenticates with `service_role`) can do it. RLS is bypassed in service-role context.

### 3.8 Realtime (Postgres replication)

```sql
-- Enable replication on the tables the client subscribes to
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.reservations;
alter publication supabase_realtime add table public.conversations;
```

**Client subscriptions** (in `useMessages`, `useReservations`, `useConversations`):

| Channel name | Filter | Emitted on | Invalidation |
|--------------|--------|------------|--------------|
| `messages:conv={id}` | `conversation_id=eq.{id}` | INSERT on `messages` | `['messages', convId]` |
| `reservations:user` | `renter_id=eq.{uid} OR charger_id=in.{owned_ids}` (host side uses an RPC) | UPDATE on `reservations` | `['reservations', 'all']` and `['reservation', id]` |
| `conversations:user` | `renter_id=eq.{uid} OR host_id=eq.{uid}` | UPDATE on `conversations` (last_message_at) | `['conversations']` |

### 3.9 Storage: `charger-photos` bucket

```sql
insert into storage.buckets (id, name, public)
values ('charger-photos', 'charger-photos', true)
on conflict (id) do nothing;

-- Public read for everyone
create policy "charger_photos_select_public"
  on storage.objects for select
  using (bucket_id = 'charger-photos');

-- Owner-only write: path format is {owner_id}/{charger_id}/{photo_index}.jpg
create policy "charger_photos_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'charger-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "charger_photos_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'charger-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

Images are resized client-side (max 1600px on the long edge, JPEG 80%) via `expo-image-manipulator` before upload. The public path makes them displayable directly in `expo-image` without signed URLs.

---

## 4. Data layer (TypeScript)

### 4.1 Client

```ts
// src/lib/supabase.ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import type { Database } from './database.types';

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient<Database>(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
```

> **Note on SecureStore + Expo Go**: `expo-secure-store` works in Expo Go as of SDK 50+; Expo SDK 54 confirmed compatible. We do NOT use AsyncStorage for the auth token (auth spec non-functional).

### 4.2 Generated types

`supabase gen types typescript --project-id qmoomdsaqywltaretbef --schema public > src/lib/database.types.ts` — runs in `sdd-apply` as part of bootstrap. The Database generic provides typed `.from('chargers').select()` chains.

### 4.3 Feature hooks (signatures only)

| Hook | Query key | Returns | Stale time |
|------|-----------|---------|------------|
| `useSession()` | `['session']` | `{ session, user, isLoading }` | 0 (driven by `onAuthStateChange`) |
| `useRequireAuth(returnTo)` | — | `{ session }` or null + redirect | — |
| `useChargers(filters)` | `['chargers', filters]` | `{ data, isLoading, error }` | 30s |
| `useCharger(id)` | `['charger', id]` | `{ data, isLoading, error }` | 5 min |
| `useReservations(role)` | `['reservations', role]` | `{ data, isLoading, error }` | 15s |
| `useReservation(id)` | `['reservation', id]` | `{ data, isLoading, error }` | 15s |
| `useConversations()` | `['conversations']` | `{ data, isLoading, error }` | 15s |
| `useMessages(convId)` | `['messages', convId]` | `{ data, isLoading, error, fetchNextPage, hasNextPage }` | 0 (Realtime invalidates) |
| `useProfile(userId)` | `['profile', userId]` | `{ data, isLoading, error }` | 60s |
| `useMyChargers()` | `['my-chargers', userId]` | `{ data, isLoading, error }` | 30s |

### 4.4 Mutation pattern (optimistic)

```ts
// src/features/messages/hooks/useSendMessage.ts (sketch — DO NOT IMPLEMENT HERE)
useMutation({
  mutationFn: (input: SendMessageInput) => supabase.from('messages').insert({...}),
  onMutate: async (input) => {
    await queryClient.cancelQueries({ queryKey: ['messages', input.conversationId] });
    const prev = queryClient.getQueryData<Message[]>(['messages', input.conversationId]);
    queryClient.setQueryData<Message[]>(['messages', input.conversationId], (old = []) => [
      ...old,
      { id: `temp-${Date.now()}`, kind: 'user', pending: true, ...input },
    ]);
    return { prev };
  },
  onError: (_err, _input, ctx) => {
    if (ctx?.prev) queryClient.setQueryData(['messages', input.conversationId], ctx.prev);
  },
  onSettled: (_data, _err, input) => {
    queryClient.invalidateQueries({ queryKey: ['messages', input.conversationId] });
  },
});
```

Optimistic mutations apply to: `useSendMessage`, `useCancelReservation`, `usePublishCharger` (step transitions), `useCreateReservation` (insert optimistic card into `Mis reservas`).

### 4.5 Error normalization

`src/lib/error.ts` exports `normalizeSupabaseError(err: unknown): AppError` and the typed `AppError` shape: `{ code: string; message: string; isAuthError: boolean; isNetworkError: boolean; retryable: boolean }`. Every hook wraps the Supabase error before returning it; UI reads `error.message` and `error.isNetworkError` for the right `<ErrorState />` variant.

### 4.6 Input validation (Zod)

`src/lib/schemas/{charger,reservation,message}.ts` define Zod schemas that match the RLS constraints (e.g. `chargerSchema.parse(formData)` before calling `usePublishCharger`). They are used **only at the client data layer boundary**, not in the database.

---

## 5. Theming & design system

### 5.1 Tokens

| File | Exports | Values |
|------|---------|--------|
| `src/theme/colors.ts` | `colors` | `primary: '#FF6B1F'`, `primaryDisabled: '#FFB98E'`, `primarySubtle: '#FFE6D5'`, `textPrimary: '#0F1419'`, `textSecondary: '#6B7280'`, `textOnPrimary: '#FFFFFF'`, `success: '#1FA774'`, `danger: '#DC2626'`, `surface: '#FFFFFF'`, `background: '#FAFAFA'`, `border: '#E5E7EB'`, `infoBg: '#DBEAFE'`, `infoText: '#1E3A8A'` |
| `src/theme/spacing.ts` | `spacing` | `xs: 4, sm: 8, md: 12, base: 16, lg: 20, xl: 24, xxl: 32` |
| `src/theme/radius.ts` | `radius` | `button: 12, card: 16, input: 12, chip: 999, pill: 999` |
| `src/theme/typography.ts` | `typography` | `display: 24/bold`, `title: 22/bold`, `heading: 18/semibold`, `body: 16/regular`, `caption: 14/regular`, `tab: 12/medium` |
| `src/theme/shadows.ts` | `shadows` | `card: { shadowOffset: {0,2}, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }` |

### 5.2 Atoms

| Atom | Variants | Consumed by |
|------|----------|-------------|
| `Button` | `primary` (orange), `secondary` (white, orange border), `ghost` (text only); sizes `sm`, `md`, `lg`; fullWidth | login, signup, publish wizard, success screen, confirm modal, charger detail CTA |
| `Card` | default; `padding=base` | charger detail blocks, reservation cards, auth form containers |
| `Input` | text, email, password (with show/hide toggle), numeric, textarea | login, signup, reset, publish steps 1/2/3/5/6/7, message composer |
| `Chip` | selected/unselected; size `sm`, `md` | publish steps 3, 5, 6; filters sheet |
| `StatusPill` | `success` (Disponible/Confirmada), `danger` (Cancelada), `neutral` (Solicitada) | charger card, reservation card, message bubble kind |
| `BetaBanner` | single variant; copy "Publicar es gratis durante la beta" | publish wizard (pinned) |
| `FAB` | single variant; circular; peach fill | mapa recenter |
| `Avatar` | size `sm`/`md`/`lg`; `initials` fallback | conversation list row, message header, profile header, charger detail host block, reservation card guest badge |
| `Icon` | wraps `@expo/vector-icons` (Ionicons); size `sm`/`md`/`lg`; tinted | tab bar, FAB, input adornments, status pill dots |
| `Divider` | horizontal/vertical; with "o continuá con" label variant | login screen |

### 5.3 Molecules

| Molecule | Composed of | Consumed by |
|----------|-------------|-------------|
| `ChargerCard` | `Card` + `Avatar` + `StatusPill` + `Icon` | map list view (future), profile "Mis cargadores" |
| `ReservationCard` | `Card` + `StatusPill` + `Avatar` + `Icon` + `Button` (cancel) | "Mis reservas" / "En mis cargadores" lists |
| `MessageBubble` | `Text` + `Icon` (read receipt / pending) | 1:1 thread |
| `EmptyState` | `Icon` + title + body + optional `Button` CTA | Mensajes/Reservas/Perfil logged-out, charger publish draft, conversation list (no data) |
| `ErrorState` | `Icon` + title + body + `Button` retry | every list-bearing screen on error |
| `LoadingState` | `ActivityIndicator` (orange tint) | every list-bearing screen on loading |
| `ConfirmModal` | `Modal` + title + body + two `Button` | reservation cancel, sign out, publish exit |
| `ReservationRequestSheet` | bottom sheet with date+time picker + "Lo antes posible" toggle | charger detail "Reservar" CTA |
| `ChargerListItem` | `ChargerCard` variant for horizontal list | profile "Mis cargadores" |

### 5.4 Spec → component map (consumption)

| Spec | Atoms | Molecules |
|------|-------|-----------|
| auth | Button, Input, Card, Divider, Icon, Avatar | — |
| design-system | All atoms | All molecules |
| tab-navigation | Icon | EmptyState, LoadingState |
| home | Button, Card, Icon | — |
| map | FAB, Chip, Icon, Button | FiltersSheet, EmptyState, ErrorState, LoadingState |
| charger-detail | Button (sticky), Chip, StatusPill, Avatar, Icon | ChargerListItem (header), ReservationRequestSheet |
| charger-publish | Button, Input, Chip, BetaBanner, Icon | — |
| reservations | Button, StatusPill, Card, Avatar, Icon | ReservationCard, ConfirmModal, EmptyState |
| messaging | Button, Input, Icon, Avatar, StatusPill | MessageBubble, EmptyState, LoadingState |
| profile | Button, Card, StatusPill, Avatar, Icon | EmptyState, ChargerListItem, ConfirmModal |

---

## 6. Navigation map (Expo Router 6)

### 6.1 Route tree

```
app/
├── _layout.tsx                          # Root: providers + auth gate redirect
├── +not-found.tsx
│
├── (public)/
│   ├── _layout.tsx                      # Stack: only Inicio + Mapa + auth
│   ├── index.tsx                        # → redirects to (auth)/(tabs)/index OR renders public Inicio
│   └── map.tsx                          # public Mapa
│
├── (auth)/
│   ├── _layout.tsx                      # Stack owning login/signup/reset
│   ├── login.tsx                        # /login
│   ├── signup.tsx                       # /signup
│   └── reset.tsx                        # /reset
│
├── (tabs)/
│   ├── _layout.tsx                      # Bottom tabs (5)
│   ├── index.tsx                        # Inicio
│   ├── map.tsx                          # Mapa
│   ├── messages.tsx                     # Mensajes (gated)
│   ├── reservations.tsx                 # Reservas (gated)
│   └── profile.tsx                      # Perfil (gated)
│
├── charger/
│   └── [id].tsx                         # /charger/:id
│
├── reservation/
│   └── [id].tsx                         # /reservation/:id
│
├── messages/
│   └── [id].tsx                         # /messages/:id  (1:1 thread; tab bar hidden)
│
└── publish/
    ├── _layout.tsx                      # Stack; BetaBanner pinned
    ├── 1-name.tsx
    ├── 2-location.tsx
    ├── 3-connector.tsx
    ├── 4-photos.tsx
    ├── 5-pricing.tsx
    ├── 6-schedule.tsx
    ├── 7-rules.tsx
    └── success.tsx
```

### 6.2 Public vs auth groups

The 5-tab bar lives in `(tabs)`. **Inicio** and **Mapa** are rendered regardless of session. **Mensajes**, **Reservas**, **Perfil** are gated via `useRequireAuth(returnTo)`: if `session === null`, the screen renders the contextual `<EmptyState />` with an "Iniciá sesión" button that navigates to `/login?returnTo=<current-route>`. The full-screen flows (`/charger/[id]`, `/reservation/[id]`, `/messages/[id]`, `/publish/*`) are NOT in the `(tabs)` group, so the tab bar is hidden on them per the spec.

### 6.3 `returnTo` pattern

Login screen reads `useLocalSearchParams<{ returnTo?: string }>()`. After a successful sign-in (or sign-up), it validates `returnTo` against an allow-list (`['/profile', '/reservations', '/messages', '/publish/1-name', '/charger/*']`) and calls `router.replace(returnTo)`. If `returnTo` is missing or invalid, it lands on `/(tabs)`.

The same hook is used by Inicio's "Publicar mi cargador" CTA when the user is logged out: `router.push('/login?returnTo=/publish/1-name')`.

### 6.4 Route guard

The root `app/_layout.tsx` listens to `supabase.auth.onAuthStateChange` and seeds `useAuthStore`. It does NOT redirect — per-tab gates are owned by the tab screen via `useRequireAuth`. This avoids hard redirects that interrupt the user mid-flow.

---

## 7. Auth flow

### 7.1 Supabase Auth config

**Required environment.** `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env` (gitignored; `.env.example` committed). User must provide a fresh anon key (V1 key was revoked) — first task before any auth code can run.

**Providers enabled in Supabase dashboard.**

| Provider | Method | Setup |
|----------|--------|-------|
| Email | `supabase.auth.signInWithPassword` + `signUp` | Default; email verification ON |
| Google (web flow) | `supabase.auth.signInWithOAuth({ provider: 'google' })` via `expo-auth-session` in a WebBrowser | Google Cloud project → OAuth client (Web) → paste client ID + secret in Supabase Auth → Providers → Google |

**Manual setup checklist (Day 0 task):**
1. User creates Google Cloud project, enables Google+ API.
2. User creates OAuth 2.0 Client (Web application); adds authorized redirect URIs from Supabase (Supabase shows these in dashboard).
3. User pastes Client ID + Secret in Supabase Auth → Providers → Google → Enable.
4. User adds `https://auth.expo.io` to Authorized JavaScript origins (for `expo-auth-session` PKCE flow).

### 7.2 Hooks

```ts
// useSession() — wraps supabase.auth.onAuthStateChange
// useRequireAuth(returnTo) — returns { session } OR triggers router.push(`/login?returnTo=${returnTo}`)
// useSignIn() — useMutation calling signInWithPassword; debounced 800ms submit
// useSignUp() — useMutation calling signUp; on success surfaces "Te enviamos un correo…"
// useGoogleOAuth() — useMutation calling signInWithOAuth; opens expo-auth-session
// useResetPassword() — useMutation calling resetPasswordForEmail
// useSignOut() — useMutation calling signOut + queryClient.clear() + router.replace('/profile')
```

### 7.3 Token storage

`expo-secure-store` (NOT AsyncStorage). The Supabase client is created with a `storage` adapter that proxies to SecureStore (snippet in §4.1). This keeps the refresh token out of plain text and off disk in a recoverable form.

### 7.4 Google OAuth decision

**MVP: web flow via `expo-auth-session`.** Rationale: zero native config (no `GoogleService-Info.plist`, no `google-services.json`, no Firebase project). The cost is a redirect through the system browser, which adds ~1s but is acceptable for a beta. **v2.1** will add `@react-native-google-signin/google-signin` for one-tap sign-in on iOS and Android (requires per-platform Google Cloud client + Firebase config).

### 7.5 Return-to flow

`returnTo` is a route path (not a deep link). The login screen pushes through `router.replace(returnTo)` after `onAuthStateChange` fires `SIGNED_IN`. The home tab is the fallback (`/(tabs)`).

---

## 8. Map implementation

### 8.1 Library choice: `react-native-maps`

| Choice | Why |
|--------|-----|
| `react-native-maps` 1.18+ with `PROVIDER_GOOGLE` | Expo SDK 54 supports it without extra config; required for Android Google tiles and iOS consistency. |
| Rejected: `@rnmapbox/maps` | Requires Mapbox token + commercial terms; overkill for a beta. |
| Rejected: `react-native-mapbox-gl/maps` | Same as above. |

The `cargador.png` asset is passed to `<Marker icon={...} />`; the system handles scaling and z-order. We register the marker image with `markerImage.loadAsync()` once in the map screen's `useEffect` and reuse the reference.

### 8.2 Filtros bottom sheet

`@gorhom/bottom-sheet` (v4+) with the `BottomSheetModal` API. 5 snap points (`['25%', '50%', '90%']`). 5 chip-group sections inside a `ScrollView`. State lives in `useFilterStore` (Zustand) so it persists across map re-renders and tab switches per the spec.

### 8.3 Location flow

`expo-location` is invoked **only on the Mapa screen's `useEffect` mount** (and on Publicar step 2 mount). No app-start prompt. Two paths:

- **Granted** → `Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })`, store last-known coordinates, recenter FAB animates to that point.
- **Denied** → store `null`, FAB recenters to Uruguay fallback, show a one-time toast: "Activá la ubicación para centrar el mapa" (from map spec).

### 8.4 Map style

Light, no traffic, no satellite toggle. Default Google style; no custom JSON. (Custom style JSON can come in v2.1.) The map is wrapped in an `ErrorBoundary` that falls back to a friendly retry card on tile-load failure (per map spec non-functional).

### 8.5 Marker cap

200-pin hard cap (map spec non-functional). Beyond that, the map shows a "zoom in for more chargers" overlay — deferring clustering to v2.1.

---

## 9. Reservation lifecycle state machine

### 9.1 States and transitions

```
            ┌────────────┐
            │ solicitada │◄──────────────┐
            └─────┬──────┘               │ (no path back; new reservation)
                  │                      │
       (host)    │                      │
        ┌─────────▼──────────┐           │
        │    confirmada      │           │
        └────┬──────────┬────┘           │
             │          │                │
   (either)  │          │  (auto)        │
             │          ▼                │
             │   ┌─────────────┐         │
             │   │ completada  │         │
             │   └─────────────┘         │
             ▼                            │
       ┌────────────┐                     │
       │ cancelada  │◄────────────────────┘  (renter cancels pre-confirm)
       └────────────┘
```

| From | To | Trigger | Actor | Side effect |
|------|----|---------|-------|-------------|
| (none) | `solicitada` | renter submits request sheet | renter | trigger: `system_reservation_requested` message |
| `solicitada` | `confirmada` | host taps "Confirmar" | host | Edge Function: system msg + push trigger |
| `solicitada` | `cancelada` | renter taps "Cancelar" | renter | Edge Function: system msg |
| `confirmada` | `cancelada` | either party cancels | renter or host | Edge Function: system msg |
| `confirmada` | `completada` | `end_at < now()` (auto) | DB trigger | none (silent status flip) |

### 9.2 Where the logic lives — decision

| Transition | Location | Rationale |
|------------|----------|-----------|
| `→ solicitada` (insert) | Postgres trigger (`handle_reservation_requested_system_message`) | Pure DB-side: inserts a templated system message; no push, no client work needed. |
| `→ confirmada` | **Supabase Edge Function** `system-message-injector` | Needs to (a) format templated message, (b) insert into `messages`, (c) trigger push. Client calls function with `{ reservation_id, new_status }`; function uses service-role. |
| `→ cancelada` | **Supabase Edge Function** `system-message-injector` | Same as confirmed. |
| `→ completada` | Postgres `before update` trigger (`handle_reservation_completed`) | Time-based, no message, no push. |

**Why an Edge Function for confirm/cancel (not a trigger).**
- Push notifications in v2.1 will use APNs/FCM; that's best handled outside the DB (HTTP call to Expo Push API or FCM).
- Service-role auth: bypasses RLS so we can write to `messages` with `sender_id = null`.
- Easier to test independently of the DB schema.
- The DB still has a `reservations_update_party` RLS policy; the client does `UPDATE reservations SET status = 'confirmada' WHERE id = ...` and the Edge Function is invoked as a side-effect via a separate `supabase.functions.invoke('system-message-injector', ...)` call. (Alternative: a Postgres trigger calls `pg_net.http_post` to invoke the function. We chose the client-side invocation for MVP simplicity — keeps the function testable in isolation.)

### 9.3 State machine in code

`src/features/reservations/state.ts` exports a tiny state machine helper:

```ts
type ReservationState = 'solicitada' | 'confirmada' | 'cancelada' | 'completada';
const transitions: Record<ReservationState, ReservationState[]> = {
  solicitada: ['confirmada', 'cancelada'],
  confirmada: ['cancelada', 'completada'],
  cancelada: [],
  completada: [],
};
```

This is a guard used by `useConfirmReservation` and `useCancelReservation` to early-return invalid transitions before hitting the network.

---

## 10. System message injection

### 10.1 Edge Function: `system-message-injector`

`POST { reservation_id: string, new_status: 'confirmada' | 'cancelada' }`

Flow:
1. Authenticate the caller via Supabase JWT (verify it belongs to a reservation party).
2. Fetch the reservation + charger + conversation.
3. Format the Spanish voseo template (see §10.2).
4. `INSERT` into `messages` with `kind = 'system_reservation_confirmed' | 'system_reservation_cancelled'`, `sender_id = null`.
5. `UPDATE conversations SET last_message_at = now()`.
6. (v2.1) Trigger push to the other party.
7. Return `{ ok: true, message_id }`.

Service-role key is read from the Edge Function environment (`SERVICE_ROLE_KEY`), never from the app.

### 10.2 Templates (Spanish voseo)

| Trigger | `kind` | Template (Rioplatense voseo) |
|---------|--------|------------------------------|
| Reservation created | `system_reservation_requested` | `¡Hola! Quiero reservar {charger_title}.` (inserted by DB trigger) |
| `solicitada` → `confirmada` | `system_reservation_confirmed` | `¡Listo! Tu reserva de {charger_title} fue confirmada. Chateamos para coordinar. Dirección: {address}.` |
| any → `cancelada` | `system_reservation_cancelled` | `La reserva de {charger_title} {time_desc} fue cancelada.` |

`time_desc` is built from `start_at` / `end_at` (e.g. `del 17/7 15:30 a 17:00`) or `horario_a_coordinar` (e.g. `«horario a coordinar»`).

> These voseo strings are the only Spanish copy in the system. Code, schema names, identifiers, and English-only comments remain in English.

---

## 11. Performance & resilience

### 11.1 TanStack Query stale times

| Query | Stale time | Reasoning |
|-------|------------|-----------|
| `chargers` (list) | 30s | Map needs freshness; list view can show stale 30s |
| `charger:${id}` (detail) | 5 min | Detail rarely changes within a session |
| `reservations` (list) | 15s | User expects new requests to show up fast |
| `reservation:${id}` | 15s | Same |
| `conversations` | 15s | List update on new message |
| `messages:${convId}` | 0 | Real-time via Supabase channel; cache is invalidated on each event |
| `profile:${id}` | 60s | Rarely changes; pulled on demand |
| `my-chargers` | 30s | Re-fetched on Profile focus |

### 11.2 Optimistic mutations

`useSendMessage`, `useCancelReservation`, `useConfirmReservation`, `useCreateReservation`, `usePublishCharger` (per wizard step). All rollback in `onError` via the pattern in §4.4. UI shows a subtle pending indicator on optimistically-inserted rows.

### 11.3 Offline behavior

- **Chat reads**: TanStack Query persists the last page of `messages:${convId}` to disk (via `@tanstack/query-async-storage-persister`). On offline launch, the user can scroll old messages.
- **Chat writes**: queued by TanStack Query (default behavior with no network). The mutation is retried automatically on reconnect. UI shows a `pending` icon (cloud-arrow-up) on queued messages.
- **Map reads**: needs network; offline shows an `<ErrorState />` with retry.
- **Wizard**: Zustand draft survives offline; publish step needs network at submit time.

### 11.4 Image upload

`expo-image-manipulator` resizes and compresses before upload:

```ts
// src/lib/imageUpload.ts (sketch)
async function compress(uri: string): Promise<Blob> {
  const resized = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1600 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
  );
  return fetch(resized.uri).then(r => r.blob());
}
```

- Max 1600px on long edge
- JPEG 80% quality
- Reject if > 8 MB after compression (Zod schema in `usePublishCharger`)
- Mime check: must be `image/jpeg` or `image/png`

Upload path: `{owner_id}/{charger_id}/{index}.jpg` in the `charger-photos` bucket.

### 11.5 Push notifications

**MVP: deferred.** A `notifications` table is added later if needed; for now, the reservation lifecycle and system message injection work without push. The notifications spec calls for APNs/FCM provisioning during the polish phase. v2.1 adds a real push provider.

The Edge Function `notify-reservation-confirmed` exists as a stub that just logs (so the architecture is in place when credentials land).

---

## 12. Testing strategy

### 12.1 Test runner

`jest-expo` preset + `@testing-library/react-native` for component tests. `jest.setup.js` registers `@testing-library/jest-native` matchers and mocks `expo-secure-store`, `expo-location`, `expo-image-picker`, and `expo-image`.

### 12.2 What we test in MVP

| Layer | What | Approach |
|-------|------|----------|
| Pure utilities | `format.test.ts` ("hace 22 min", currency) | Unit; no mocks |
| Pure utilities | `error.test.ts` (`normalizeSupabaseError`) | Unit; pure |
| Design tokens | `colors.test.ts`, `spacing.test.ts`, `radius.test.ts` | Snapshot the export shape |
| Design atoms | `Button.test.tsx`, `StatusPill.test.tsx`, `EmptyState.test.tsx` | Snapshot + render variants |
| Hooks | `useChargers.test.ts`, `useMessages.test.ts` | Mock `@/lib/supabase`; assert query key, return shape |
| State machine | `reservations/state.test.ts` | Pure; assert valid/invalid transitions |

### 12.3 What we defer

- **E2E** (Detox / Maestro): not set up in MVP. Add after the bootstrap PR lands.
- **Visual regression** (e.g. Loki / Chromatic): not in MVP.
- **Integration tests against a real Supabase**: deferred. RLS verification is a manual smoke test using the anon key vs. service-role key.

### 12.4 Recommendation for next change

After bootstrap lands and the test runner is wired, set `strict_tdd: true` for the next change (`mvp-reservation-lifecycle` or `mvp-map-filters`). The bootstrap change itself ships with the harness but doesn't gate every line on tests.

---

## 13. Security

| Layer | Control | Where |
|-------|---------|-------|
| Network identity | Anon key in `.env` (gitignored); no service-role key in the app | `src/lib/supabase.ts` |
| Per-row access | RLS on every table; explicit SELECT/INSERT/UPDATE/DELETE policies | `20260718000005_rls_policies.sql` |
| System writes | Only Edge Functions (service-role) can insert `system_*` messages | RLS policy omitted for non-service role |
| Token storage | `expo-secure-store` (Keychain on iOS, EncryptedSharedPreferences on Android) | `src/lib/supabase.ts` |
| Input validation | Zod at the data layer boundary (every `useXxx` mutation runs `.parse()` first) | `src/lib/schemas/*` |
| Image upload validation | File size cap (8 MB), mime type check, max 5 photos | `src/lib/imageUpload.ts` + Zod |
| Deep link payloads | `returnTo` validated against an allow-list before `router.replace` | `app/(auth)/login.tsx` |
| Secrets in code | `.env*` in `.gitignore`; no inline secrets; EAS secrets post-MVP | `.gitignore` |

**What is NOT in MVP scope.** No code obfuscation beyond default RN minification, no certificate pinning (default TLS), no jailbreak detection, no anti-screenshot on auth screens. These are post-MVP hardening.

---

## 14. Open risks for the design phase

| # | Risk | Decision in this design |
|---|------|-------------------------|
| R1 | Wizard step 6 ambiguity | Default: per-day windows with `00:00–23:59` always-available default; `jsonb` column with shape `{ mon: [{from, to}], tue: [...], ... }`. Empty array for a day = not available. |
| R2 | RLS for system messages | `sender_id` is NULLABLE; authenticated users cannot insert `kind != 'user'` (policy omits the operation for `authenticated`). Only service-role (Edge Function) inserts system messages. |
| R3 | Google OAuth setup is external | First implementation task: user creates Google Cloud project + OAuth client + pastes into Supabase dashboard. Documented in `auth-foundation` task; checklist in `openspec/changes/2026-07-18-mvp-bootstrap/design.md` §7.1. |
| R4 | State machine consistency | Edge Function is the single source of truth for `confirmed` and `cancelled`; client mutation fires after the DB UPDATE succeeds, so the system message is the last write. RLS prevents the renter from setting `cancelled_by` to anything but their own user. |
| R5 | Push notification trigger | Deferred to v2.1; reservation lifecycle works without push. Edge Function stub logs only. |
| R6 | Wizard draft loss on app kill | Zustand store with `persist` middleware (AsyncStorage) for `usePublishStore`. Survives app restart within the same session. Cross-session resume is out of scope. |
| R7 | Photo upload size and bandwidth | 1600px JPEG 80% target = ~250 KB per photo. 5 photos = ~1.25 MB. Acceptable on Wi-Fi and most 4G. We do NOT upload thumbnails separately in MVP. |
| R8 | Map performance with 200 pins | React Native Maps handles 200 markers smoothly on mid-range devices; we measure on a physical iPhone SE during apply. If perf is bad, we cap at 100 and add a "Zoom in" overlay. |
| R9 | Cross-platform styling drift | All colors, spacing, radius, typography are tokens; no inline literals. ESLint rule (`no-restricted-syntax`) added in apply to ban hex strings outside `src/theme/`. |
| R10 | Tab bar visible on full-screen flows | The `(tabs)` group is the only place `_layout.tsx` renders `<Tabs>`. `/charger/[id]`, `/reservation/[id]`, `/messages/[id]`, `/publish/*` are outside that group, so the tab bar is naturally absent. |

---

## Next phase

`openspec/changes/2026-07-18-mvp-bootstrap/design.md` is complete. Ready for `sdd-tasks` to break the 8-step phasing into atomic, single-session tasks grouped by capability.

| Phase (from proposal) | Capability | Approx. PR size |
|-----------------------|------------|----------------|
| 1. Foundation | bootstrap (Expo init, TS, Router, Supabase client, .gitignore, asset moves) | small |
| 2. Design system | design-system | medium |
| 3. Auth | auth | medium |
| 4. Public tabs | home, map (incl. filters) | medium |
| 5. Auth-gated tabs | messaging, reservations (list only), profile | medium |
| 6. Charger detail + wizard | charger-detail, charger-publish | large → chained |
| 7. Reservation lifecycle | reservations (state machine, system messages), notifications stub | medium |
| 8. Polish | map filters wire-up, error boundaries, success state, push stub | small |
