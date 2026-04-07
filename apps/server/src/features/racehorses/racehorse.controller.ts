import { Request, Response } from 'express';
import { PrismaClient, Surface, HorseStatus, GrowthType, Temperament, RunningStyle, EvalMark } from '@prisma/client';

const prisma = new PrismaClient();

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
    const data = req.body;
    const racehorse = await prisma.racehorse.create({
      data: {
        name: data.name,
        birthYear: data.birthYear,
        gender: data.gender,
        sireId: data.sireId || null,
        damId: data.damId || null,
        growthType: data.growthType || null,
        surface: data.surface || null,
        distanceMin: data.distanceMin || null,
        distanceMax: data.distanceMax || null,
        temperament: data.temperament || null,
        runningStyle: data.runningStyle || null,
        spirit: data.spirit || 'NONE',
        health: data.health || 'NONE',
        autoComment: data.autoComment || null,
        aiComment: data.aiComment || null,
        memo: data.memo || null,
        status: data.status || 'ACTIVE',
      },
    });
    res.status(201).json(racehorse);
  } catch (error) {
    console.error('Failed to create racehorse:', error);
    res.status(500).json({ error: 'Failed to create racehorse' });
  }
};

// 更新
export const updateRacehorse = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;
    
    const racehorse = await prisma.racehorse.update({
      where: { id: Number(id) },
      data: {
        name: data.name,
        birthYear: data.birthYear,
        gender: data.gender,
        sireId: data.sireId,
        damId: data.damId,
        growthType: data.growthType,
        surface: data.surface,
        distanceMin: data.distanceMin,
        distanceMax: data.distanceMax,
        temperament: data.temperament,
        runningStyle: data.runningStyle,
        spirit: data.spirit,
        health: data.health,
        autoComment: data.autoComment,
        aiComment: data.aiComment,
        memo: data.memo,
        status: data.status,
      },
    });
    res.json(racehorse);
  } catch (error) {
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
