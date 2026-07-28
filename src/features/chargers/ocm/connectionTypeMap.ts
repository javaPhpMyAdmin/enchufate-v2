/**
 * OCM ConnectionTypeID → ConnectorType mapping.
 *
 * Maps Open Charge Map numeric connection type IDs to the canonical
 * enchufate-v2 ConnectorType union. Unknown IDs default to 'tipo_2'
 * with a console.warn so the dev knows a new ID appeared.
 *
 * @see https://openchargemap.org/site/develop/api#connections
 */
import type { ConnectorType } from '../types';

/**
 * Static lookup: OCM ConnectionTypeID → enchufate-v2 ConnectorType.
 *
 * | OCM ID | ConnectorType |
 * |--------|---------------|
 * | 33, 32 | ccs           |
 * | 25, 1036 | tipo_2      |
 * | 1      | tipo_1        |
 * | 27, 30 | tesla         |
 * | 2, 1039 | chademo      |
 * | 1040   | gb_t          |
 * | 0      | tipo_2 (silent — Unknown) |
 * | other  | tipo_2 (warn) |
 */
export const OCM_CONNECTOR_MAP: Record<number, ConnectorType> = {
  1: 'tipo_1',
  2: 'chademo',
  25: 'tipo_2',
  27: 'tesla',
  30: 'tesla',
  32: 'ccs',
  33: 'ccs',
  1036: 'tipo_2',
  1039: 'chademo',
  1040: 'gb_t',
};

/**
 * Map an OCM ConnectionTypeID to a ConnectorType.
 * Returns `'tipo_2'` for unknown IDs and emits a warning.
 */
export function mapOCMConnectionType(id: number | undefined): ConnectorType {
  if (id == null) {
    console.warn(`[OCM] ConnectionTypeID is undefined, defaulting to tipo_2`);
    return 'tipo_2';
  }

  // ID 0 is "Unknown" per OCM spec — silent fallback, no warning.
  if (id === 0) return 'tipo_2';

  const mapped = OCM_CONNECTOR_MAP[id];
  if (mapped === undefined) {
    console.warn(
      `[OCM] Unknown ConnectionTypeID ${id}, defaulting to tipo_2`,
    );
    return 'tipo_2';
  }

  return mapped;
}

/**
 * Map an OCM StatusTypeID to a station status.
 *
 * - 100 → `'offline'` (station not available)
 * - 200 → `'offline'` (station under construction/maintenance)
 * - 50, 150, 0, undefined → `'operational'` (safe default)
 */
export function mapOCMStatus(
  id?: number,
): 'operational' | 'offline' {
  if (id === 100 || id === 200) return 'offline';
  return 'operational';
}
