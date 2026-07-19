// =========================================================================
// Edge Function: notify-reservation-confirmed (STUB)
// =========================================================================
// Phase 7 task 7.5. Deno Deploy runtime (Deno.serve).
//
// This is a DORMANT stub. The real push notification flow lands
// in v2.1 with the `PUSH_NOTIFICATIONS` feature flag. For MVP we
// log the event as a structured JSON line so the ops team can
// confirm the call path is wired when a host confirms a
// reservation.
//
// **Endpoint**:
//   POST { reservationId: uuid }
//   - reservationId: the reservation that just transitioned to
//     'confirmada'
//
// **Auth**: this function does NOT verify the caller's JWT in
// this stub. The real implementation will use the same pattern
// as `system-message-injector` (service-role context from an
// admin tool or a DB trigger via `pg_net`).
//
// **Response**:
//   - 200 { ok: true }
//   - 400 { ok: false, error: 'invalid_payload' } on bad input
//
// **Deployment**: `supabase functions deploy
// notify-reservation-confirmed` after the migrations land. Until
// then, the function is dormant code — nothing in the app calls
// it yet.
// =========================================================================

// deno-lint-ignore-file no-explicit-any
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let reservationId: string;
  try {
    const raw = await req.json();
    if (typeof raw?.reservationId !== 'string' || raw.reservationId.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, error: 'invalid_payload', hint: 'Expected { reservationId: string }' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }
    reservationId = raw.reservationId;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'malformed_json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Stub: log a structured JSON line. The real implementation
  // (v2.1) will:
  //   1. fetch the reservation + renter + host
  //   2. check each user's `push_token` table row
  //   3. POST to Expo Push API (or FCM) with the voseo body
  //   4. log delivery status to a notifications audit table
  console.log(
    JSON.stringify({
      level: 'info',
      event: 'reservation_confirmed',
      reservationId,
      timestamp: new Date().toISOString(),
      stub: true,
    }),
  );

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
