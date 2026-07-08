import { Router } from 'express';
import type { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';

const router = Router();

async function extractAuth(req: Request): Promise<{ userId: string; token: string } | null> {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const supabase = getSupabaseAdmin();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return { userId: user.id, token };
}

// Scope check (audit PR 2a, REVIEW.md 0.3 / sprint decision 5): any valid JWT
// could previously log a pdf_export for ANY employee_id. This runs an
// employees SELECT under the CALLER's own JWT, so the check IS the existing
// visibility function — the employees RLS policy is visible_employee_ids()
// (0005/0014/0017 family) — rather than a re-implementation of it.
async function callerCanSeeEmployee(token: string, employeeId: string): Promise<boolean> {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_KEY'];
  if (!url || !key) return false;
  const asCaller = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    // The Authorization JWT decides the PostgREST role — the caller's token
    // makes every query run as `authenticated` under their RLS.
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await asCaller
    .from('employees')
    .select('id')
    .eq('id', employeeId)
    .maybeSingle();
  return !error && data !== null;
}

router.post('/export', async (req: Request, res: Response) => {
  const auth = await extractAuth(req);
  if (!auth) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const actorId = auth.userId;

  const employeeId = req.body?.employee_id as string | undefined;
  if (!employeeId) {
    res.status(400).json({ error: 'employee_id is required' });
    return;
  }

  if (!(await callerCanSeeEmployee(auth.token, employeeId))) {
    res.status(403).json({ error: 'You do not have access to this employee.' });
    return;
  }

  try {
    const supabase = getSupabaseAdmin();

    const { error: insertError } = await supabase.from('audit_log').insert({
      actor_id: actorId,
      action: 'pdf_export',
      resource_type: 'employee',
      resource_id: employeeId,
      metadata: {},
    });

    if (insertError) {
      console.error('[audit] Insert failed:', insertError.message);
      res.status(500).json({ error: 'Failed to log export.' });
      return;
    }

    res.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[audit] Error:', message);
    res.status(500).json({ error: 'An unexpected error occurred.' });
  }
});

export default router;
