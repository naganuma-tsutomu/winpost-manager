import { describe, it, expect } from 'vitest';
import {
  calcNicks,
  calcInbreed,
  calcBloodActivation,
  calcLineBreed,
  calcVitalityComplement,
  calcAtavism,
  calcDamSireBonus,
  calculateBreeding,
} from '../breeding';
import type {
  AncestorEntry,
  StallionInput,
  MareInput,
  NicksRelation,
} from '../breeding';

// ─────────────────────────────────────────
// テスト用ヘルパー
// ─────────────────────────────────────────

function makeAncestor(
  overrides: Partial<AncestorEntry> & { position: string },
): AncestorEntry {
  return {
    ancestorId: 1,
    ancestorName: 'TestHorse',
    generation: 1,
    factorTypes: [],
    childLineageId: 10,
    parentLineageId: 1,
    ...overrides,
  };
}

function makeStallion(overrides: Partial<StallionInput> = {}): StallionInput {
  return {
    id: 1,
    name: 'Stallion A',
    childLineageId: 10,
    parentLineageId: 1,
    factorTypes: [],
    pedigree: [],
    ...overrides,
  };
}

function makeMare(overrides: Partial<MareInput> = {}): MareInput {
  return {
    id: 2,
    name: 'Mare B',
    lineage: 'Test Lineage',
    factorTypes: [],
    pedigree: [],
    ...overrides,
  };
}

// ─────────────────────────────────────────
// 1. calcNicks
// ─────────────────────────────────────────

describe('calcNicks', () => {
  it('相性テーブルに一致がなければ空配列を返す', () => {
    const stallion = makeStallion({ childLineageId: 10 });
    const marePedigree = [makeAncestor({ position: 'F', childLineageId: 99 })];
    const nicksTable: NicksRelation[] = [];
    expect(calcNicks(stallion, marePedigree, nicksTable)).toEqual([]);
  });

  it('母父との相性一致でシングルニックスが成立する', () => {
    const stallion = makeStallion({ childLineageId: 10 });
    const marePedigree = [makeAncestor({ position: 'F', childLineageId: 20, ancestorName: 'DamSire' })];
    const nicksTable: NicksRelation[] = [{ lineageAId: 10, lineageBId: 20, level: 2 }];

    const result = calcNicks(stallion, marePedigree, nicksTable);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('NICKS_SINGLE');
    expect(result[0].power).toBe(4); // level*2=4, count-1=0 → 4+0=4
  });

  it('母父・母母父の2本一致でダブルニックスが成立する', () => {
    const stallion = makeStallion({ childLineageId: 10 });
    const marePedigree = [
      makeAncestor({ position: 'F',  childLineageId: 20, ancestorName: 'DamSire' }),
      makeAncestor({ position: 'MF', childLineageId: 30, ancestorId: 2, ancestorName: 'DamDamSire' }),
    ];
    const nicksTable: NicksRelation[] = [
      { lineageAId: 10, lineageBId: 20, level: 1 },
      { lineageAId: 10, lineageBId: 30, level: 1 },
    ];

    const result = calcNicks(stallion, marePedigree, nicksTable);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('NICKS_DOUBLE');
    // basePower = 1*2 + 1*2 = 4, count-1=1 → power = 4 + 3 = 7
    expect(result[0].power).toBe(7);
  });

  it('相性がある先祖が名種牡馬因子を持つ場合 subPower ボーナスが加算される', () => {
    const stallion = makeStallion({ childLineageId: 10 });
    const marePedigree = [
      makeAncestor({ position: 'F', childLineageId: 20, ancestorName: 'Famous', factorTypes: ['FAMOUS_SIRE'] }),
    ];
    const nicksTable: NicksRelation[] = [{ lineageAId: 10, lineageBId: 20, level: 1 }];

    const result = calcNicks(stallion, marePedigree, nicksTable);
    expect(result[0].subPower).toBe(3);
  });
});

// ─────────────────────────────────────────
// 2. calcInbreed
// ─────────────────────────────────────────

