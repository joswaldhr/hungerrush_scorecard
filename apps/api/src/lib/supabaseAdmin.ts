import { createClient } from '@supabase/supabase-js';

// Service-key client — bypasses RLS. Backend jobs and routes only; the key never
// leaves this process (see CLAUDE.md env rules).
export function getSupabaseAdmin() {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_KEY'];
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
