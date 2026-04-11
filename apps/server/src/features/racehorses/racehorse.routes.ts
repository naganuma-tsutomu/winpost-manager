import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '@winpost/database';
import {
  getAllRacehorses,
  getRacehorseById,
  createRacehorse,
  updateRacehorse,
  deleteRacehorse,
} from './racehorse.controller.js';

export const racehorseRouter = Router();

// スクリーンショットアップロード用 multer 設定
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'racehorse-' + uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('画像ファイルのみアップロード可能です'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

racehorseRouter.get('/', getAllRacehorses);
racehorseRouter.get('/:id', getRacehorseById);
racehorseRouter.post('/', createRacehorse);
racehorseRouter.put('/:id', updateRacehorse);
racehorseRouter.delete('/:id', deleteRacehorse);

// スクリーンショットアップロード
racehorseRouter.post('/:id/screenshot', upload.single('screenshot'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (!req.file) {
      res.status(400).json({ error: 'ファイルが送信されていません' });
      return;
    }

    // 既存のスクリーンショットを削除
    const existing = await prisma.racehorse.findUnique({ where: { id }, select: { screenshotUrl: true } });
    if (existing?.screenshotUrl?.startsWith('/uploads/')) {
      const oldPath = path.join(process.cwd(), existing.screenshotUrl.slice(1));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const screenshotUrl = `/uploads/${req.file.filename}`;
    const racehorse = await prisma.racehorse.update({
      where: { id },
      data: { screenshotUrl },
    });
    res.json(racehorse);
  } catch (error) {
    console.error('Screenshot upload error:', error);
    res.status(500).json({ error: 'アップロードに失敗しました' });
  }
});

// スクリーンショット削除
racehorseRouter.delete('/:id/screenshot', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.racehorse.findUnique({ where: { id }, select: { screenshotUrl: true } });
    if (existing?.screenshotUrl?.startsWith('/uploads/')) {
      const filePath = path.join(process.cwd(), existing.screenshotUrl.slice(1));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    const racehorse = await prisma.racehorse.update({
      where: { id },
      data: { screenshotUrl: null },
    });
    res.json(racehorse);
  } catch (error) {
    res.status(500).json({ error: '削除に失敗しました' });
  }
});
