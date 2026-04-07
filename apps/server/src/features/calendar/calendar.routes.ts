import { Router, Request, Response } from 'express';
import { prisma } from '@winpost/database';
import { z } from 'zod';

export const calendarRouter = Router();

const gameEventSchema = z.object({
  targetYear: z.number().int().optional().nullable(),
  targetMonth: z.number().int().min(1).max(12),
  targetWeek: z.number().int().min(1).max(4),
  title: z.string().min(1).max(100),
  description: z.string().optional().nullable(),
  isCompleted: z.boolean().optional().default(false),
});

// イベント一覧取得
calendarRouter.get('/events', async (_req: Request, res: Response): Promise<void> => {
  try {
    const events = await prisma.gameEvent.findMany({
      orderBy: [
        { targetYear: 'asc' },
        { targetMonth: 'asc' },
        { targetWeek: 'asc' },
        { createdAt: 'asc' }
      ],
    });
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: 'イベントの取得に失敗しました' });
  }
});

// イベント登録
calendarRouter.post('/events', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = gameEventSchema.parse(req.body);
    const event = await prisma.gameEvent.create({ data });
    res.status(201).json(event);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    res.status(500).json({ error: 'イベントの登録に失敗しました' });
  }
});

// イベント更新
calendarRouter.put('/events/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = gameEventSchema.parse(req.body);
    const event = await prisma.gameEvent.update({
      where: { id: Number(req.params.id) },
      data,
    });
    res.json(event);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    res.status(500).json({ error: 'イベントの更新に失敗しました' });
  }
});

// イベント削除
calendarRouter.delete('/events/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.gameEvent.delete({ where: { id: Number(req.params.id) } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'イベントの削除に失敗しました' });
  }
});
