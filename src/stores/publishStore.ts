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
 * **Scope in PR-B**: only step 1 (name + description) and step 2
 * (location) fields are persisted. The store shape is extensible —
 * PR-C adds connector + photos, PR-D adds pricing + schedule + rules.
 * Each step's `validateStepN(state)` is a pure function consumed by
 * the `<PublishWizardNav />` organism to gate the "Siguiente" CTA.
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

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type PublishStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface PublishLocation {
  lat: number | null;
  lng: number | null;
  address: string;
}

export interface PublishStoreState {
  /** Current step (1–7). Drives the progress bar and Siguiente label. */
  step: PublishStep;
  /** Step 1 — charger title (1–80 chars per `chargerSchema.title`). */
  name: string;
  /** Step 1 — charger description (≤500 chars per `chargerSchema.description`). */
  description: string;
  /** Step 2 — location + editable address. `null` until step 2 starts. */
  location: PublishLocation | null;

  // ----- Actions -----
  /** Hard-set the wizard step (used by each screen's mount effect). */
  setStep: (n: PublishStep) => void;
  setName: (s: string) => void;
  setDescription: (s: string) => void;
  setLocation: (loc: PublishLocation | null) => void;
  /** Advance the step counter (clamped to 1–7). */
  nextStep: () => void;
  /** Regress the step counter (clamped to 1–7). */
  prevStep: () => void;
  /** Wipe the draft (called by usePublishCharger on success in PR-D). */
  resetWizard: () => void;
}

/* ------------------------------------------------------------------ */
/* Initial state                                                        */
/* ------------------------------------------------------------------ */

const INITIAL: Pick<
  PublishStoreState,
  'step' | 'name' | 'description' | 'location'
> = {
  step: 1,
  name: '',
  description: '',
  location: null,
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

/* ------------------------------------------------------------------ */
/* Store                                                                */
/* ------------------------------------------------------------------ */

const creator: StateCreator<PublishStoreState> = (set) => ({
  ...INITIAL,
  setStep: (n) => set({ step: n }),
  setName: (s) => set({ name: s }),
  setDescription: (s) => set({ description: s }),
  setLocation: (loc) => set({ location: loc }),
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
    version: 1,
    storage: createJSONStorage(() => AsyncStorage),
    // Only persist the data fields — the actions are recreated on
    // every cold start. If we ever add a non-serializable field
    // (functions, Dates), whitelist it here.
    partialize: (s) => ({
      step: s.step,
      name: s.name,
      description: s.description,
      location: s.location,
    }),
  }),
);
