/**
 * Supabase Database type — placeholder.
 *
 * Will be regenerated in Phase 3 via:
 *   pnpm supabase gen types typescript --local > src/lib/database.types.ts
 *
 * (or `--project-id <id>` against the remote). Until the first
 * migration lands, the schema is empty and we type the client with
 * a permissive shape so feature hooks can be written against the
 * future `Database['public']['Tables']['chargers']['Row']` etc.
 *
 * **Do not hand-edit this file** — it will be overwritten the first
 * time the Supabase CLI regenerates it. The shape below mirrors the
 * default scaffold the CLI emits when the public schema is empty,
 * so the regenerated file will diff cleanly.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [k: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
