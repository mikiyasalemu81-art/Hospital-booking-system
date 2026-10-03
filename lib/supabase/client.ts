import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from './config';

let browserClient: SupabaseClient | null = null;

/** Singleton browser Supabase client (avoids multiple GoTrue instances / lock contention). */
export function createClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  return browserClient;
}
