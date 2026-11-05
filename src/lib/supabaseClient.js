import { createClient } from '@supabase/supabase-js';
import {
  realtimeEnabled,
  supabaseAnonKey,
  supabaseSchema,
  supabaseUrl,
} from './supabaseConfig';

let supabase;

export function getSupabaseRealtimeClient() {
  if (!realtimeEnabled) return null;
  if (!supabase) {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      db: {
        schema: supabaseSchema,
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return supabase;
}
