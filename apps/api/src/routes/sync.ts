import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { syncOrgStructure } from '../services/graphSync';
import { bootstrapAgentIds, runSync } from '../services/syncService';

const router = Router();

router.use((req: Request, res: Response, next: NextFunction) => {
  if (req.headers['x-sync-key'] !== process.env['SUPABASE_SERVICE_KEY']) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
});

router.post('/org', async (_req: Request, res: Response) => {
  try {
    const result = await syncOrgStructure();
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[sync] Org sync failed:', message);
    res.status(500).json({ error: message });
  }
});

router.post('/bootstrap', async (_req: Request, res: Response) => {
  try {
    const result = await bootstrapAgentIds();
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[sync] Bootstrap failed:', message);
    res.status(500).json({ error: message });
  }
});

router.post('/run', async (req: Request, res: Response) => {
  try {
    const mode: 'live' | 'snapshot' = req.body?.mode === 'snapshot' ? 'snapshot' : 'live';
    const result = await runSync(mode);
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[sync] Run failed:', message);
    res.status(500).json({ error: message });
  }
});

export default router;
