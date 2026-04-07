import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 シードデータの投入を開始...');

  // 親系統
  const parentLineages = [
    'ナスルーラ系',
    'ノーザンダンサー系',
    'ミスタープロスペクター系',
    'ロイヤルチャージャー系',
    'ネイティヴダンサー系',
    'サンデーサイレンス系',
    'トゥルビヨン系',
    'エクリプス系',
    'セントサイモン系',
    'マンノウォー系',
    'ヘロド系',
    'ハンプトン系',
    'ヒムヤー系',
  ];

  const createdParents: Record<string, any> = {};
  for (const name of parentLineages) {
    createdParents[name] = await prisma.parentLineage.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // 子系統（主要なもの）
  const childLineages: { name: string; parent: string }[] = [
    // ノーザンダンサー系
    { name: 'サドラーズウェルズ系', parent: 'ノーザンダンサー系' },
    { name: 'ダンチヒ系', parent: 'ノーザンダンサー系' },
    { name: 'ストームキャット系', parent: 'ノーザンダンサー系' },
    { name: 'ノーザンテースト系', parent: 'ノーザンダンサー系' },
    { name: 'リファール系', parent: 'ノーザンダンサー系' },
    { name: 'ニジンスキー系', parent: 'ノーザンダンサー系' },
    // ミスタープロスペクター系
    { name: 'キングマンボ系', parent: 'ミスタープロスペクター系' },
    { name: 'フォーティナイナー系', parent: 'ミスタープロスペクター系' },
    { name: 'ゴーンウエスト系', parent: 'ミスタープロスペクター系' },
    { name: 'アフリート系', parent: 'ミスタープロスペクター系' },
    // サンデーサイレンス系
    { name: 'ディープインパクト系', parent: 'サンデーサイレンス系' },
    { name: 'ステイゴールド系', parent: 'サンデーサイレンス系' },
    { name: 'ハーツクライ系', parent: 'サンデーサイレンス系' },
    { name: 'ダイワメジャー系', parent: 'サンデーサイレンス系' },
    { name: 'マンハッタンカフェ系', parent: 'サンデーサイレンス系' },
    // ナスルーラ系
    { name: 'ボールドルーラー系', parent: 'ナスルーラ系' },
    { name: 'グレイソヴリン系', parent: 'ナスルーラ系' },
    { name: 'ネヴァーベンド系', parent: 'ナスルーラ系' },
    // ロイヤルチャージャー系
    { name: 'ヘイルトゥリーズン系', parent: 'ロイヤルチャージャー系' },
    { name: 'ターントゥ系', parent: 'ロイヤルチャージャー系' },
    // ネイティヴダンサー系
    { name: 'レイズアネイティヴ系', parent: 'ネイティヴダンサー系' },
  ];

  for (const { name, parent } of childLineages) {
    await prisma.childLineage.upsert({
      where: { name },
      update: {},
      create: {
        name,
        parentLineageId: createdParents[parent].id,
      },
    });
  }

  console.log(`✅ 親系統 ${parentLineages.length} 件、子系統 ${childLineages.length} 件を投入しました`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
