import { Router } from 'express';
import { prisma } from '@winpost/database';
import { z } from 'zod';

export const mareRouter = Router();

const createMareSchema = z.object({
  name: z.string().min(1, '名前は必須です'),
  lineage: z.string().min(1, '系統は必須です'),
  speed: z.number().int().min(0).max(100).optional().nullable(),
  stamina: z.number().int().min(0).max(100).optional().nullable(),
  memo: z.string().optional().nullable(),
  factors: z.array(z.enum([
    'SPEED', 'STAMINA', 'POWER', 'TENACITY', 'AGILITY',
    'HEALTH', 'SPIRIT', 'WISDOM', 'FAMOUS_SIRE', 'GREAT_SIRE',
  ])).optional().default([]),
});

// 一覧取得
mareRouter.get('/', async (_req, res) => {
  try {
    const mares = await prisma.mare.findMany({
      include: { factors: true },
      orderBy: { name: 'asc' },
    });
    res.json(mares);
  } catch (error) {
    console.error('Error fetching mares:', error);
    res.status(500).json({ error: '繁殖牝馬データの取得に失敗しました' });
  }
});

// 詳細取得
mareRouter.get('/:id', async (req, res) => {
  try {
    const mare = await prisma.mare.findUnique({
      where: { id: Number(req.params.id) },
      include: { factors: true },
    });
    if (!mare) {
      res.status(404).json({ error: '繁殖牝馬が見つかりません' });
      return;
    }
    res.json(mare);
  } catch (error) {
    console.error('Error fetching mare:', error);
    res.status(500).json({ error: '繁殖牝馬データの取得に失敗しました' });
  }
});

// 新規登録
mareRouter.post('/', async (req, res) => {
  try {
    const data = createMareSchema.parse(req.body);
    const { factors, ...mareData } = data;

    const mare = await prisma.mare.create({
      data: {
        ...mareData,
        factors: {
          create: factors.map((type) => ({ type })),
        },
      },
      include: { factors: true },
    });
    res.status(201).json(mare);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Error creating mare:', error);
    res.status(500).json({ error: '繁殖牝馬の登録に失敗しました' });
  }
});

// 更新
mareRouter.put('/:id', async (req, res) => {
  try {
    const data = createMareSchema.parse(req.body);
    const { factors, ...mareData } = data;
    const id = Number(req.params.id);

    await prisma.factor.deleteMany({ where: { mareId: id } });

    const mare = await prisma.mare.update({
      where: { id },
      data: {
        ...mareData,
        factors: {
          create: factors.map((type) => ({ type })),
        },
      },
      include: { factors: true },
    });
    res.json(mare);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Error updating mare:', error);
    res.status(500).json({ error: '繁殖牝馬の更新に失敗しました' });
  }
});

// 削除
mareRouter.delete('/:id', async (req, res) => {
  try {
    await prisma.mare.delete({ where: { id: Number(req.params.id) } });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting mare:', error);
    res.status(500).json({ error: '繁殖牝馬の削除に失敗しました' });
  }
});
