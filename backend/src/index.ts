import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb } from './db';
import { chatRouter } from './routes/chat';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
// Allow '*' wildcard for deployment flexibility (set specific origin in production env var)
const corsOrigin = FRONTEND_URL === '*' ? true : FRONTEND_URL;

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: '50kb' }));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.use('/chat', chatRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler – ensures the server never crashes on unhandled errors
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'An unexpected error occurred' });
});

initDb();

app.listen(PORT, () => {
  console.log(`Spur backend listening on http://localhost:${PORT}`);
});
