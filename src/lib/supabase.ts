/**
 * Supabase client — single shared instance for the whole app.
 *
 * Reads credentials from EXPO_PUBLIC_* env vars (defined in `.env`,
 * gitignored; see `.env.example` for the keys you need to set). The
 * `EXPO_PUBLIC_` prefix is required for Expo to inline the value at
 * build time and expose it to the JS bundle.
 *
 * The anon key is safe to ship in the client (it's JWT-signed and
 * RLS policies enforce what each user can do). The `service_role`
 * key is NEVER used here — that bypasses RLS and belongs only on
 * the server (Edge Functions).
 *
 * The `Database` generic is intentionally `any` for Phase 1. It will
 * be replaced with the generated types from `supabase gen types
 * typescript` in Phase 3, once the schema migrations are in place.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase credentials. Copy .env.example to .env and fill in ' +
      'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY before ' +
      'running the app. See openspec/ONBOARDING.md for the full setup.',
  );
}

/**
 * Shared Supabase client. Typed with a placeholder `Database` shape
 * until the generated types land in Phase 3.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: SupabaseClient<any> = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Expo Go / native don't use URL-based session detection.
      detectSessionInUrl: false,
    },
  },
);
