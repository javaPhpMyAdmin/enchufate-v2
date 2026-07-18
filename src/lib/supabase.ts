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
 * Auth token persistence uses the `expo-secure-store` adapter
 * (`secureStorage`) so the refresh token lives in the iOS Keychain
 * / Android EncryptedSharedPreferences — never in plain text on
 * disk. The `Database` generic will get the real generated types
 * in Phase 3 (after the first Supabase migration); the placeholder
 * shape lets us type the client today without a schema.
 */
import { createClient } from '@supabase/supabase-js';

import type { Database } from './database.types';
import { secureStorage } from './secureStorage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase credentials. Copy .env.example to .env and fill in ' +
      'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY before ' +
      'running the app. See openspec/ONBOARDING.md for the full setup.',
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Expo Go / native don't use URL-based session detection.
    detectSessionInUrl: false,
  },
});
