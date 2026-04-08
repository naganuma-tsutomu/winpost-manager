import { Request, Response } from 'express';
import { prisma } from '@winpost/database';
import { z } from 'zod';

const gradeEnum = z.enum(['S', 'A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'E+', 'E', 'F']).optional().nullable();

const racehorseCreateSchema = z.object({
  name: z.string().min(1),
  birthYear: z.number().int().optional().nullable(),
  gender: z.enum(['MALE', 'FEMALE']),
  sireId: z.number().int().positive().optional().nullable(),
  damId: z.number().int().positive().optional().nullable(),
  growthType: z.enum(['SUPER_EARLY', 'EARLY', 'NORMAL', 'LATE', 'SUPER_LATE']).optional().nullable(),
  surface: z.enum(['TURF', 'DIRT', 'BOTH']).optional().nullable(),
  distanceMin: z.number().int().optional().nullable(),
  distanceMax: z.number().int().optional().nullable(),
  temperament: z.enum(['FIERCE', 'ROUGH', 'NORMAL', 'MILD', 'SUPER_MILD']).optional().nullable(),
  runningStyles: z.array(z.enum(['GREAT_ESCAPE', 'ESCAPE', 'LEADER', 'CLOSER', 'CHASER', 'VERSATILE'])).optional().default([]),
  // 成績
  starts: z.number().int().min(0).optional().nullable(),
  wins: z.number().int().min(0).optional().nullable(),
  g1Wins: z.number().int().min(0).optional().nullable(),
  // 能力値（グレード）
  speed: gradeEnum,         // スピード
  guts: gradeEnum,          // 勝負根性
  acceleration: gradeEnum,  // 瞬発力
  power: gradeEnum,         // パワー
  health: gradeEnum,        // 健康
  intelligence: gradeEnum,  // 賢さ
  spirit: gradeEnum,        // 精神力
  flexibility: gradeEnum,   // 柔軟性
  autoComment: z.string().optional().nullable(),
  aiComment: z.string().optional().nullable(),
  memo: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'RETIRED']).optional().default('ACTIVE'),
});

const racehorseUpdateSchema = racehorseCreateSchema.partial().extend({
  name: z.string().min(1),
  gender: z.enum(['MALE', 'FEMALE']),
});

// 全件取得
export const getAllRacehorses = async (req: Request, res: Response) => {
  try {
    const racehorses = await prisma.racehorse.findMany({
      include: {
        sire: true,
        dam: true,
      },
      orderBy: [
        { status: 'asc' },
        { birthYear: 'desc' },
      ],
    });
    res.json(racehorses);
  } catch (error) {
    console.error('Failed to fetch racehorses:', error);
    res.status(500).json({ error: 'Failed to fetch racehorses' });
  }
};

// 1件取得
export const getRacehorseById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const racehorse = await prisma.racehorse.findUnique({
      where: { id: Number(id) },
      include: {
        sire: true,
        dam: true,
      },
    });

    if (!racehorse) {
      return res.status(404).json({ error: 'Racehorse not found' });
    }

    res.json(racehorse);
  } catch (error) {
    console.error('Failed to fetch racehorse:', error);
    res.status(500).json({ error: 'Failed to fetch racehorse' });
  }
};

// 作成
export const createRacehorse = async (req: Request, res: Response) => {
  try {
    const data = racehorseCreateSchema.parse(req.body);
    const racehorse = await prisma.racehorse.create({ data: data as any });
    res.status(201).json(racehorse);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Failed to create racehorse:', error);
    res.status(500).json({ error: 'Failed to create racehorse' });
  }
};

// 更新
export const updateRacehorse = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = racehorseUpdateSchema.parse(req.body);
    const racehorse = await prisma.racehorse.update({
      where: { id: Number(id) },
      data: data as any,
    });
    res.json(racehorse);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Failed to update racehorse:', error);
    res.status(500).json({ error: 'Failed to update racehorse' });
  }
};

// 削除
export const deleteRacehorse = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.racehorse.delete({
      where: { id: Number(id) },
    });
    res.status(204).send();
  } catch (error) {
    console.error('Failed to delete racehorse:', error);
    res.status(500).json({ error: 'Failed to delete racehorse' });
  }
};
