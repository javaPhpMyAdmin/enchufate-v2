/**
 * Publish store — Zustand-backed wizard draft with AsyncStorage persist.
 *
 * Hosts move through a 7-step wizard to publish a charger (see
 * `openspec/specs/charger-publish/spec.md`). Each step has its own
 * data; this store keeps the whole draft in one place so the user
 * can swipe-back, kill the app, and resume from the same step
 * (Phase 8 will add the cross-session resume edge case via the
 * query persister; for now the persist is in-session only).
 *
 * **Scope**: every step's data is persisted. PR-B shipped 1–2,
 * PR-C shipped 3–4, PR-D ships 5–7. Each step's `validateStepN`
 * is a pure function consumed by `<PublishWizardNav />` to gate
 * the "Siguiente" CTA.
 *
 * **Why AsyncStorage, not SecureStore**: the wizard draft is NOT
 * sensitive data — it's title text and a lat/lng. SecureStore is
 * reserved for the Supabase auth token (`src/lib/secureStorage.ts`).
 * AsyncStorage is the right tool for "drafts that should survive
 * an app kill but aren't secrets".
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create, type StateCreator } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { chargerSchema } from '@/lib/schemas/charger';
import type { ChargerSchedule, DayKey, DayWindow, MinReservationMinutes } from '@/features/chargers/types';

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type PublishStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Connector kinds — mirrors `chargerSchema.shape.connector_type`. */
export type PublishConnectorType = 'tipo_1' | 'tipo_2' | 'ccs' | 'chademo' | 'tesla';

export interface PublishLocation {
  lat: number | null;
  lng: number | null;
  address: string;
}

/** Step 5 — pricing data. */
export interface PublishPricing {
  /** Price in USD per hour. `null` until the user types something. */
  price_per_hour_usd: number | null;
  /** Minimum reservation duration in minutes. Defaults to 30. */
  min_reservation_minutes: MinReservationMinutes;
}

/**
 * The 7 day-keys. Centralized here so the wizard's UI loop and the
 * `chargerSchema.schedule` shape stay in lockstep.
 */
export const PUBLISH_DAY_KEYS: readonly DayKey[] = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
] as const;

/** Day-key → display name (Rioplatense). */
export const PUBLISH_DAY_LABELS: Record<DayKey, string> = {
  mon: 'Lunes',
  tue: 'Martes',
  wed: 'Miércoles',
  thu: 'Jueves',
  fri: 'Viernes',
  sat: 'Sábado',
  sun: 'Domingo',
};

/** Day-key → short display name (for tight rows). */
export const PUBLISH_DAY_LABELS_SHORT: Record<DayKey, string> = {
  mon: 'Lun',
  tue: 'Mar',
  wed: 'Mié',
  thu: 'Jue',
  fri: 'Vie',
  sat: 'Sáb',
  sun: 'Dom',
};

/** 24/7 window — used as the default for every day in step 6. */
export const ALWAYS_AVAILABLE_WINDOW: DayWindow = { from: '00:00', to: '23:59' };

/** Default schedule — every day open 24/7. Matches `chargers.schedule` jsonb default. */
export const DEFAULT_SCHEDULE: ChargerSchedule = PUBLISH_DAY_KEYS.reduce(
  (acc, k) => ({ ...acc, [k]: [ALWAYS_AVAILABLE_WINDOW] }),
  {} as ChargerSchedule,
);

export interface PublishStoreState {
  /** Current step (1–7). Drives the progress bar and Siguiente label. */
  step: PublishStep;
  /** Step 1 — charger title (1–80 chars per `chargerSchema.title`). */
  name: string;
  /** Step 1 — charger description (≤500 chars per `chargerSchema.description`). */
  description: string;
  /** Step 2 — location + editable address. `null` until step 2 starts. */
  location: PublishLocation | null;
  /** Step 3 — connector kind. `null` until the user picks one. */
  connector_type: PublishConnectorType | null;
  /** Step 3 — power in kW (3.7–350). `null` until the user types. */
  power_kw: number | null;
  /** Step 4 — local file URIs of the photos (1–5 entries). Compressed by `imageUpload.ts` before storing. */
  photos: string[];
  /** Step 5 — pricing. `price_per_hour_usd` is `null` until the user types. */
  pricing: PublishPricing;
  /**
   * Step 6 — per-day availability windows. Shape mirrors the
   * `chargers.schedule` jsonb column exactly: 7 day keys, each value
   * is an array of `{ from: 'HH:MM', to: 'HH:MM' }` windows. Empty
   * array = day closed. Single `[{00:00, 23:59}]` window = 24/7.
   */
  schedule: ChargerSchedule;
  /** Step 7 — optional house rules (≤300 chars per `chargerSchema.rules`). */
  rules: string;

