import { Router, Request, Response } from 'express';
import multer from 'multer';
import fetch from 'node-fetch';
import FormData from 'form-data';

export const ocrRouter = Router();

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://localhost:8000';

// multer - メモリストレージ (最大 10MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('画像ファイルのみアップロードできます'));
    }
  },
});

// ─────────────────────────────────────────
// GET /api/ocr/health  → OCR サービスの状態確認
// ─────────────────────────────────────────
ocrRouter.get('/health', async (_req: Request, res: Response) => {
  try {
    const resp = await fetch(`${OCR_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await resp.json() as any;
    res.json({ ...data, url: OCR_SERVICE_URL });
  } catch (e: any) {
    res.status(503).json({
      status: 'unavailable',
      error: 'OCR サービスに接続できません',
      url: OCR_SERVICE_URL,
    });
  }
});

// ─────────────────────────────────────────
// GET /api/ocr/ready  → EasyOCR モデルのロード状態確認
// ─────────────────────────────────────────
ocrRouter.get('/ready', async (_req: Request, res: Response) => {
  try {
    const resp = await fetch(`${OCR_SERVICE_URL}/ready`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await resp.json();
    res.json(data);
  } catch (e) {
    res.status(503).json({ ready: false, error: 'OCR サービス未応答' });
  }
});

// ─────────────────────────────────────────
// POST /api/ocr/foal  → 幼駒評価シート解析
// ─────────────────────────────────────────
ocrRouter.post('/foal', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: '画像ファイルが必要です' });
    return;
  }

  try {
    const form = new FormData();
    form.append('file', req.file.buffer, {
      filename: req.file.originalname || 'screenshot.png',
      contentType: req.file.mimetype,
    });
    form.append('mode', 'foal');

    const resp = await fetch(`${OCR_SERVICE_URL}/ocr/foal`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
      signal: AbortSignal.timeout(60_000), // OCR は最大60秒
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error('OCR サービスエラー:', err);
      res.status(resp.status).json({ error: 'OCR サービスでエラーが発生しました', detail: err });
      return;
    }

    const data = await resp.json();
    res.json(data);
  } catch (e: any) {
    console.error('OCR 中継エラー:', e);
    if (e.name === 'TimeoutError') {
      res.status(504).json({ error: 'OCR 処理がタイムアウトしました' });
    } else {
      res.status(503).json({ error: 'OCR サービスに接続できません。サービスが起動しているか確認してください。' });
    }
  }
});

// ─────────────────────────────────────────
// POST /api/ocr/raw  → 生テキスト取得（デバッグ用）
// ─────────────────────────────────────────
ocrRouter.post('/raw', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: '画像ファイルが必要です' });
    return;
  }

  try {
    const form = new FormData();
    form.append('file', req.file.buffer, {
      filename: req.file.originalname || 'screenshot.png',
      contentType: req.file.mimetype,
    });

    const resp = await fetch(`${OCR_SERVICE_URL}/ocr/raw`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
      signal: AbortSignal.timeout(60_000),
    });

    const data = await resp.json();
    res.json(data);
  } catch (e: any) {
    res.status(503).json({ error: 'OCR サービスに接続できません' });
  }
});
