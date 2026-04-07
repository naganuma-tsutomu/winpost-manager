import { Router } from 'express';
import { prisma } from '@winpost/database';
import { z } from 'zod';
import {
  calculateBreeding,
  type StallionInput,
  type MareInput,
  type AncestorEntry,
  type NicksRelation,
} from '@winpost/shared';

export const breedingRouter = Router();

// ─────────────────────────────────────────
// 配合計算 API
// POST /api/breeding/calculate
// body: { stallionId: number, mareId: number }
// ─────────────────────────────────────────

const calculateSchema = z.object({
  stallionId: z.number().int().positive(),
  mareId: z.number().int().positive(),
});

breedingRouter.post('/calculate', async (req, res) => {
  try {
    const { stallionId, mareId } = calculateSchema.parse(req.body);

    // 種牡馬・繁殖牝馬・血統を並列取得
    const [stallion, mare, nicksRelations] = await Promise.all([
      prisma.stallion.findUnique({
        where: { id: stallionId },
        include: {
          childLineage: { include: { parentLineage: true } },
          factors: true,
          pedigreeAsAncestor: false,
        },
      }),
      prisma.mare.findUnique({
        where: { id: mareId },
        include: { factors: true },
      }),
      prisma.nicksRelation.findMany(),
    ]);

    if (!stallion) {
      res.status(404).json({ error: '種牡馬が見つかりません' });
      return;
    }
    if (!mare) {
      res.status(404).json({ error: '繁殖牝馬が見つかりません' });
      return;
    }

    // 血統表データを取得
    const [stallionPedigree, marePedigree] = await Promise.all([
      prisma.pedigreeEntry.findMany({
        where: { horseType: 'stallion', horseId: stallionId },
        include: { ancestor: { include: { childLineage: { include: { parentLineage: true } }, factors: true } } },
      }),
      prisma.pedigreeEntry.findMany({
        where: { horseType: 'mare', horseId: mareId },
        include: { ancestor: { include: { childLineage: { include: { parentLineage: true } }, factors: true } } },
      }),
    ]);

    // 計算用オブジェクトに変換
    const toAncestorEntry = (entry: typeof stallionPedigree[0]): AncestorEntry => ({
      ancestorId: entry.ancestorId,
      ancestorName: entry.ancestor.name,
      position: entry.position,
      generation: entry.generation,
      factorTypes: entry.ancestor.factors.map(f => f.type),
      childLineageId: entry.ancestor.childLineageId,
      parentLineageId: entry.ancestor.childLineage?.parentLineage?.id ?? 0,
    });

    const stallionInput: StallionInput = {
      id: stallion.id,
      name: stallion.name,
      childLineageId: stallion.childLineageId,
      parentLineageId: stallion.childLineage?.parentLineage?.id ?? 0,
      factorTypes: stallion.factors.map(f => f.type),
      pedigree: stallionPedigree.map(toAncestorEntry),
    };

    const mareInput: MareInput = {
      id: mare.id,
      name: mare.name,
      lineage: mare.lineage,
      factorTypes: mare.factors.map(f => f.type),
      pedigree: marePedigree.map(toAncestorEntry),
    };

    const nicksTable: NicksRelation[] = nicksRelations.map(n => ({
      lineageAId: n.lineageAId,
      lineageBId: n.lineageBId,
      level: n.level,
    }));

    const result = calculateBreeding(stallionInput, mareInput, nicksTable);

    res.json({
      stallion: { id: stallion.id, name: stallion.name, lineage: stallion.childLineage?.parentLineage?.name },
      mare: { id: mare.id, name: mare.name, lineage: mare.lineage },
      result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Error calculating breeding:', error);
    res.status(500).json({ error: '配合計算に失敗しました' });
  }
});

// ─────────────────────────────────────────
// 血統表 API
// GET  /api/breeding/pedigree/:type/:id  (type: stallion|mare)
// POST /api/breeding/pedigree/:type/:id
// ─────────────────────────────────────────

const pedigreeEntrySchema = z.object({
  ancestorId: z.number().int().positive(),
  generation: z.number().int().min(1).max(5),
  position: z.string().min(1).max(10),
});

// 血統表取得
breedingRouter.get('/pedigree/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  if (type !== 'stallion' && type !== 'mare') {
    res.status(400).json({ error: 'type は stallion または mare を指定してください' });
    return;
  }
  try {
    const entries = await prisma.pedigreeEntry.findMany({
      where: { horseType: type, horseId: Number(id) },
      include: {
        ancestor: {
          include: {
            childLineage: { include: { parentLineage: true } },
            factors: true,
          },
        },
      },
      orderBy: { generation: 'asc' },
    });
    res.json(entries);
  } catch (error) {
    console.error('Error fetching pedigree:', error);
    res.status(500).json({ error: '血統表の取得に失敗しました' });
  }
});

