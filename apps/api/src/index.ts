import dotenv from 'dotenv';
dotenv.config();

import express, { type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import syncRoutes from './routes/sync';

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
});
