import { Router } from 'express';
import type { Request, Response } from 'express';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';

const router = Router();

router.get('/:token', async (req: Request, res: Response) => {
  const { token } = req.params;
  if (!token) {
    res.status(400).json({ error: 'Token is required' });
    return;
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: shareToken, error: tokenError } = await supabase
      .from('share_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (tokenError || !shareToken) {
      res.status(404).json({ error: 'Share link not found or has been removed.' });
      return;
    }

    const now = new Date();
    const expiresAt = new Date(shareToken.expires_at as string);
    if (now > expiresAt) {
      res.status(410).json({ error: 'This share link has expired. Ask your manager for a new one.' });
      return;
    }

    // Record first access
    if (!shareToken.used_at) {
      await supabase
        .from('share_tokens')
        .update({ used_at: now.toISOString() })
        .eq('id', shareToken.id);
    }

    // Audit log every access
    await supabase.from('audit_log').insert({
      actor_id: null,
      action: 'share_token_used',
      resource_type: 'share_token',
      resource_id: String(shareToken.id),
      metadata: {
        employee_id: shareToken.employee_id,
        token_id: shareToken.id,
        ip: req.ip ?? req.headers['x-forwarded-for'] ?? 'unknown',
      },
    });

    // Fetch employee
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, full_name, email')
      .eq('id', shareToken.employee_id)
      .single();

    if (empError || !employee) {
      res.status(404).json({ error: 'Employee not found.' });
      return;
    }

    // Fetch active metric definitions
    const { data: definitions, error: defError } = await supabase
      .from('metric_definitions')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (defError) {
      res.status(500).json({ error: 'Failed to load metric definitions.' });
      return;
    }

    // Fetch ALL snapshots for this employee — the shared page needs history for sparklines
    const { data: snapshots, error: snapError } = await supabase
      .from('metric_snapshots')
      .select('metric_key, value, period_start, period_end, synced_at')
      .eq('employee_id', String(employee.id))
      .order('period_start', { ascending: false });

    if (snapError) {
      res.status(500).json({ error: 'Failed to load metrics.' });
      return;
    }

    res.json({
      employee: { full_name: employee.full_name, email: employee.email },
      definitions: definitions ?? [],
      snapshots: snapshots ?? [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[share] Error:', message);
    res.status(500).json({ error: 'An unexpected error occurred.' });
  }
});

export default router;