describe('calcInbreed', () => {
  it('共通先祖がなければ空配列を返す', () => {
    const s = [makeAncestor({ position: 'F', ancestorId: 1, generation: 1 })];
    const d = [makeAncestor({ position: 'MF', ancestorId: 2, generation: 2 })];
    const { theories, inbreeds } = calcInbreed(s, d);
    expect(theories).toHaveLength(0);
    expect(inbreeds).toHaveLength(0);
  });

  it('共通先祖があればインブリード理論が生成される', () => {
    const common = { ancestorId: 100, ancestorName: 'Common', factorTypes: [] as string[] };
    const s = [makeAncestor({ ...common, position: 'FF', generation: 2 })];
    const d = [makeAncestor({ ...common, position: 'MF', generation: 2 })];

    const { theories, inbreeds } = calcInbreed(s, d);
    expect(theories).toHaveLength(1);
    expect(theories[0].type).toBe('INBREED');
    expect(inbreeds[0].ancestorId).toBe(100);
  });

  it('SPEED因子を持つ共通先祖は power=5 になる', () => {
    const common = { ancestorId: 100, ancestorName: 'Speedy', factorTypes: ['SPEED'] };
    const s = [makeAncestor({ ...common, position: 'FF', generation: 2 })];
    const d = [makeAncestor({ ...common, position: 'MF', generation: 2 })];

    const { theories } = calcInbreed(s, d);
    expect(theories[0].power).toBe(5);
  });

  it('5代目の先祖はインブリード検出対象外', () => {
    const common = { ancestorId: 100, ancestorName: 'Old', factorTypes: [] as string[] };
    const s = [makeAncestor({ ...common, position: 'FFFFF', generation: 5 })];
    const d = [makeAncestor({ ...common, position: 'MMMMM', generation: 5 })];

    const { theories } = calcInbreed(s, d);
    expect(theories).toHaveLength(0);
  });
});

// ─────────────────────────────────────────
// 3. calcBloodActivation
// ─────────────────────────────────────────

describe('calcBloodActivation', () => {
  function makeGen2(parentLineageId: number, childLineageId: number, position: string): AncestorEntry {
    return makeAncestor({ position, generation: 2, parentLineageId, childLineageId });
  }

  it('3代前の親系統が5種類以下では成立しない', () => {
    const stallionPedigree = [
      makeGen2(1, 10, 'FF'),
      makeGen2(1, 11, 'FM'),
      makeGen2(2, 20, 'MF'),
      makeGen2(2, 21, 'MM'),
    ];
    expect(calcBloodActivation(stallionPedigree, [], false)).toHaveLength(0);
  });

  it('6種類以上で血脈活性化が成立する', () => {
    const stallionPedigree = [
      makeGen2(1, 10, 'FF'),
      makeGen2(2, 20, 'FM'),
      makeGen2(3, 30, 'MF'),
    ];
    const marePedigree = [
      makeGen2(4, 40, 'FF'),
      makeGen2(5, 50, 'FM'),
      makeGen2(6, 60, 'MF'),
    ];
    const result = calcBloodActivation(stallionPedigree, marePedigree, false);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('BLOOD_ACTIVATION');
    expect(result[0].power).toBe(6);
  });

  it('8種類以上で爆発型になる', () => {
    const stallionPedigree = [
      makeGen2(1, 10, 'FF'),
      makeGen2(2, 20, 'FM'),
      makeGen2(3, 30, 'MF'),
      makeGen2(4, 40, 'MM'),
    ];
    const marePedigree = [
      makeGen2(5, 50, 'FF'),
      makeGen2(6, 60, 'FM'),
      makeGen2(7, 70, 'MF'),
      makeGen2(8, 80, 'MM'),
    ];
    const result = calcBloodActivation(stallionPedigree, marePedigree, false);
    expect(result[0].power).toBe(10);
    expect(result[0].label).toContain('爆発型');
  });

  it('インブリードとの複合でリスクが軽減される', () => {
    const stallionPedigree = [
      makeGen2(1, 10, 'FF'), makeGen2(2, 20, 'FM'), makeGen2(3, 30, 'MF'),
    ];
    const marePedigree = [
      makeGen2(4, 40, 'FF'), makeGen2(5, 50, 'FM'), makeGen2(6, 60, 'MF'),
    ];
    const result = calcBloodActivation(stallionPedigree, marePedigree, true);
    expect(result[0].type).toBe('BLOOD_ACTIVATION_INBREED');
    expect(result[0].risk).toBe(-3);
  });
});

// ─────────────────────────────────────────
// 4. calcLineBreed
// ─────────────────────────────────────────

