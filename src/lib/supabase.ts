import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Shared Supabase client, or null when no project is configured.
 *
 * There's no login system (PRD §6) — this is the anon key, meant to be
 * readable by anyone with the app link. `storage.ts` falls back to
 * localStorage-only mode when this is null, so the app still runs without a
 * Supabase project configured; it just won't share data across teammates.
 */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;

export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}
