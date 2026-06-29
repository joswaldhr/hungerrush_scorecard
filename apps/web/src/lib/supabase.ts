import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// TODO: remove after confirming production env vars are wired correctly
console.log('SUPABASE URL:', supabaseUrl);
console.log('SUPABASE ANON KEY:', supabaseAnonKey ? `${supabaseAnonKey.slice(0, 10)}...` : 'MISSING');

if (!supabaseUrl || supabaseUrl === 'undefined' || !supabaseAnonKey || supabaseAnonKey === 'undefined') {
  throw new Error(
    `Missing or invalid Supabase env vars. VITE_SUPABASE_URL=${supabaseUrl}, VITE_SUPABASE_ANON_KEY=${supabaseAnonKey ? 'set' : 'missing'}`
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