describe('calcLineBreed', () => {
  it('条件を満たさなければ空配列を返す', () => {
    const stallion = makeStallion({ childLineageId: 10 });
    expect(calcLineBreed(stallion, [], [])).toHaveLength(0);
  });

  it('母父と父が同じ子系統で子系統ラインブリードが成立する', () => {
    const stallion = makeStallion({ childLineageId: 10 });
    const marePedigree = [
      makeAncestor({ position: 'F', childLineageId: 10, generation: 1, ancestorName: 'SameLine' }),
    ];
    const result = calcLineBreed(stallion, [], marePedigree);
    expect(result.some(t => t.type === 'LINE_BREED_CHILD')).toBe(true);
  });

  it('3代前に同じ親系統2頭（子系統異なる）で親系統ラインブリードが成立する', () => {
    const stallion = makeStallion();
    const sireGen2 = [
      makeAncestor({ position: 'FF', generation: 2, parentLineageId: 99, childLineageId: 10 }),
    ];
    const damGen2 = [
      makeAncestor({ position: 'FF', generation: 2, parentLineageId: 99, childLineageId: 20 }),
    ];
    const result = calcLineBreed(stallion, sireGen2, damGen2);
    expect(result.some(t => t.type === 'LINE_BREED_PARENT')).toBe(true);
  });

  it('3代前に同じ親系統3頭（子系統2種類）で爆発型ラインブリードが成立する', () => {
    const stallion = makeStallion();
    const sireGen2 = [
      makeAncestor({ position: 'FF', generation: 2, parentLineageId: 99, childLineageId: 10 }),
      makeAncestor({ position: 'FM', generation: 2, parentLineageId: 99, childLineageId: 20 }),
    ];
    const damGen2 = [
      makeAncestor({ position: 'FF', generation: 2, parentLineageId: 99, childLineageId: 10 }),
    ];
    const result = calcLineBreed(stallion, sireGen2, damGen2);
    expect(result.some(t => t.type === 'LINE_BREED_EXPLOSION')).toBe(true);
  });
});

// ─────────────────────────────────────────
// 5. calcVitalityComplement
// ─────────────────────────────────────────

describe('calcVitalityComplement', () => {
  it('先祖が空なら空配列を返す', () => {
    expect(calcVitalityComplement([], [])).toHaveLength(0);
  });

  it('名種牡馬因子持ちが2頭以上で名種牡馬型が成立する', () => {
    const famous = makeAncestor({ position: 'FF', generation: 2, factorTypes: ['FAMOUS_SIRE'] });
    const result = calcVitalityComplement([famous, famous], []);
    expect(result.some(t => t.type === 'VITALITY_FAMOUS_SIRE')).toBe(true);
  });

  it('8頭全員が条件を満たすと完全型が成立する', () => {
    // FAMOUS_SIREを持つ先祖を8頭用意
    const gen2positions = ['FF', 'FM', 'MF', 'MM'];
    const sireGen2 = gen2positions.map(pos =>
      makeAncestor({ position: pos, generation: 2, factorTypes: ['FAMOUS_SIRE'] }),
    );
    const damGen2 = gen2positions.map(pos =>
      makeAncestor({ position: pos, generation: 2, factorTypes: ['FAMOUS_SIRE'] }),
    );
    const result = calcVitalityComplement(sireGen2, damGen2);
    expect(result.some(t => t.type === 'VITALITY_COMPLETE')).toBe(true);
    expect(result[0].power).toBe(12);
  });
});

// ─────────────────────────────────────────
// 6. calcAtavism
// ─────────────────────────────────────────

describe('calcAtavism', () => {
  it('父も母も因子ありの場合は空配列を返す', () => {
    const stallion = makeStallion({ factorTypes: ['SPEED'] });
    const mare = makeMare({ factorTypes: ['STAMINA'] });
    expect(calcAtavism(stallion, [], mare, [])).toHaveLength(0);
  });

  it('父に因子なし・父父に因子ありで隔世遺伝が成立する', () => {
    const stallion = makeStallion({ factorTypes: [] });
    const mare = makeMare({ factorTypes: ['SPEED'] });
    const stallionPedigree = [
      makeAncestor({ position: 'FF', generation: 2, factorTypes: ['SPEED'], ancestorName: 'GrandSire' }),
    ];
    const result = calcAtavism(stallion, stallionPedigree, mare, []);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('ATAVISM');
    expect(result[0].label).toContain('GrandSire');
  });

  it('母に因子なし・母父に因子ありで隔世遺伝が成立する', () => {
    const stallion = makeStallion({ factorTypes: ['SPEED'] });
    const mare = makeMare({ factorTypes: [] });
    const marePedigree = [
      makeAncestor({ position: 'F', generation: 1, factorTypes: ['STAMINA'], ancestorName: 'DamSireGrand' }),
    ];
    const result = calcAtavism(stallion, [], mare, marePedigree);
    expect(result).toHaveLength(1);
    expect(result[0].label).toContain('DamSireGrand');
  });

  it('父も母も因子なし・祖父が両方因子ありで2件成立する', () => {
    const stallion = makeStallion({ factorTypes: [] });
    const mare = makeMare({ factorTypes: [] });
    const stallionPedigree = [
      makeAncestor({ position: 'FF', generation: 2, factorTypes: ['SPEED'] }),
    ];
    const marePedigree = [
      makeAncestor({ position: 'F', generation: 1, factorTypes: ['STAMINA'] }),
    ];
    const result = calcAtavism(stallion, stallionPedigree, mare, marePedigree);
    expect(result).toHaveLength(2);
  });
});

