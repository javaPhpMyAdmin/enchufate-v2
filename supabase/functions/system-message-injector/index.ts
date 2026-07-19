// =========================================================================
// Edge Function: system-message-injector
// =========================================================================
// Phase 7 task 7.4. Deno Deploy runtime (Deno.serve). Runs as
// service_role so it can INSERT into `public.messages` with
// `sender_id = NULL` and `kind = 'system_*'` (the RLS policy
// `messages_insert_user` blocks non-user kinds for the
// authenticated role).
//
// **NOT DEPLOYED IN THIS PR.** This file is dormant code. The user
// runs `supabase functions deploy system-message-injector` after
// applying the migrations. The reservation lifecycle currently
// injects system messages via the
// `handle_reservation_*_system_message` triggers (which also run
// as SECURITY DEFINER); this function is kept for the v2.1
// retroactive-message + admin-action use cases per the design.
//
// **Endpoint**:
//   POST { conversationId, body, kind }
//   - conversationId: uuid (required)
//   - body: string (required, 1-4000 chars)
//   - kind: 'system_reservation_requested'
//        | 'system_reservation_confirmed'
//        | 'system_reservation_cancelled'
//        (required; user messages are inserted by the client via
//         RLS, not by this function)
//
// **Auth**: the function is intended to be called from
// service-role context (admin tools, retroactive messages). It
// does NOT verify the caller's JWT because service_role bypasses
// RLS by design. Production deployments should add an
// `Authorization: Bearer <service_role_key>` check OR restrict
// deployment to admin-only invocations.
//
// **Response**:
//   - 200 { ok: true, messageId: uuid }
//   - 400 { ok: false, error: '...' } on validation failure
//   - 500 { ok: false, error: '...' } on DB failure
// =========================================================================

// `Deno` types are provided by the Supabase Edge Functions runtime.
// deno-lint-ignore-file no-explicit-any
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

// Supabase JS client for Deno (loaded via the ESM CDN URL the
// Supabase CLI bundles). The actual import URL is rewritten by
// `supabase functions serve` / `deploy` from the local
// `node_modules` mirror; for now we use the standard ESM URL.
// The URL is resolved at Deno runtime, not by the React Native /
// Expo TypeScript checker. The bundled Edge Function runtime has
// its own type provider.
// @ts-expect-error -- Deno ESM URL
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'system-message-injector: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
      'Set both in supabase/functions/.env (gitignored).',
  );
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SYSTEM_KINDS = [
  'system_reservation_requested',
  'system_reservation_confirmed',
  'system_reservation_cancelled',
] as const;
type SystemKind = (typeof SYSTEM_KINDS)[number];

interface InjectRequest {
  conversationId: string;
  body: string;
  kind: SystemKind;
}

function isSystemKind(v: unknown): v is SystemKind {
  return typeof v === 'string' && (SYSTEM_KINDS as readonly string[]).includes(v);
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  // Only POST is allowed. OPTIONS handled for CORS preflight so the
  // function is callable from a browser if needed.
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
    return jsonResponse(405, { ok: false, error: 'method_not_allowed' });
  }

  // Parse + validate the payload.
  let payload: InjectRequest;
  try {
    const raw = await req.json();
    if (
      typeof raw?.conversationId !== 'string' ||
      typeof raw?.body !== 'string' ||
      !isSystemKind(raw?.kind)
    ) {
      return jsonResponse(400, {
        ok: false,
        error: 'invalid_payload',
        hint: 'Expected { conversationId: string, body: string (1-4000 chars), kind: SystemKind }',
      });
    }
    const trimmed = raw.body.trim();
    if (trimmed.length === 0 || trimmed.length > 4000) {
      return jsonResponse(400, {
        ok: false,
        error: 'invalid_body',
        hint: 'body must be 1-4000 chars after trim',
      });
    }
    payload = {
      conversationId: raw.conversationId,
      body: trimmed,
      kind: raw.kind,
    };
  } catch {
    return jsonResponse(400, { ok: false, error: 'malformed_json' });
  }

  // Insert the system message. sender_id is NULL by design
  // (system messages have no human sender). The
  // `update_conversation_last_message` trigger updates
  // conversations.last_message_at to the new created_at.
  const { data, error } = await supabaseAdmin
    .from('messages')
    .insert({
      conversation_id: payload.conversationId,
      sender_id: null,
      body: payload.body,
      kind: payload.kind,
    })
    .select('id')
    .single();

  if (error) {
    console.error('system-message-injector insert failed', error);
    return jsonResponse(500, { ok: false, error: 'insert_failed' });
  }
  return jsonResponse(200, { ok: true, messageId: data?.id });
});
