/**
 * Filter store — Zustand-backed map filter state.
 *
 * The Mapa screen + FiltersSheet read + write from this store. State
 * lives in Zustand (not TanStack Query) per `design.md §1` so it
 * survives map re-renders and tab switches without an extra network
 * round-trip. Phase 6 will wire the filters into the Supabase query
 * (`useChargers` reads the store and passes the filter object as the
 * query key so cache invalidation works correctly).
 *
 * Each category is a single optional value — the chip groups in the
 * FiltersSheet are mutually exclusive (e.g. one connector type at a
 * time, not a multi-select). When `setFilter` is called with the same
 * value as currently selected, it toggles back to `null` (deselect).
 */
import { create } from 'zustand';

export type EstadoFilter = 'disponible' | 'pausado';
export type ConectorFilter = 'tipo_1' | 'tipo_2' | 'ccs' | 'chademo' | 'tesla';
export type PotenciaFilter = 'lenta' | 'semi_rapida' | 'rapida' | 'ultra';
export type PrecioFilter = 'economico' | 'estandar' | 'premium';
export type DistanciaFilter = 'cerca' | 'medio' | 'lejos';

export type FilterCategory =
  | 'estado'
  | 'conector'
  | 'potencia'
  | 'precio'
  | 'distancia';

export type FilterValue =
  | EstadoFilter
  | ConectorFilter
  | PotenciaFilter
  | PrecioFilter
  | DistanciaFilter;

export interface MapFilters {
  estado: EstadoFilter | null;
  conector: ConectorFilter | null;
  potencia: PotenciaFilter | null;
  precio: PrecioFilter | null;
  distancia: DistanciaFilter | null;
}

const EMPTY: MapFilters = {
  estado: null,
  conector: null,
  potencia: null,
  precio: null,
  distancia: null,
};

export interface FilterStore {
  /** Currently-applied filters (what the map query is using). */
  filters: MapFilters;
  /**
   * In-flight filter selections (what the user is editing inside
   * the FiltersSheet before tapping "Aplicar"). Same shape as
   * `filters` but only committed on Aplicar.
   */
  draft: MapFilters;
  /**
   * Set a single filter value on the DRAFT. Pass `null` (or the
   * current value) to clear. Resets + Aplicar flow uses this on
   * the sheet; the map query reads `filters` (not `draft`).
   */
  setDraft: (category: FilterCategory, value: FilterValue | null) => void;
  /** Commit the draft into `filters` (called by the Aplicar CTA). */
  applyDraft: () => void;
  /** Clear both draft and applied filters (called by Reset). */
  resetFilters: () => void;
}

export const useFilterStore = create<FilterStore>((set) => ({
  filters: EMPTY,
  draft: EMPTY,
  setDraft: (category, value) =>
    set((s) => {
      // Toggle off when the same value is selected.
      const next = s.draft[category] === value ? null : value;
      return { draft: { ...s.draft, [category]: next } };
    }),
  applyDraft: () => set((s) => ({ filters: { ...s.draft } })),
  resetFilters: () => set({ filters: EMPTY, draft: EMPTY }),
}));

/** True when at least one applied filter is non-null. */
export function hasActiveFilters(filters: MapFilters): boolean {
  return (
    filters.estado !== null ||
    filters.conector !== null ||
    filters.potencia !== null ||
    filters.precio !== null ||
    filters.distancia !== null
  );
}