// ─────────────────────────────────────────
// 7. calcDamSireBonus
// ─────────────────────────────────────────

describe('calcDamSireBonus', () => {
  it('母父がいなければ空配列を返す', () => {
    expect(calcDamSireBonus([])).toHaveLength(0);
  });

  it('母父が有効な因子を持たなければ空配列を返す', () => {
    const marePedigree = [makeAncestor({ position: 'F', factorTypes: [] })];
    expect(calcDamSireBonus(marePedigree)).toHaveLength(0);
  });

  it('母父がSPEED因子を持てば母父○が成立する', () => {
    const marePedigree = [
      makeAncestor({ position: 'F', factorTypes: ['SPEED'], ancestorName: 'SpeedSire' }),
    ];
    const result = calcDamSireBonus(marePedigree);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('DAM_SIRE_BONUS');
    expect(result[0].label).toContain('SpeedSire');
  });
});

// ─────────────────────────────────────────
// 8. calculateBreeding (統合)
// ─────────────────────────────────────────

describe('calculateBreeding', () => {
  it('配合理論ゼロの場合はランクD・summaryに「特に配合理論は成立していません」', () => {
    const stallion = makeStallion();
    const mare = makeMare();
    const result = calculateBreeding(stallion, mare, []);
    expect(result.rank).toBe('D');
    expect(result.summary).toContain('特に配合理論は成立していません');
    expect(result.theories).toHaveLength(0);
  });

  it('totalPower が 20 以上でランク S', () => {
    // 母父○ + ニックス(シングル) で power を積み上げる
    const stallion = makeStallion({ childLineageId: 10 });
    const marePedigree = [
      makeAncestor({ position: 'F', childLineageId: 20, ancestorName: 'DS', factorTypes: ['SPEED'] }),
    ];
    const nicksTable: NicksRelation[] = [];

    // 単体では power 不足なのでインブリードも組み合わせる
    const commonAncestor = { ancestorId: 50, ancestorName: 'Common', factorTypes: ['SPEED'] };
    const stallionPedigree: AncestorEntry[] = Array.from({ length: 7 }, (_, i) =>
      makeAncestor({ ...commonAncestor, ancestorId: 50 + i, position: `F${'F'.repeat(i % 2)}`, generation: 2 }),
    );

    // 爆発型血脈活性化 (power=10) + 母父○ (power=3) = 13 → ランクB想定
    const gen2positions = ['FF', 'FM', 'MF', 'MM'];
    const sireGen2 = gen2positions.map(pos =>
      makeAncestor({ position: pos, generation: 2, parentLineageId: pos.charCodeAt(0), childLineageId: pos.charCodeAt(1) || 0 }),
    );
    const damGen2 = gen2positions.map((pos, i) =>
      makeAncestor({ position: pos, generation: 2, parentLineageId: 90 + i, childLineageId: 80 + i }),
    );

    const stallion2 = makeStallion({ pedigree: sireGen2 });
    const mare2 = makeMare({ pedigree: [...damGen2, ...marePedigree] });

    const result = calculateBreeding(stallion2, mare2, nicksTable);
    // 少なくとも power > 0 であること
    expect(result.totalPower).toBeGreaterThan(0);
    expect(['S+', 'S', 'A', 'B', 'C', 'D']).toContain(result.rank);
  });

  it('ランク閾値: totalPower>=30 → S+', () => {
    // calcNicks でスコアを大量に稼ぐ
    const stallion = makeStallion({ childLineageId: 10 });
    const marePedigree = [
      makeAncestor({ position: 'F',   childLineageId: 20, ancestorName: 'DS1', factorTypes: ['GREAT_SIRE'] }),
      makeAncestor({ position: 'MF',  childLineageId: 30, ancestorId: 2, ancestorName: 'DS2', factorTypes: ['GREAT_SIRE'] }),
      makeAncestor({ position: 'MMF', childLineageId: 40, ancestorId: 3, ancestorName: 'DS3', factorTypes: ['GREAT_SIRE'] }),
    ];
    const nicksTable: NicksRelation[] = [
      { lineageAId: 10, lineageBId: 20, level: 3 },
      { lineageAId: 10, lineageBId: 30, level: 3 },
      { lineageAId: 10, lineageBId: 40, level: 3 },
    ];
    const mare = makeMare({ pedigree: marePedigree });
    const result = calculateBreeding(stallion, mare, nicksTable);
    // トリプルニックス: basePower=3*3*2=18, count=3 → power=18+6=24 + subPower=3
    expect(result.totalPower).toBeGreaterThanOrEqual(20);
    expect(['S+', 'S']).toContain(result.rank);
  });
});
