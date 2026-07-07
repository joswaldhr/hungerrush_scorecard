import { Router } from 'express';
import type { Request, Response } from 'express';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';

const router = Router();

async function extractUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const supabase = getSupabaseAdmin();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

router.post('/export', async (req: Request, res: Response) => {
  const actorId = await extractUserId(req);
  if (!actorId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const employeeId = req.body?.employee_id as string | undefined;
  if (!employeeId) {
    res.status(400).json({ error: 'employee_id is required' });
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