// 血統表エントリ一括保存（差し替え）
const savePedigreeSchema = z.object({
  entries: z.array(pedigreeEntrySchema),
});

breedingRouter.post('/pedigree/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  if (type !== 'stallion' && type !== 'mare') {
    res.status(400).json({ error: 'type は stallion または mare を指定してください' });
    return;
  }
  try {
    const { entries } = savePedigreeSchema.parse(req.body);
    const horseId = Number(id);

    await prisma.$transaction([
      prisma.pedigreeEntry.deleteMany({ where: { horseType: type, horseId } }),
      prisma.pedigreeEntry.createMany({
        data: entries.map(e => ({
          horseType: type,
          horseId,
          ancestorId: e.ancestorId,
          generation: e.generation,
          position: e.position,
        })),
      }),
    ]);

    const saved = await prisma.pedigreeEntry.findMany({
      where: { horseType: type, horseId },
      include: { ancestor: { include: { childLineage: { include: { parentLineage: true } }, factors: true } } },
      orderBy: { generation: 'asc' },
    });
    res.json(saved);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Error saving pedigree:', error);
    res.status(500).json({ error: '血統表の保存に失敗しました' });
  }
});

// ─────────────────────────────────────────
// 配合計画 CRUD
// ─────────────────────────────────────────

const breedingPlanSchema = z.object({
  year: z.number().int().min(1700).max(2200),
  stallionId: z.number().int().positive(),
  mareId: z.number().int().positive(),
  memo: z.string().optional().nullable(),
  status: z.enum(['PLANNED', 'COMPLETED', 'CANCELLED']).optional().default('PLANNED'),
});

// 配合計画一覧
breedingRouter.get('/plans', async (req, res) => {
  try {
    const { year } = req.query;
    const plans = await prisma.breedingPlan.findMany({
      where: year ? { year: Number(year) } : {},
      include: {
        stallion: { select: { id: true, name: true, childLineage: { include: { parentLineage: true } } } },
        mare: { select: { id: true, name: true, lineage: true } },
      },
      orderBy: [{ year: 'asc' }, { createdAt: 'asc' }],
    });
    res.json(plans);
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: '配合計画の取得に失敗しました' });
  }
});

// 配合計画登録
breedingRouter.post('/plans', async (req, res) => {
  try {
    const data = breedingPlanSchema.parse(req.body);
    const plan = await prisma.breedingPlan.create({
      data,
      include: {
        stallion: { select: { id: true, name: true } },
        mare: { select: { id: true, name: true } },
      },
    });
    res.status(201).json(plan);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Error creating plan:', error);
    res.status(500).json({ error: '配合計画の登録に失敗しました' });
  }
});

// 配合計画更新
breedingRouter.put('/plans/:id', async (req, res) => {
  try {
    const data = breedingPlanSchema.parse(req.body);
    const plan = await prisma.breedingPlan.update({
      where: { id: Number(req.params.id) },
      data,
      include: {
        stallion: { select: { id: true, name: true } },
        mare: { select: { id: true, name: true } },
      },
    });
    res.json(plan);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Error updating plan:', error);
    res.status(500).json({ error: '配合計画の更新に失敗しました' });
  }
});

// 配合計画削除
breedingRouter.delete('/plans/:id', async (req, res) => {
  try {
    await prisma.breedingPlan.delete({ where: { id: Number(req.params.id) } });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting plan:', error);
    res.status(500).json({ error: '配合計画の削除に失敗しました' });
  }
});

// ─────────────────────────────────────────
// ニックス相性 API
// ─────────────────────────────────────────

const nicksSchema = z.object({
  lineageAId: z.number().int().positive(),
  lineageBId: z.number().int().positive(),
  level: z.number().int().min(1).max(3),
});

breedingRouter.get('/nicks', async (_req, res) => {
  try {
    const nicks = await prisma.nicksRelation.findMany({
      orderBy: { lineageAId: 'asc' },
    });
    res.json(nicks);
  } catch (error) {
    res.status(500).json({ error: 'ニックス相性の取得に失敗しました' });
  }
});

breedingRouter.post('/nicks', async (req, res) => {
  try {
    const data = nicksSchema.parse(req.body);
    const nicks = await prisma.nicksRelation.upsert({
      where: { lineageAId_lineageBId: { lineageAId: data.lineageAId, lineageBId: data.lineageBId } },
      update: { level: data.level },
      create: data,
    });
    res.status(201).json(nicks);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    res.status(500).json({ error: 'ニックス相性の登録に失敗しました' });
  }
});

breedingRouter.delete('/nicks/:id', async (req, res) => {
  try {
    await prisma.nicksRelation.delete({ where: { id: Number(req.params.id) } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'ニックス相性の削除に失敗しました' });
  }
});