  // ----- Actions -----
  /** Hard-set the wizard step (used by each screen's mount effect). */
  setStep: (n: PublishStep) => void;
  setName: (s: string) => void;
  setDescription: (s: string) => void;
  setLocation: (loc: PublishLocation | null) => void;
  setConnectorType: (t: PublishConnectorType) => void;
  setPowerKw: (n: number | null) => void;
  /** Replace the photos array wholesale (the screen owns the array). */
  setPhotos: (uris: string[]) => void;
  /** Replace `price_per_hour_usd` (used by the numeric input). */
  setPricePerHour: (n: number | null) => void;
  /** Replace `min_reservation_minutes` (used by the chip group). */
  setMinReservation: (m: MinReservationMinutes) => void;
  /** Patch a single day's window array. */
  setDaySchedule: (k: DayKey, windows: DayWindow[]) => void;
  /** Replace the rules text. */
  setRules: (s: string) => void;
  /** Advance the step counter (clamped to 1–7). */
  nextStep: () => void;
  /** Regress the step counter (clamped to 1–7). */
  prevStep: () => void;
  /** Wipe the draft (called by usePublishCharger on success). */
  resetWizard: () => void;
}

/* ------------------------------------------------------------------ */
/* Initial state                                                        */
/* ------------------------------------------------------------------ */

const INITIAL: Pick<
  PublishStoreState,
  'step' | 'name' | 'description' | 'location' | 'connector_type' | 'power_kw' | 'photos' | 'pricing' | 'schedule' | 'rules'
> = {
  step: 1,
  name: '',
  description: '',
  location: null,
  connector_type: null,
  power_kw: null,
  photos: [],
  pricing: { price_per_hour_usd: null, min_reservation_minutes: 30 },
  schedule: DEFAULT_SCHEDULE,
  rules: '',
};

/* ------------------------------------------------------------------ */
/* Validation                                                           */
/* ------------------------------------------------------------------ */

export interface StepValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Pure validation for step 1. Drives the Siguiente CTA. The source
 * of truth is `chargerSchema.title` / `.description` so the limits
 * stay in one place (no risk of drift between the form and the
 * Zod schema).
 */
