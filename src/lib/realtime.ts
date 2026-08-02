/**
 * Realtime helpers.
 *
 * Pure module — no React, no Supabase queries, no `process.env`.
 */

let channelSeq = 0;

/**
 * Unique channel id per call.
 *
 * `supabase.channel(name)` returns the EXISTING channel object when
 * `name` is already registered. If a hook's effect re-runs (React
 * StrictMode double-invoke in dev, or the effect key changes — e.g.
 * `userId` going from a mock value to the real UUID after login, or
 * navigating between conversations), the new run could find the old
 * already-subscribed channel in the registry and call `.on(...)` on
 * it, which throws:
 *
 *   cannot add `postgres_changes` callbacks ... after `subscribe()`.
 *
 * Embedding a unique id in the channel name makes every effect run
 * register a brand-new channel, so a re-run can never collide with a
 * subscribed one. Cleanup still calls `supabase.removeChannel(channel)`,
 * which removes the channel from the registry when the effect tears down.
 */
export function uniqueChannelId(): string {
  channelSeq += 1;
  return `${Date.now().toString(36)}-${channelSeq}`;
}
