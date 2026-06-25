import dotenv from 'dotenv';
dotenv.config();

import express, { type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import syncRoutes from './routes/sync';
import { runSync } from './services/syncService';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.use('/api/sync', syncRoutes);

const PORT = process.env['PORT'] ?? '3000';
app.listen(Number(PORT), () => {
  console.log(`[api] Listening on port ${PORT}`);

  cron.schedule('0 6,10,14,18,22 * * *', async () => {
    console.log('[cron] Starting live refresh sync');
    try {
      const result = await runSync('live');
      console.log(`[cron] Live sync complete in ${result.durationSeconds}s: ${result.metricsWritten} written`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[cron] Live sync failed:', message);
    }
  }, { timezone: 'UTC' });

  cron.schedule('59 23 * * 0', async () => {
    console.log('[cron] Starting weekly snapshot sync');
    try {
      const result = await runSync('snapshot');
      console.log(`[cron] Snapshot complete in ${result.durationSeconds}s: ${result.metricsWritten} written`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[cron] Snapshot sync failed:', message);
    }
  }, { timezone: 'UTC' });
});
