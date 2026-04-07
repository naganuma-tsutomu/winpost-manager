import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
import express from 'express';
import cors from 'cors';
import { stallionRouter } from './features/horses/stallion.routes.js';
import { mareRouter } from './features/horses/mare.routes.js';
import { lineageRouter } from './features/horses/lineage.routes.js';
import { foalRouter } from './features/foals/foal.routes.js';
import { breedingRouter } from './features/breeding/breeding.routes.js';
import { ocrRouter } from './features/ocr/ocr.routes.js';
import { calendarRouter } from './features/calendar/calendar.routes.js';
import { galleryRouter } from './features/gallery/gallery.routes.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ミドルウェア
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ヘルスチェック
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ルーティング
app.use('/api/stallions', stallionRouter);
app.use('/api/mares', mareRouter);
app.use('/api/lineages', lineageRouter);
app.use('/api/foals', foalRouter);
app.use('/api/breeding', breedingRouter);
app.use('/api/ocr', ocrRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/gallery', galleryRouter);

// エラーハンドリング
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🐎 WinPost Server running on http://localhost:${PORT}`);
});

export default app;
