import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: sessionStorage,
    storageKey: 'supabase.auth.token',
    debug: true
  },
  headers: {
    'X-Client-Info': 'timeflow@1.0.0'
  }
});

// Initialize the session from sessionStorage
const initSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await supabase.auth.setSession(session);
  }
};

initSession();