export function validateStep1(state: Pick<PublishStoreState, 'name' | 'description'>): StepValidation {
  const errors: string[] = [];
  // chargerSchema uses `.min(1, 'El título es obligatorio')` — we mirror
  // the same error message so the user sees the exact copy the form
  // will surface server-side.
  const title = chargerSchema.shape.title.safeParse(state.name);
  if (!title.success) {
    for (const issue of title.error.issues) {
      errors.push(issue.message);
    }
  }
  const description = chargerSchema.shape.description.safeParse(state.description);
  if (!description.success) {
    for (const issue of description.error.issues) {
      errors.push(issue.message);
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Pure validation for step 2. The location is optional on Supabase
 * (a host can publish without GPS coords) but if any GPS field is
 * set, both must be set.
 */
export function validateStep2(state: Pick<PublishStoreState, 'location'>): StepValidation {
  const errors: string[] = [];
  const loc = state.location;
  if (!loc) {
    errors.push('Definí la ubicación del cargador');
  } else {
    if (loc.address.trim().length === 0) {
      errors.push('La dirección es obligatoria');
    }
    const hasLat = loc.lat !== null;
    const hasLng = loc.lng !== null;
    if (hasLat !== hasLng) {
      errors.push('Faltan las coordenadas del cargador');
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Pure validation for step 3 (connector + power). Mirrors
 * `chargerSchema.shape.connector_type` (5 enum values) and
 * `chargerSchema.shape.power_kw` (3.7–350) so the form limits
 * stay in lockstep with the server-side CHECK constraints.
 */
export function validateStep3(
  state: Pick<PublishStoreState, 'connector_type' | 'power_kw'>,
): StepValidation {
  const errors: string[] = [];
  if (state.connector_type === null) {
    errors.push('Elegí un tipo de conector');
  }
  if (state.power_kw === null || Number.isNaN(state.power_kw)) {
    errors.push('Ingresá la potencia del cargador');
  } else if (state.power_kw < 3.7) {
    errors.push('La potencia mínima es 3.7 kW');
  } else if (state.power_kw > 350) {
    errors.push('La potencia máxima es 350 kW');
  }
  return { valid: errors.length === 0, errors };
}

/** Max photos per charger (mirrors `chargerSchema.shape.photos` max). */
export const PUBLISH_PHOTOS_MAX = 5;
/** Min photos per charger (1, per the spec — at least one preview required). */
export const PUBLISH_PHOTOS_MIN = 1;

/**
 * Pure validation for step 4 (photos). The spec requires at least
 * one photo and at most `PUBLISH_PHOTOS_MAX`. The screen enforces
 * the cap at the picker level (`selectionLimit: 5 - currentCount`)
 * so the validator only needs to check the lower bound.
 */
export function validateStep4(
  state: Pick<PublishStoreState, 'photos'>,
): StepValidation {
  const errors: string[] = [];
  if (state.photos.length < PUBLISH_PHOTOS_MIN) {
    errors.push('Subí al menos una foto del cargador');
  } else if (state.photos.length > PUBLISH_PHOTOS_MAX) {
    errors.push(`Máximo ${PUBLISH_PHOTOS_MAX} fotos`);
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Pure validation for step 5 (pricing). Mirrors
 * `chargerSchema.shape.price_per_hour_usd` (>0) and the min
 * reservation enum (one of 30/60/120/240/480 per
 * `chargerSchema.shape.min_reservation_minutes`).
 */
export function validateStep5(state: Pick<PublishStoreState, 'pricing'>): StepValidation {
  const errors: string[] = [];
  const { price_per_hour_usd } = state.pricing;
  if (price_per_hour_usd === null || Number.isNaN(price_per_hour_usd)) {
    errors.push('Ingresá el precio por hora');
  } else if (price_per_hour_usd <= 0) {
    errors.push('El precio tiene que ser mayor a 0');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Pure validation for step 6 (schedule). The 7 day-keys must all
 * be present (a missing key would fail the jsonb `CHECK`); each
 * day must have at least one window unless the user explicitly
 * closed it (empty array = closed, which is a valid state). The
 * `chargerSchema` validates the same shape on the mutation side.
 *
 * The CTA is enabled as long as at least one day is open (always
 * or custom) — closing all 7 days leaves nothing bookable, which
 * would be confusing UX.
 */
export function validateStep6(state: Pick<PublishStoreState, 'schedule'>): StepValidation {
  const errors: string[] = [];
  // Every day key must be present (the schema rejects missing keys).
  for (const k of PUBLISH_DAY_KEYS) {
    if (!Array.isArray(state.schedule[k])) {
      errors.push(`Falta el horario de ${PUBLISH_DAY_LABELS[k]}`);
    }
  }
  // At least one day must be open (have at least one window).
  const anyOpen = PUBLISH_DAY_KEYS.some((k) => state.schedule[k]?.length > 0);
  if (!anyOpen) {
    errors.push('Al menos un día tiene que estar disponible');
  }
  return { valid: errors.length === 0, errors };
}

/** Max rules length (mirrors `chargerSchema.shape.rules` max). */
export const PUBLISH_RULES_MAX = 300;

/**
 * Pure validation for step 7 (rules). Rules are optional per the
 * spec — an empty string round-trips to `null` server-side. The
 * length cap matches `chargerSchema.shape.rules.max`.
 */
export function validateStep7(state: Pick<PublishStoreState, 'rules'>): StepValidation {
  const errors: string[] = [];
  if (state.rules.length > PUBLISH_RULES_MAX) {
    errors.push(`Máximo ${PUBLISH_RULES_MAX} caracteres`);
  }
  return { valid: errors.length === 0, errors };
}

/* ------------------------------------------------------------------ */
/* Store                                                                */
/* ------------------------------------------------------------------ */

const creator: StateCreator<PublishStoreState> = (set) => ({
  ...INITIAL,
  setStep: (n) => set({ step: n }),
  setName: (s) => set({ name: s }),
  setDescription: (s) => set({ description: s }),
  setLocation: (loc) => set({ location: loc }),
  setConnectorType: (t) => set({ connector_type: t }),
  setPowerKw: (n) => set({ power_kw: n }),
  setPhotos: (uris) => set({ photos: uris }),
  setPricePerHour: (n) =>
    set((s) => ({ pricing: { ...s.pricing, price_per_hour_usd: n } })),
  setMinReservation: (m) =>
    set((s) => ({ pricing: { ...s.pricing, min_reservation_minutes: m } })),
  setDaySchedule: (k, windows) =>
    set((s) => ({ schedule: { ...s.schedule, [k]: windows } })),
  setRules: (s) => set({ rules: s }),
  nextStep: () =>
    set((s) => ({
      step: Math.min(7, s.step + 1) as PublishStep,
    })),
  prevStep: () =>
    set((s) => ({
      step: Math.max(1, s.step - 1) as PublishStep,
    })),
  resetWizard: () => set({ ...INITIAL }),
});

/**
 * Persisted via `zustand/middleware` `persist` against AsyncStorage.
 * The storage key namespaced with the app + change so we can bump
 * the version if the shape ever changes (`version` + `migrate`).
 */
export const usePublishStore = create<PublishStoreState>()(
  persist(creator, {
    name: 'enchufate-publish-draft',
    version: 2,
    storage: createJSONStorage(() => AsyncStorage),
    // Only persist the data fields — the actions are recreated on
    // every cold start. If we ever add a non-serializable field
    // (functions, Dates), whitelist it here.
    partialize: (s) => ({
      step: s.step,
      name: s.name,
      description: s.description,
      location: s.location,
      connector_type: s.connector_type,
      power_kw: s.power_kw,
      photos: s.photos,
      pricing: s.pricing,
      schedule: s.schedule,
      rules: s.rules,
    }),
  }),
);
