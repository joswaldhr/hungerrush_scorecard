import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { syncOrgStructure } from '../services/graphSync';
import { bootstrapAgentIds, isSyncRunning, runSync } from '../services/syncService';

const router = Router();

// Manual-trigger auth: a dedicated shared secret, NOT the service key — the RLS-bypass
// key must never double as an HTTP credential (Phase 2, approved decision b). The
// explicit !expected guard means an unset var fails closed instead of comparing
// undefined === undefined and letting header-less requests through.
router.use((req: Request, res: Response, next: NextFunction) => {
  const expected = process.env['SYNC_TRIGGER_KEY'];
  if (!expected || req.headers['x-sync-key'] !== expected) {
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

router.post('/run', (req: Request, res: Response) => {
  const mode: 'live' | 'snapshot' = req.body?.mode === 'snapshot' ? 'snapshot' : 'live';
  // Overlap guard (audit PR 2a): one sync at a time — a manual trigger during a
  // cron run is rejected loudly instead of doubling API load and interleaving
  // synced_at stamps. runSync itself also throws on the check-to-start race.
  if (isSyncRunning()) {
    console.warn(`[sync] Manual ${mode} run rejected — a sync is already running`);
    res.status(409).json({
      accepted: false,
      error: 'A sync is already running — try again when it completes.',
    });
    return;
  }
  // 202 + fire-and-forget: Railway's edge proxy kills HTTP responses at exactly 300s
  // while the sync keeps running in-container, so the response was never a usable
  // completion signal. Verify DB-side (rows share one synced_at stamp per run) or in
  // Railway logs — same as before, minus the misleading 'upstream error'.
  runSync(mode)
    .then(result =>
      console.log(
        `[sync] Manual ${mode} run complete in ${result.durationSeconds}s: ` +
        `${result.metricsWritten} written, ${result.errors.length} errors`,
      ),
    )
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[sync] Manual run failed:', message);
    });
  res.status(202).json({ accepted: true, mode, startedAt: new Date().toISOString() });
});

export default router;
