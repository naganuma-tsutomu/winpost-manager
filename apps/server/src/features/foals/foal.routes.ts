import { Router } from 'express';
import { prisma, FlagType } from '@winpost/database';
import { z } from 'zod';

export const foalRouter = Router();

const createFoalSchema = z.object({
  name: z.string().optional().nullable(),
  birthYear: z.number().int(),
  gender: z.enum(['MALE', 'FEMALE']),
  sireId: z.number().int().positive().optional().nullable(),
  damId: z.number().int().positive().optional().nullable(),
  kappaMark: z.enum(['DOUBLE_CIRCLE', 'CIRCLE', 'TRIANGLE', 'NONE']).default('NONE'),
  mikaMark: z.enum(['DOUBLE_CIRCLE', 'CIRCLE', 'TRIANGLE', 'NONE']).default('NONE'),
  managerMark: z.enum(['DOUBLE_CIRCLE', 'CIRCLE', 'TRIANGLE', 'NONE']).default('NONE'),
  secretaryMark: z.enum(['DOUBLE_CIRCLE', 'CIRCLE', 'TRIANGLE', 'NONE']).default('NONE'),
  nagamineMark: z.enum(['DOUBLE_CIRCLE', 'CIRCLE', 'TRIANGLE', 'NONE']).default('NONE'),
  commentGuts: z.enum(['NONE', 'GOOD', 'EXCELLENT', 'OUTSTANDING']).default('NONE'),
  commentExplosiveness: z.enum(['NONE', 'GOOD', 'EXCELLENT', 'OUTSTANDING']).default('NONE'),
  commentWisdom: z.enum(['NONE', 'GOOD', 'EXCELLENT', 'OUTSTANDING']).default('NONE'),
  commentSpirit: z.enum(['NONE', 'GOOD', 'EXCELLENT', 'OUTSTANDING']).default('NONE'),
  commentHealth: z.enum(['NONE', 'GOOD', 'EXCELLENT', 'OUTSTANDING']).default('NONE'),
  commentPower: z.enum(['NONE', 'GOOD', 'EXCELLENT', 'OUTSTANDING']).default('NONE'),
  commentFlexibility: z.enum(['NONE', 'GOOD', 'EXCELLENT', 'OUTSTANDING']).default('NONE'),
  bodyComment: z.string().optional().nullable(),
  growthType: z.enum(['SUPER_EARLY', 'EARLY', 'NORMAL', 'LATE', 'SUPER_LATE']).optional().nullable(),
  estimatedSpeed: z.number().int().optional().nullable(),
  memo: z.string().optional().nullable(),
});

const createFlagSchema = z.object({
  type: z.nativeEnum(FlagType),
  description: z.string().optional().nullable(),
  targetDate: z.string().optional().nullable(),
});

// 一覧取得
foalRouter.get('/', async (req, res) => {
  try {
    const { birthYear, gender } = req.query;
    const where: Record<string, unknown> = {};
    if (birthYear) where.birthYear = Number(birthYear);
    if (gender) where.gender = gender;

    const foals = await prisma.foal.findMany({
      where,
      include: {
        sire: { select: { id: true, name: true } },
        dam: { select: { id: true, name: true } },
        flags: true,
      },
      orderBy: [{ birthYear: 'desc' }, { name: 'asc' }],
    });
    res.json(foals);
  } catch (error) {
    console.error('Error fetching foals:', error);
    res.status(500).json({ error: '幼駒データの取得に失敗しました' });
  }
});

// 詳細取得
foalRouter.get('/:id', async (req, res) => {
  try {
    const foal = await prisma.foal.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        sire: { include: { childLineage: { include: { parentLineage: true } }, factors: true } },
        dam: { include: { factors: true } },
        flags: true,
      },
    });
    if (!foal) {
      res.status(404).json({ error: '幼駒が見つかりません' });
      return;
    }
    res.json(foal);
  } catch (error) {
    console.error('Error fetching foal:', error);
    res.status(500).json({ error: '幼駒データの取得に失敗しました' });
  }
});

// 新規登録
foalRouter.post('/', async (req, res) => {
  try {
    const data = createFoalSchema.parse(req.body);
    const foal = await prisma.foal.create({
      data,
      include: {
        sire: { select: { id: true, name: true } },
        dam: { select: { id: true, name: true } },
        flags: true,
      },
    });
    res.status(201).json(foal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Error creating foal:', error);
    res.status(500).json({ error: '幼駒の登録に失敗しました' });
  }
});

// 更新
foalRouter.put('/:id', async (req, res) => {
  try {
    const data = createFoalSchema.parse(req.body);
    const foal = await prisma.foal.update({
      where: { id: Number(req.params.id) },
      data,
      include: {
        sire: { select: { id: true, name: true } },
        dam: { select: { id: true, name: true } },
        flags: true,
      },
    });
    res.json(foal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Error updating foal:', error);
    res.status(500).json({ error: '幼駒の更新に失敗しました' });
  }
});

// 削除
foalRouter.delete('/:id', async (req, res) => {
  try {
    await prisma.foal.delete({ where: { id: Number(req.params.id) } });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting foal:', error);
    res.status(500).json({ error: '幼駒の削除に失敗しました' });
  }
});

// ========================================
// フラグ管理
// ========================================

// フラグ追加
foalRouter.post('/:id/flags', async (req, res) => {
  try {
    const data = createFlagSchema.parse(req.body);
    const flag = await prisma.foalFlag.create({
      data: {
        ...data,
        foalId: Number(req.params.id),
      },
    });
    res.status(201).json(flag);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Error creating flag:', error);
    res.status(500).json({ error: 'フラグの追加に失敗しました' });
  }
});

// フラグ削除
foalRouter.delete('/:foalId/flags/:flagId', async (req, res) => {
  try {
    const foalId = Number(req.params.foalId);
    const flagId = Number(req.params.flagId);
    const flag = await prisma.foalFlag.findUnique({ where: { id: flagId } });
    if (!flag || flag.foalId !== foalId) {
      res.status(404).json({ error: 'フラグが見つかりません' });
      return;
    }
    await prisma.foalFlag.delete({ where: { id: flagId } });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting flag:', error);
    res.status(500).json({ error: 'フラグの削除に失敗しました' });
  }
});
