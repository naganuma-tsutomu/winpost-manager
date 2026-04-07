import { Router } from 'express';
import { prisma } from '@winpost/database';
import { z } from 'zod';

export const lineageRouter = Router();

const createParentLineageSchema = z.object({
  name: z.string().min(1, '系統名は必須です'),
});

const createChildLineageSchema = z.object({
  name: z.string().min(1, '系統名は必須です'),
  parentLineageId: z.number().int().positive(),
});

// ========================================
// 親系統
// ========================================

// 親系統一覧（子系統含む）
lineageRouter.get('/parent', async (_req, res) => {
  try {
    const lineages = await prisma.parentLineage.findMany({
      include: { childLineages: true },
      orderBy: { name: 'asc' },
    });
    res.json(lineages);
  } catch (error) {
    console.error('Error fetching parent lineages:', error);
    res.status(500).json({ error: '親系統データの取得に失敗しました' });
  }
});

// 親系統登録
lineageRouter.post('/parent', async (req, res) => {
  try {
    const data = createParentLineageSchema.parse(req.body);
    const lineage = await prisma.parentLineage.create({
      data,
      include: { childLineages: true },
    });
    res.status(201).json(lineage);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Error creating parent lineage:', error);
    res.status(500).json({ error: '親系統の登録に失敗しました' });
  }
});

// 親系統更新
lineageRouter.put('/parent/:id', async (req, res) => {
  try {
    const data = createParentLineageSchema.parse(req.body);
    const lineage = await prisma.parentLineage.update({
      where: { id: Number(req.params.id) },
      data,
      include: { childLineages: true },
    });
    res.json(lineage);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Error updating parent lineage:', error);
    res.status(500).json({ error: '親系統の更新に失敗しました' });
  }
});

// 親系統削除
lineageRouter.delete('/parent/:id', async (req, res) => {
  try {
    await prisma.parentLineage.delete({ where: { id: Number(req.params.id) } });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting parent lineage:', error);
    res.status(500).json({ error: '親系統の削除に失敗しました' });
  }
});

// ========================================
// 子系統
// ========================================

// 子系統一覧
lineageRouter.get('/child', async (_req, res) => {
  try {
    const lineages = await prisma.childLineage.findMany({
      include: { parentLineage: true },
      orderBy: { name: 'asc' },
    });
    res.json(lineages);
  } catch (error) {
    console.error('Error fetching child lineages:', error);
    res.status(500).json({ error: '子系統データの取得に失敗しました' });
  }
});

// 子系統登録
lineageRouter.post('/child', async (req, res) => {
  try {
    const data = createChildLineageSchema.parse(req.body);
    const lineage = await prisma.childLineage.create({
      data,
      include: { parentLineage: true },
    });
    res.status(201).json(lineage);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Error creating child lineage:', error);
    res.status(500).json({ error: '子系統の登録に失敗しました' });
  }
});

// 子系統更新
lineageRouter.put('/child/:id', async (req, res) => {
  try {
    const data = createChildLineageSchema.parse(req.body);
    const lineage = await prisma.childLineage.update({
      where: { id: Number(req.params.id) },
      data,
      include: { parentLineage: true },
    });
    res.json(lineage);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Error updating child lineage:', error);
    res.status(500).json({ error: '子系統の更新に失敗しました' });
  }
});

// 子系統削除
lineageRouter.delete('/child/:id', async (req, res) => {
  try {
    await prisma.childLineage.delete({ where: { id: Number(req.params.id) } });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting child lineage:', error);
    res.status(500).json({ error: '子系統の削除に失敗しました' });
  }
});
