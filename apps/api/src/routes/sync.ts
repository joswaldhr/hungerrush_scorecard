import { Router } from 'express';
import type { Request, Response } from 'express';
import { syncOrgStructure } from '../services/graphSync';

const router = Router();

router.post('/org', async (req: Request, res: Response) => {
  const syncKey = req.headers['x-sync-key'];
  if (syncKey !== process.env['SUPABASE_SERVICE_KEY']) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  try {
    const result = await syncOrgStructure();
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[sync] Org sync failed:', message);
    res.status(500).json({ error: message });
  }
});

export default router;
