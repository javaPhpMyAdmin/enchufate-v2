/**
 * useChargingTimer — reactive elapsed-time display for active
 * charging sessions.
 *
 * Takes an ISO 8601 timestamp and returns a human-readable
 * "X min" or "X h Y min" string, updated every 30 seconds via
 * a local `setInterval`. Pure JS — no Realtime, no state
 * library, no server dependency.
 *
 * The elapsed time is purely cosmetic. The source of truth is
 * the DB column `charging_started_at` on `public.reservations`.
 *
 * Returns `{ elapsed: null }` when `chargingStartedAt` is
 * null / undefined to let the caller distinguish "not charging"
 * from "just started" (the latter returns "0 min").
 */
import { useEffect, useState } from 'react';

const TICK_MS = 30_000; // 30 seconds

/**
 * Compute the elapsed time string from a start timestamp.
 * Pure function — no side effects, testable directly.
 */
function formatElapsed(startedAt: string): string {
  const now = Date.now();
  const start = new Date(startedAt).getTime();
  const diffMs = now - start;

  if (diffMs < 0) return '0 min';

  const totalMinutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours} h ${minutes} min`;
  }
  return `${minutes} min`;
}

export interface ChargingTimerResult {
  /** Human-readable elapsed string (e.g. "5 min", "1 h 23 min"),
   *  or `null` when the charger is not in an active session. */
  elapsed: string | null;
}

export function useChargingTimer(
  chargingStartedAt: string | null | undefined,
): ChargingTimerResult {
  const [elapsed, setElapsed] = useState<string | null>(() => {
    if (!chargingStartedAt) return null;
    return formatElapsed(chargingStartedAt);
  });

  useEffect(() => {
    // No active charging session — return null immediately and
    // don't set up the interval.
    if (!chargingStartedAt) {
      setElapsed(null);
      return;
    }

    // Hydrate immediately on mount or when the timestamp changes.
    setElapsed(formatElapsed(chargingStartedAt));

    const id = setInterval(() => {
      setElapsed(formatElapsed(chargingStartedAt));
    }, TICK_MS);

    return () => clearInterval(id);
  }, [chargingStartedAt]);

  return { elapsed };
}
