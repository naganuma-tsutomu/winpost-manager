import { Router } from 'express';
import { prisma } from '@winpost/database';
import { z } from 'zod';

export const stallionRouter = Router();

// バリデーションスキーマ
const createStallionSchema = z.object({
  name: z.string().min(1, '名前は必須です'),
  childLineageId: z.number().int().positive(),
  speed: z.number().int().min(0).max(100).optional().nullable(),
  stamina: z.number().int().min(0).max(100).optional().nullable(),
  power: z.number().int().min(0).max(100).optional().nullable(),
  guts: z.number().int().min(0).max(100).optional().nullable(),
  wisdom: z.number().int().min(0).max(100).optional().nullable(),
  health: z.number().int().min(0).max(100).optional().nullable(),
  memo: z.string().optional().nullable(),
  factors: z.array(z.enum([
    'SPEED', 'STAMINA', 'POWER', 'TENACITY', 'AGILITY',
    'HEALTH', 'SPIRIT', 'WISDOM', 'FAMOUS_SIRE', 'GREAT_SIRE',
  ])).optional().default([]),
});

// 一覧取得
stallionRouter.get('/', async (_req, res) => {
  try {
    const stallions = await prisma.stallion.findMany({
      include: {
        childLineage: { include: { parentLineage: true } },
        factors: true,
      },
      orderBy: { name: 'asc' },
    });
    res.json(stallions);
  } catch (error) {
    console.error('Error fetching stallions:', error);
    res.status(500).json({ error: '種牡馬データの取得に失敗しました' });
  }
});

// 詳細取得
stallionRouter.get('/:id', async (req, res) => {
  try {
    const stallion = await prisma.stallion.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        childLineage: { include: { parentLineage: true } },
        factors: true,
      },
    });
    if (!stallion) {
      res.status(404).json({ error: '種牡馬が見つかりません' });
      return;
    }
    res.json(stallion);
  } catch (error) {
    console.error('Error fetching stallion:', error);
    res.status(500).json({ error: '種牡馬データの取得に失敗しました' });
  }
});

// 新規登録
stallionRouter.post('/', async (req, res) => {
  try {
    const data = createStallionSchema.parse(req.body);
    const { factors, ...stallionData } = data;

    const stallion = await prisma.stallion.create({
      data: {
        ...stallionData,
        factors: {
          create: factors.map((type) => ({ type })),
        },
      },
      include: {
        childLineage: { include: { parentLineage: true } },
        factors: true,
      },
    });
    res.status(201).json(stallion);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Error creating stallion:', error);
    res.status(500).json({ error: '種牡馬の登録に失敗しました' });
  }
});

// 更新
stallionRouter.put('/:id', async (req, res) => {
  try {
    const data = createStallionSchema.parse(req.body);
    const { factors, ...stallionData } = data;
    const id = Number(req.params.id);

    // 因子を差し替え
    await prisma.factor.deleteMany({ where: { stallionId: id } });

    const stallion = await prisma.stallion.update({
      where: { id },
      data: {
        ...stallionData,
        factors: {
          create: factors.map((type) => ({ type })),
        },
      },
      include: {
        childLineage: { include: { parentLineage: true } },
        factors: true,
      },
    });
    res.json(stallion);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Error updating stallion:', error);
    res.status(500).json({ error: '種牡馬の更新に失敗しました' });
  }
});

// 削除
stallionRouter.delete('/:id', async (req, res) => {
  try {
    await prisma.stallion.delete({ where: { id: Number(req.params.id) } });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting stallion:', error);
    res.status(500).json({ error: '種牡馬の削除に失敗しました' });
  }
});
