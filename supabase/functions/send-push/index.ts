// =========================================================================
// Edge Function: send-push
// =========================================================================
// Sends Expo push notifications to one or more users.
//
// **Endpoint**:
//   POST { userIds: string[], title: string, body: string }
//   - userIds: array of auth.users UUIDs to notify
//   - title: notification title (≤100 chars)
//   - body: notification body (≤4000 chars)
//
// **Auth**: calls Supabase with service-role to query push_tokens.
// Client calls this via the anon key + RLS (user can only insert
// their own tokens, but the Edge Function needs to READ other
// users' tokens — so it uses service_role).
//
// **Response**:
//   - 200 { ok: true, sent: number }
//   - 400 { ok: false, error: '...' }
// =========================================================================

// deno-lint-ignore-file no-explicit-any
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

// @ts-expect-error -- Deno ESM URL
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface PushRequest {
  userIds: string[];
  title: string;
  body: string;
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

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
    return jsonResponse(405, { ok: false, error: 'method_not_allowed' });
  }

  // Parse + validate payload.
  let payload: PushRequest;
  try {
    const raw = await req.json();
    if (
      !Array.isArray(raw?.userIds) ||
      raw.userIds.length === 0 ||
      typeof raw?.title !== 'string' ||
      typeof raw?.body !== 'string'
    ) {
      return jsonResponse(400, {
        ok: false,
        error: 'invalid_payload',
        hint: 'Expected { userIds: string[], title: string, body: string }',
      });
    }
    const title = raw.title.trim();
    const body = raw.body.trim();
    if (title.length === 0 || title.length > 100) {
      return jsonResponse(400, { ok: false, error: 'title must be 1-100 chars' });
    }
    if (body.length === 0 || body.length > 4000) {
      return jsonResponse(400, { ok: false, error: 'body must be 1-4000 chars' });
    }
    payload = { userIds: raw.userIds, title, body };
  } catch {
    return jsonResponse(400, { ok: false, error: 'malformed_json' });
  }

  // Fetch all push tokens for the target users.
  const { data: tokens, error: tokenErr } = await supabaseAdmin
    .from('push_tokens')
    .select('token')
    .in('user_id', payload.userIds);

  if (tokenErr) {
    console.error('[send-push] token query failed', tokenErr);
    return jsonResponse(500, { ok: false, error: 'token_query_failed' });
  }

  if (!tokens || tokens.length === 0) {
    return jsonResponse(200, { ok: true, sent: 0 });
  }

  // Build Expo push messages.
  const messages = tokens.map((t: { token: string }) => ({
    to: t.token,
    sound: 'default',
    title: payload.title,
    body: payload.body,
  }));

  // Send in batches of 100 (Expo limit).
  let sent = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
      if (res.ok) sent += batch.length;
      else {
        const errBody = await res.text();
        console.error('[send-push] Expo API error', res.status, errBody);
      }
    } catch (err) {
      console.error('[send-push] fetch failed', err);
    }
  }

  return jsonResponse(200, { ok: true, sent });
});
