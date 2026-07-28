// =========================================================================
// Edge Function: charging-timeout
// =========================================================================
// Scheduled (cron) function that runs every 5 minutes and auto-completes
// charging sessions that have been running for 12+ hours.
//
// This prevents "orphaned" en_curso reservations where the host or guest
// forgot to tap "Finalizar carga". The DB trigger
// `handle_charging_status_change` atomically clears
// `chargers.current_charging_since` when the reservation row is updated.
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
//   - 200 { ok: true, completed: number }
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

    // Find all en_curso reservations that started charging 12+ hours ago.
    const twelveHoursAgo = new Date(
      Date.now() - 12 * 60 * 60 * 1000,
    ).toISOString();

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
          timestamp: new Date().toISOString(),
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

    if (count === 0) {
      // Nothing to do — return early with zero.
      console.log(
        JSON.stringify({
          level: 'info',
          event: 'charging_timeout_noop',
          completed: 0,
          timestamp: new Date().toISOString(),
        }),
      );
      return new Response(JSON.stringify({ ok: true, completed: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Batch-update: set status = 'completada'. The DB trigger
    // handle_charging_status_change atomically nullifies
    // chargers.current_charging_since for each affected charger.
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
          timestamp: new Date().toISOString(),
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
        timestamp: new Date().toISOString(),
      }),
    );

    return new Response(JSON.stringify({ ok: true, completed: count }), {
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
