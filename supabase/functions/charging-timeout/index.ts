// =========================================================================
// Edge Function: charging-timeout
// =========================================================================
// Scheduled (cron) function that runs every 5 minutes and performs two
// auto-completion sweeps over `reservations`:
//
// 1. **en_curso sweep**: auto-completes charging sessions that have been
//    running for 12+ hours. This prevents "orphaned" en_curso reservations
//    where the host or guest forgot to tap "Finalizar carga". The DB trigger
//    `handle_charging_status_change` atomically clears
//    `chargers.current_charging_since` when the reservation row is updated.
//
// 2. **expired-confirmada sweep**: auto-completes `confirmada` reservations
//    whose scheduled slot `end_at` has already passed. Per the hybrid
//    safety-net decision (2026-07-30), the cron auto-completes expired
//    confirmada reservations while the host can still cancel until `end_at`.
//    The DB trigger `handle_reservation_completed` applies the same
//    transition on any reservation UPDATE, and since charging never started
//    there is nothing else to clean up — this function only performs the
//    reservations UPDATE.
//
// **Schedule**: every 5 minutes via cron expression in
// `supabase/functions/charging-timeout/cron.json`:
//   `every 5 minutes`
//
// **Auth**: uses the service_role key (via Supabase internal URL) so it can
// bypass RLS. The function is invoked by Supabase's cron scheduler, not by
// end users.
//
// **Response**:
//   - 200 { ok: true, completed: number }  // total across both sweeps
//   - 500 { ok: false, error: string }
// =========================================================================

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

Deno.serve(async (_req: Request) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ ok: false, error: 'missing_supabase_credentials' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Single "now" instant shared by both sweeps so the 12h threshold and
    // the end_at comparison are consistent within this run.
    const now = new Date();
    const nowIso = now.toISOString();
    const twelveHoursAgo = new Date(
      now.getTime() - 12 * 60 * 60 * 1000,
    ).toISOString();

    // Sweep 1: find all en_curso reservations that started charging 12+ hours ago.
    const { data: stale, error: selectError } = await supabase
      .from('reservations')
      .select('id')
      .eq('status', 'en_curso')
      .lt('charging_started_at', twelveHoursAgo);

    if (selectError) {
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'charging_timeout_select_failed',
          error: selectError.message,
          timestamp: nowIso,
        }),
      );
      return new Response(
        JSON.stringify({ ok: false, error: 'select_failed' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const ids = (stale ?? []).map((r: { id: string }) => r.id);
    const count = ids.length;

    // Sweep 2: find all confirmada reservations whose scheduled slot end_at
    // has already passed. Hybrid safety net (2026-07-30): the cron
    // auto-completes expired confirmada reservations; the host can still
    // cancel until end_at.
    const { data: expired, error: expiredSelectError } = await supabase
      .from('reservations')
      .select('id')
      .eq('status', 'confirmada')
      .not('end_at', 'is', null)
      .lt('end_at', nowIso);

    if (expiredSelectError) {
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'expired_confirmada_select_failed',
          error: expiredSelectError.message,
          timestamp: nowIso,
        }),
      );
      return new Response(
        JSON.stringify({ ok: false, error: 'select_failed' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const expiredIds = (expired ?? []).map((r: { id: string }) => r.id);
    const expiredCount = expiredIds.length;

    if (count === 0 && expiredCount === 0) {
      // Nothing to do in either sweep — return early with zero.
      console.log(
        JSON.stringify({
          level: 'info',
          event: 'charging_timeout_noop',
          completed: 0,
          timestamp: nowIso,
        }),
      );
      return new Response(JSON.stringify({ ok: true, completed: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Sweep 1 update: set status = 'completada'. The DB trigger
    // handle_charging_status_change atomically nullifies
    // chargers.current_charging_since for each affected charger.
    if (count > 0) {
      const { error: updateError } = await supabase
        .from('reservations')
        .update({ status: 'completada' })
        .in('id', ids)
        .eq('status', 'en_curso'); // safety check — only update if still en_curso

      if (updateError) {
        console.error(
          JSON.stringify({
            level: 'error',
            event: 'charging_timeout_update_failed',
            error: updateError.message,
            ids,
            timestamp: nowIso,
          }),
        );
        return new Response(
          JSON.stringify({ ok: false, error: 'update_failed' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      console.log(
        JSON.stringify({
          level: 'info',
          event: 'charging_timeout_completed',
          completed: count,
          ids,
          timestamp: nowIso,
        }),
      );
    }

    // Sweep 2 update: set status = 'completada'. Nothing else to clean up —
    // charging never started, and `handle_reservation_completed` applies the
    // same transition on any reservation UPDATE.
    if (expiredCount > 0) {
      const { error: expiredUpdateError } = await supabase
        .from('reservations')
        .update({ status: 'completada' })
        .in('id', expiredIds)
        .eq('status', 'confirmada'); // safety check — only update if still confirmada

      if (expiredUpdateError) {
        console.error(
          JSON.stringify({
            level: 'error',
            event: 'expired_confirmada_update_failed',
            error: expiredUpdateError.message,
            ids: expiredIds,
            timestamp: nowIso,
          }),
        );
        return new Response(
          JSON.stringify({ ok: false, error: 'update_failed' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      console.log(
        JSON.stringify({
          level: 'info',
          event: 'expired_confirmada_completed',
          completed: expiredCount,
          ids: expiredIds,
          timestamp: nowIso,
        }),
      );
    }

    // Single response with the total completed across both sweeps.
    const total = count + expiredCount;
    return new Response(JSON.stringify({ ok: true, completed: total }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'charging_timeout_crash',
        error: message,
        timestamp: new Date().toISOString(),
      }),
    );
    return new Response(JSON.stringify({ ok: false, error: 'internal_error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
