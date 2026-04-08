import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const SETTINGS_PATH = path.join(process.cwd(), 'settings.json');

interface AppSettings {
  ollamaUrl: string;
  ollamaModel: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
  ollamaModel: process.env.OLLAMA_MODEL || 'llama3',
};

export function loadSettings(): AppSettings {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const raw = fs.readFileSync(SETTINGS_PATH, 'utf-8');
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {
    // ファイルが壊れている場合はデフォルトを返す
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: AppSettings): void {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
}

export const getSettings = (_req: Request, res: Response) => {
  res.json(loadSettings());
};

export const updateSettings = (req: Request, res: Response) => {
  const { ollamaUrl, ollamaModel } = req.body as Partial<AppSettings>;

  if (!ollamaUrl || !ollamaModel) {
    res.status(400).json({ error: 'ollamaUrl と ollamaModel は必須です' });
    return;
  }

  const settings: AppSettings = { ollamaUrl, ollamaModel };
  saveSettings(settings);
  res.json(settings);
};
