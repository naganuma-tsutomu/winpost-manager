import { Request, Response } from 'express';
import fetch from 'node-fetch';

/**
 * 馬のパラメータを日本語化するマッピング等があれば使うためのヘルパー
 */
const surfaceMap: Record<string, string> = {
  TURF: '芝',
  DIRT: 'ダート',
  BOTH: '万能',
};

const growthTypeMap: Record<string, string> = {
  SUPER_EARLY: '超早熟',
  EARLY: '早熟',
  NORMAL: '普通',
  LATE: '晩成',
  SUPER_LATE: '超晩成',
};

const temperamentMap: Record<string, string> = {
  FIERCE: '激',
  ROUGH: '荒',
  NORMAL: '普通',
  MILD: '大人',
  SUPER_MILD: '超',
};

const runningStyleMap: Record<string, string> = {
  GREAT_ESCAPE: '大逃げ',
  ESCAPE: '逃げ',
  LEADER: '先行',
  CLOSER: '差し',
  CHASER: '追込',
  VERSATILE: '自在',
};

export const generateAdvice = async (req: Request, res: Response) => {
  try {
    const data = req.body;
    
    // 入力データからプロンプトを構築
    const horseDetails = `
性別: ${data.gender === 'MALE' ? '牡馬' : '牝馬'}
馬場適性: ${data.surface ? surfaceMap[data.surface] : '不明'}
距離適性: ${data.distanceMin ?? '?'}m ～ ${data.distanceMax ?? '?'}m
成長型: ${data.growthType ? growthTypeMap[data.growthType] : '不明'}
気性: ${data.temperament ? temperamentMap[data.temperament] : '普通'}
脚質: ${data.runningStyle ? runningStyleMap[data.runningStyle] : '不明'}
精神力: ${data.spirit || '不明'}
健康: ${data.health || '不明'}
`;

    const prompt = `
あなたは競馬シミュレーションゲーム（ウイニングポスト）の優秀な専属調教師・アドバイザーです。
以下の競走馬の適性パラメータに基づいて、最適な育成方針・出走ローテーション（狙うべきG1レースなど）を100文字〜200文字程度の簡潔な日本語で提案してください。

【競走馬の適性】
${horseDetails}

アドバイスの出力のみを行い、その他の挨拶やシステムメッセージは不要です。`;

    // Ollama APIの設定 (デフォルトはlocalhostの標準ポート)
    const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
    const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3'; // 利用環境に合わせて変更可能にする

    console.log(`Sending prompt to Ollama (${OLLAMA_URL}, model: ${OLLAMA_MODEL})...`);
    
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: prompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const resultText = await response.text();
    const result = JSON.parse(resultText) as { response: string };
    
    res.json({ advice: result.response.trim() });
  } catch (error) {
    console.error('Failed to generate AI advice:', error);
    res.status(500).json({ error: 'Failed to generate AI advice. Make sure Ollama is running.' });
  }
};
