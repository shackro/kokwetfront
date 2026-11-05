export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
export const supabaseSchema = import.meta.env.VITE_SUPABASE_SCHEMA?.trim() || 'kokwet_app';
export const realtimeEnabled = Boolean(supabaseUrl && supabaseAnonKey);
