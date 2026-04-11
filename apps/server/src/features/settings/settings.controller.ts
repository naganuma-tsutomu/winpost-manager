import { Request, Response } from 'express';
import { prisma } from '@winpost/database';

const DEFAULT_OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

async function getOrCreateSetting() {
  const existing = await prisma.appSetting.findFirst();
  if (existing) return existing;
  return prisma.appSetting.create({
    data: {
      ollamaUrl: DEFAULT_OLLAMA_URL,
      ollamaModel: DEFAULT_OLLAMA_MODEL,
    },
  });
}

export async function loadSettings() {
  const setting = await getOrCreateSetting();
  return { ollamaUrl: setting.ollamaUrl, ollamaModel: setting.ollamaModel };
}

export const getSettings = async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await loadSettings();
    res.json(settings);
  } catch (error) {
    console.error('Failed to get settings:', error);
    res.status(500).json({ error: '設定の取得に失敗しました' });
  }
};

export const updateSettings = async (req: Request, res: Response): Promise<void> => {
  const { ollamaUrl, ollamaModel } = req.body as { ollamaUrl?: string; ollamaModel?: string };

  if (!ollamaUrl || !ollamaModel) {
    res.status(400).json({ error: 'ollamaUrl と ollamaModel は必須です' });
    return;
  }

  try {
    const existing = await prisma.appSetting.findFirst();
    const updated = existing
      ? await prisma.appSetting.update({ where: { id: existing.id }, data: { ollamaUrl, ollamaModel } })
      : await prisma.appSetting.create({ data: { ollamaUrl, ollamaModel } });

    res.json({ ollamaUrl: updated.ollamaUrl, ollamaModel: updated.ollamaModel });
  } catch (error) {
    console.error('Failed to update settings:', error);
    res.status(500).json({ error: '設定の保存に失敗しました' });
  }
};
