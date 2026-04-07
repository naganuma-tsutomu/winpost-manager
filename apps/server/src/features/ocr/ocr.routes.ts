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

// OCR サービスへのリクエストを中継する共通ヘルパー
async function proxyToOcr(
  endpoint: string,
  file: Express.Multer.File,
  extraFields?: Record<string, string>,
) {
  const form = new FormData();
  form.append('file', file.buffer, {
    filename: file.originalname || 'screenshot.png',
    contentType: file.mimetype,
  });
  if (extraFields) {
    for (const [key, value] of Object.entries(extraFields)) {
      form.append(key, value);
    }
  }
  return fetch(`${OCR_SERVICE_URL}${endpoint}`, {
    method: 'POST',
    body: form,
    headers: form.getHeaders(),
    signal: AbortSignal.timeout(60_000),
  });
}

function handleOcrError(e: unknown, res: Response): void {
  console.error('OCR 中継エラー:', e);
  if (e instanceof Error && e.name === 'TimeoutError') {
    res.status(504).json({ error: 'OCR 処理がタイムアウトしました' });
  } else {
    res.status(503).json({ error: 'OCR サービスに接続できません' });
  }
}

// ─────────────────────────────────────────
// GET /api/ocr/health  → OCR サービスの状態確認
// ─────────────────────────────────────────
ocrRouter.get('/health', async (_req: Request, res: Response) => {
  try {
    const resp = await fetch(`${OCR_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await resp.json() as Record<string, unknown>;
    res.json({ ...data, url: OCR_SERVICE_URL });
  } catch {
    res.status(503).json({
      status: 'unavailable',
      error: 'OCR サービスに接続できません',
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
  } catch {
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
    const resp = await proxyToOcr('/ocr/foal', req.file, { mode: 'foal' });
    if (!resp.ok) {
      const err = await resp.text();
      console.error('OCR サービスエラー:', err);
      res.status(resp.status).json({ error: 'OCR サービスでエラーが発生しました', detail: err });
      return;
    }
    res.json(await resp.json());
  } catch (e) {
    handleOcrError(e, res);
  }
});

// ─────────────────────────────────────────
// POST /api/ocr/stallion  → 種牡馬情報画面解析
// ─────────────────────────────────────────
ocrRouter.post('/stallion', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: '画像ファイルが必要です' });
    return;
  }
  try {
    const resp = await proxyToOcr('/ocr/stallion', req.file);
    if (!resp.ok) {
      const err = await resp.text();
      res.status(resp.status).json({ error: 'OCR サービスでエラーが発生しました', detail: err });
      return;
    }
    res.json(await resp.json());
  } catch (e) {
    handleOcrError(e, res);
  }
});

// ─────────────────────────────────────────
// POST /api/ocr/mare  → 繁殖牝馬情報画面解析
// ─────────────────────────────────────────
ocrRouter.post('/mare', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: '画像ファイルが必要です' });
    return;
  }
  try {
    const resp = await proxyToOcr('/ocr/mare', req.file);
    if (!resp.ok) {
      const err = await resp.text();
      res.status(resp.status).json({ error: 'OCR サービスでエラーが発生しました', detail: err });
      return;
    }
    res.json(await resp.json());
  } catch (e) {
    handleOcrError(e, res);
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
    const resp = await proxyToOcr('/ocr/raw', req.file);
    if (!resp.ok) {
      const err = await resp.text();
      console.error('OCR サービスエラー (raw):', err);
      res.status(resp.status).json({ error: 'OCR サービスでエラーが発生しました', detail: err });
      return;
    }
    res.json(await resp.json());
  } catch (e) {
    handleOcrError(e, res);
  }
});
