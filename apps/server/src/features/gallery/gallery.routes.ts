import { Router, Request, Response } from 'express';
import { prisma } from '@winpost/database';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

export const galleryRouter = Router();

// アップロード先ディレクトリの確保
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer設定
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'gallery-' + uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

const galleryEntrySchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string(),
  eventDate: z.string().optional().nullable(),
});

// ギャラリー一覧取得
galleryRouter.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const entries = await prisma.galleryEntry.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: 'ギャラリーの取得に失敗しました' });
  }
});

// ギャラリー登録 (multipart/form-data)
galleryRouter.post('/', upload.single('image'), async (req: Request, res: Response): Promise<void> => {
  try {
    const data = galleryEntrySchema.parse(req.body);
    let imageUrl = null;
    
    // アップロードされたファイルがあれば、パスを設定
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    }

    const entry = await prisma.galleryEntry.create({
      data: {
        ...data,
        imageUrl,
      },
    });
    res.status(201).json(entry);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Gallery create error:', error);
    res.status(500).json({ error: 'ギャラリーの登録に失敗しました' });
  }
});

// ギャラリー削除
galleryRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const entry = await prisma.galleryEntry.findUnique({ where: { id } });
    
    if (entry && entry.imageUrl && entry.imageUrl.startsWith('/uploads/')) {
      // ローカルファイルが存在すれば削除
      const filepath = path.join(process.cwd(), entry.imageUrl.replace('/uploads/', 'uploads/'));
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    }
    
    await prisma.galleryEntry.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'ギャラリーの削除に失敗しました' });
  }
});
