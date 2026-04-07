/**
 * ウイニングポスト10 2025 配合計算ロジック
 *
 * 血統ツリー表現:
 *   position 文字列で先祖の位置を表現
 *   "F"  = 父
 *   "M"  = 母
 *   "FF" = 父の父 (祖父)
 *   "FM" = 父の母 (祖母)
 *   "MF" = 母の父
 *   "MM" = 母の母
 *   最大 5 代 (例: "FFFFF", "MMMMM")
 */

// ─────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────

/** 血統エントリ（種牡馬/繁殖牝馬の先祖情報） */
export interface AncestorEntry {
  ancestorId: number;
  ancestorName: string;
  position: string;   // "F", "FF", "MF" など
  generation: number; // 1=父/母, 2=祖父/祖母, ...
  /** 先祖が持つ因子タイプ配列 */
  factorTypes: string[];
  /** 先祖の子系統ID */
  childLineageId: number;
  /** 先祖の親系統ID */
  parentLineageId: number;
}

/** 配合計算に必要な種牡馬情報 */
export interface StallionInput {
  id: number;
  name: string;
  childLineageId: number;
  parentLineageId: number;
  factorTypes: string[];
  pedigree: AncestorEntry[]; // 登録済みの先祖一覧
}

/** 配合計算に必要な繁殖牝馬情報 */
export interface MareInput {
  id: number;
  name: string;
  lineage: string; // 系統名（文字列）
  factorTypes: string[];
  pedigree: AncestorEntry[];
}

/** ニックス相性テーブルのエントリ */
export interface NicksRelation {
  lineageAId: number;
  lineageBId: number;
  level: number; // 1〜3
}

/** 成立した配合理論 */
export interface BreedingTheory {
  type: BreedingTheoryType;
  label: string;      // 表示名
  detail: string;     // 詳細説明
  power: number;      // 爆発力への寄与値
  subPower: number;   // サブパラ爆発への寄与値
  risk: number;       // 危険度への寄与値（インブリードのみ）
  tags: string[];     // 例: ["ニックス", "シングル"]
}

export type BreedingTheoryType =
  | 'NICKS_SINGLE'
  | 'NICKS_DOUBLE'
  | 'NICKS_TRIPLE'
  | 'NICKS_FORCE'
  | 'INBREED'
  | 'MOTHER_INBREED'
  | 'BLOOD_ACTIVATION'
  | 'BLOOD_ACTIVATION_INBREED'
  | 'LINE_BREED_PARENT'
  | 'LINE_BREED_CHILD'
  | 'LINE_BREED_EXPLOSION'
  | 'VITALITY_FAMOUS_SIRE'
  | 'VITALITY_FAMOUS_MARE'
  | 'VITALITY_DIFFERENT_LINE'
  | 'VITALITY_COMPLETE'
  | 'ATAVISM'
  | 'DAM_SIRE_BONUS'
  | 'MAIL_LINE_ACTIVATION';

/** 計算結果全体 */
export interface BreedingResult {
  theories: BreedingTheory[];
  totalPower: number;
  subPower: number;
  totalRisk: number;
  rank: BreedingRank;
  summary: string;
}

export type BreedingRank = 'S+' | 'S' | 'A' | 'B' | 'C' | 'D';

// ─────────────────────────────────────────
// ユーティリティ関数
// ─────────────────────────────────────────

/** 父系祖先のposition一覧 (Fから始まる) */
function getSireSidePositions(gen: number): string[] {
  return buildPositions('F', gen);
}

/** 母系祖先のposition一覧 (Mから始まる) */
function getDamSidePositions(gen: number): string[] {
  return buildPositions('M', gen);
}

function buildPositions(side: 'F' | 'M', gen: number): string[] {
  if (gen === 1) return [side];
  const results: string[] = [];
  const recurse = (current: string, depth: number) => {
    if (depth === gen) {
      results.push(current);
      return;
    }
    recurse(current + 'F', depth + 1);
    recurse(current + 'M', depth + 1);
  };
  recurse(side, 1);
  return results;
}

/** 指定世代(3代前)の先祖position一覧 (8頭分) */
function getGen3Positions(): string[] {
  return [
    'FFF', 'FFM', 'FMF', 'FMM',
    'MFF', 'MFM', 'MMF', 'MMM',
  ];
}

/** AncestorEntry から IDのSetを作成 */
function buildAncestorSet(pedigree: AncestorEntry[]): Map<number, AncestorEntry[]> {
  const map = new Map<number, AncestorEntry[]>();
  for (const e of pedigree) {
    const existing = map.get(e.ancestorId);
    if (existing) {
      existing.push(e);
    } else {
      map.set(e.ancestorId, [e]);
    }
  }
  return map;
}

// ─────────────────────────────────────────
// 1. ニックス判定
// ─────────────────────────────────────────

/**
 * ニックス判定: 父の子系統と母方祖先（母父・母母父・母母母父）の相性をチェック
 */
export function calcNicks(
  stallion: StallionInput,
  marePedigree: AncestorEntry[],
  nicksTable: NicksRelation[],
): BreedingTheory[] {
  const theories: BreedingTheory[] = [];

  // ニックス確認対象: 母馬の父(F), 母馬の母父(MF), 母馬の母母父(MMF)
  const damPositions = ['F', 'MF', 'MMF'];
  const matched: { pos: string; entry: AncestorEntry; level: number }[] = [];

  for (const pos of damPositions) {
    const ancestor = marePedigree.find(e => e.position === pos);
    if (!ancestor) continue;

    const rel = nicksTable.find(
      r =>
        (r.lineageAId === stallion.childLineageId && r.lineageBId === ancestor.childLineageId) ||
        (r.lineageBId === stallion.childLineageId && r.lineageAId === ancestor.childLineageId),
    );
    if (rel) {
      matched.push({ pos, entry: ancestor, level: rel.level });
    }
  }

  if (matched.length === 0) return [];

  // 何本成立したかでシングル〜フォースを決定
  const nicksTypes: BreedingTheoryType[] = ['NICKS_SINGLE', 'NICKS_DOUBLE', 'NICKS_TRIPLE', 'NICKS_FORCE'];
  const nicksLabels = ['シングルニックス', 'ダブルニックス', 'トリプルニックス', 'フォースニックス'];
  const count = Math.min(matched.length, 4);

  const basePower = matched.reduce((sum, m) => sum + m.level * 2, 0);
  const famousSireCount = matched.filter(m => m.entry.factorTypes.includes('FAMOUS_SIRE') || m.entry.factorTypes.includes('GREAT_SIRE')).length;
  const subBonus = famousSireCount * 3;

  const posLabel = matched.map(m => {
    const posMap: Record<string, string> = { 'MF': '母父', 'MMF': '母母父', 'MMMF': '母母母父' };
    return `${posMap[m.pos] || m.pos}(${m.entry.ancestorName})`;
  }).join(', ');

  theories.push({
    type: nicksTypes[count - 1],
    label: nicksLabels[count - 1],
    detail: `父【${stallion.name}】と${posLabel}の系統相性◎`,
    power: basePower + (count - 1) * 3,
    subPower: subBonus,
    risk: 0,
    tags: ['ニックス', nicksLabels[count - 1]],
  });

  return theories;
}

// ─────────────────────────────────────────
// 2. インブリード判定
// ─────────────────────────────────────────

export interface InbreedResult {
  ancestorId: number;
  ancestorName: string;
  sirePositions: string[];
  damPositions: string[];
  totalCross: number; // クロス数
}

/**
 * インブリード判定: 父系・母系の4代以内に共通先祖がいるか検出
 */
export function calcInbreed(
  stallionPedigree: AncestorEntry[],
  marePedigree: AncestorEntry[],
): { theories: BreedingTheory[]; inbreeds: InbreedResult[] } {
  const theories: BreedingTheory[] = [];
  const inbreeds: InbreedResult[] = [];

  const sireMap = buildAncestorSet(stallionPedigree.filter(e => e.generation <= 4));
  const damMap = buildAncestorSet(marePedigree.filter(e => e.generation <= 4));

  for (const [ancestorId, sireEntries] of sireMap) {
    if (!damMap.has(ancestorId)) continue;
    const damEntries = damMap.get(ancestorId);
    if (!damEntries) continue;

    const result: InbreedResult = {
      ancestorId,
      ancestorName: sireEntries[0].ancestorName,
      sirePositions: sireEntries.map(e => e.position),
      damPositions: damEntries.map(e => e.position),
      totalCross: sireEntries.length + damEntries.length,
    };
    inbreeds.push(result);

    const hasSpeedFactor = sireEntries[0].factorTypes.includes('SPEED');
    const basePower = hasSpeedFactor ? 5 : 3;
    const riskVal = result.totalCross * 2; // クロスが多いほど危険

    theories.push({
      type: 'INBREED',
      label: `インブリード (${sireEntries[0].ancestorName})`,
      detail: `父系: ${result.sirePositions.join(',')} / 母系: ${result.damPositions.join(',')}`,
      power: basePower,
      subPower: hasSpeedFactor ? 2 : 0,
      risk: riskVal,
      tags: ['インブリード', sireEntries[0].ancestorName],
    });
  }

  return { theories, inbreeds };
}

// ─────────────────────────────────────────
// 3. 血脈活性化配合
// ─────────────────────────────────────────

/**
 * 血脈活性化: 産駒の3代前(8頭)の親系統が6種類以上で成立
 * 8種類以上で大
 */
export function calcBloodActivation(
  stallionPedigree: AncestorEntry[],
  marePedigree: AncestorEntry[],
  hasInbreed: boolean,
): BreedingTheory[] {
  const gen3Positions = getGen3Positions();

  // 3代前先祖のparentLineageIdを収集 (父側4頭 + 母側4頭)
  const sireGen2 = stallionPedigree.filter(e => e.generation === 2);
  const damGen2 = marePedigree.filter(e => e.generation === 2);

  // position "FF","FM","MF","MM" → 産駒視点での "FFF","FFM","FMF","FMM","MFF","MFM","MMF","MMM"
  const gen3Ancestors: AncestorEntry[] = [];

  const sireMap: Record<string, AncestorEntry> = {};
  for (const e of sireGen2) sireMap[e.position] = e;
  const damMap: Record<string, AncestorEntry> = {};
  for (const e of damGen2) damMap[e.position] = e;

  // 産駒視点: 父の2代前 = 産駒の3代前
  for (const [pos, entry] of Object.entries(sireMap)) {
    gen3Ancestors.push({ ...entry, position: 'F' + pos });
  }
  for (const [pos, entry] of Object.entries(damMap)) {
    gen3Ancestors.push({ ...entry, position: 'M' + pos });
  }

  const parentLineageIds = new Set(gen3Ancestors.map(e => e.parentLineageId).filter(Boolean));
  const uniqueCount = parentLineageIds.size;

  if (uniqueCount < 6) return [];

  const isExplosion = uniqueCount >= 8;
  const power = isExplosion ? 10 : 6;

  const theory: BreedingTheory = {
    type: hasInbreed ? 'BLOOD_ACTIVATION_INBREED' : 'BLOOD_ACTIVATION',
    label: `血脈活性化配合${isExplosion ? '（爆発型）' : ''}`,
    detail: `3代前の先祖の親系統が${uniqueCount}種類（6種類以上で成立）`,
    power,
    subPower: 2,
    risk: hasInbreed ? -3 : 0, // インブリードとの複合でリスク軽減
    tags: ['血脈活性化', ...(isExplosion ? ['爆発型'] : []), ...(hasInbreed ? ['インブリード軽減'] : [])],
  };

  return [theory];
}

// ─────────────────────────────────────────
// 4. ラインブリード
// ─────────────────────────────────────────

/**
 * ラインブリード: 父と母が同じ親系統(子系統が違う)または同じ子系統
 */
export function calcLineBreed(
  stallion: StallionInput,
  stallionPedigree: AncestorEntry[],
  marePedigree: AncestorEntry[],
): BreedingTheory[] {
  const theories: BreedingTheory[] = [];

  // 産駒3代前の親系統一覧
  const sireGen2 = stallionPedigree.filter(e => e.generation === 2);
  const damGen2 = marePedigree.filter(e => e.generation === 2);
  const allGen3 = [...sireGen2, ...damGen2];

  // 親系統ラインブリード: 3代前8頭のうち同じ親系統が3頭以上 (子系統は異なる)
  const parentLineageCounts = new Map<number, { ids: Set<number>; count: number }>();
  for (const e of allGen3) {
    if (e.parentLineageId === 0) continue; // 親系統未設定はスキップ
    if (!parentLineageCounts.has(e.parentLineageId)) {
      parentLineageCounts.set(e.parentLineageId, { ids: new Set(), count: 0 });
    }
    const entry = parentLineageCounts.get(e.parentLineageId);
    if (!entry) continue;
    entry.ids.add(e.childLineageId);
    entry.count++;
  }

  for (const [parentId, data] of parentLineageCounts) {
    if (data.count >= 3 && data.ids.size >= 2) {
      // 爆発型: 3頭以上で子系統が異なる
      theories.push({
        type: 'LINE_BREED_EXPLOSION',
        label: 'ラインブリード爆発型',
        detail: `3代前に同じ親系統の先祖が${data.count}頭（子系統は${data.ids.size}種類）`,
        power: 8,
        subPower: 3,
        risk: 2,
        tags: ['ラインブリード', '爆発型'],
      });
      break;
    } else if (data.count >= 2 && data.ids.size >= 2) {
      theories.push({
        type: 'LINE_BREED_PARENT',
        label: '親系統ラインブリード',
        detail: `3代前に同じ親系統の先祖が${data.count}頭（子系統は異なる）`,
        power: 4,
        subPower: 1,
        risk: 1,
        tags: ['ラインブリード', '親系統'],
      });
      break;
    }
  }

  // 子系統ラインブリード: 父と母が同じ子系統
  const sireChildLineageId = stallion.childLineageId;
  const damParentGen1 = marePedigree.find(e => e.position === 'F'); // 母馬の父（母父）
  if (damParentGen1 && damParentGen1.childLineageId === sireChildLineageId) {
    theories.push({
      type: 'LINE_BREED_CHILD',
      label: '子系統ラインブリード',
      detail: `父【${stallion.name}】と母父【${damParentGen1.ancestorName}】が同じ子系統`,
      power: 3,
      subPower: 1,
      risk: 1,
      tags: ['ラインブリード', '子系統'],
    });
  }

  return theories;
}

// ─────────────────────────────────────────
// 5. 活力補完
// ─────────────────────────────────────────

/**
 * 活力補完: 3代前8頭が「名種牡馬」「名牝」「異系血脈」の条件を満たす割合で判定
 */
export function calcVitalityComplement(
  stallionPedigree: AncestorEntry[],
  marePedigree: AncestorEntry[],
): BreedingTheory[] {
  const theories: BreedingTheory[] = [];
  const sireGen2 = stallionPedigree.filter(e => e.generation === 2);
  const damGen2 = marePedigree.filter(e => e.generation === 2);
  const allGen3 = [...sireGen2, ...damGen2];

  if (allGen3.length === 0) return [];

  let famousSireCount = 0;
  let famousMareCount = 0;
  let differentLineCount = 0;
  let completedCount = 0;

  for (const e of allGen3) {
    const hasFamousSire = e.factorTypes.includes('FAMOUS_SIRE') || e.factorTypes.includes('GREAT_SIRE');
    // 簡易判定: 名牝 = FAMOUSでない & SP因子保有
    const hasFamousMare = !hasFamousSire && e.factorTypes.includes('SPEED');
    // 異系血脈 = 珍しい系統
    const isDifferentLine = !hasFamousSire && !hasFamousMare;

    if (hasFamousSire) famousSireCount++;
    else if (hasFamousMare) famousMareCount++;
    else if (isDifferentLine) differentLineCount++;

    if (hasFamousSire || hasFamousMare || isDifferentLine) completedCount++;
  }

  // 完全型: 3代前8頭すべてが存在する（各カテゴリは問わない）
  if (completedCount === 8) {
    theories.push({
      type: 'VITALITY_COMPLETE',
      label: '完全型活力補完',
      detail: '3代前8頭すべてが活力補完の条件を満たす',
      power: 12,
      subPower: 5,
      risk: 0,
      tags: ['活力補完', '完全型'],
    });
  } else {
    if (famousSireCount >= 2) {
      theories.push({
        type: 'VITALITY_FAMOUS_SIRE',
        label: '名種牡馬型活力補完',
        detail: `3代前に名種牡馬因子持ちが${famousSireCount}頭`,
        power: famousSireCount * 2,
        subPower: 2,
        risk: 0,
        tags: ['活力補完', '名種牡馬型'],
      });
    }
    if (famousMareCount >= 2) {
      theories.push({
        type: 'VITALITY_FAMOUS_MARE',
        label: '名牝型活力補完',
        detail: `3代前に名牝系が${famousMareCount}頭`,
        power: famousMareCount * 1,
        subPower: famousMareCount,
        risk: 0,
        tags: ['活力補完', '名牝型'],
      });
    }
    if (differentLineCount >= 2) {
      theories.push({
        type: 'VITALITY_DIFFERENT_LINE',
        label: '異系血脈型活力補完',
        detail: `3代前に異系血脈の先祖が${differentLineCount}頭`,
        power: differentLineCount,
        subPower: 1,
        risk: 0,
        tags: ['活力補完', '異系血脈型'],
      });
    }
  }

  return theories;
}

// ─────────────────────────────────────────
// 6. 隔世遺伝
// ─────────────────────────────────────────

/**
 * 隔世遺伝: 父と母が因子を持たず、祖父（父父 or 母父優先）が因子を持つ場合
 */
export function calcAtavism(
  stallion: StallionInput,
  stallionPedigree: AncestorEntry[],
  mare: MareInput,
  marePedigree: AncestorEntry[],
): BreedingTheory[] {
  const theories: BreedingTheory[] = [];

  // 父自身が因子なし & 父の父が因子あり
  if (stallion.factorTypes.length === 0) {
    const sireGrandfather = stallionPedigree.find(e => e.position === 'FF');
    if (sireGrandfather && sireGrandfather.factorTypes.length > 0) {
      theories.push({
        type: 'ATAVISM',
        label: `隔世遺伝（${sireGrandfather.ancestorName}）`,
        detail: `父【${stallion.name}】は因子なし → 父父【${sireGrandfather.ancestorName}】の因子が遺伝`,
        power: 4,
        subPower: 2,
        risk: 0,
        tags: ['隔世遺伝'],
      });
    }
  }

  // 母自身が因子なし & 母の父が因子あり
  if (mare.factorTypes.length === 0) {
    const damGrandfather = marePedigree.find(e => e.position === 'F');
    if (damGrandfather && damGrandfather.factorTypes.length > 0) {
      theories.push({
        type: 'ATAVISM',
        label: `隔世遺伝（${damGrandfather.ancestorName}）`,
        detail: `母【${mare.name}】は因子なし → 母父【${damGrandfather.ancestorName}】の因子が遺伝`,
        power: 4,
        subPower: 2,
        risk: 0,
        tags: ['隔世遺伝'],
      });
    }
  }

  return theories;
}

// ─────────────────────────────────────────
// 7. 母父○
// ─────────────────────────────────────────

export function calcDamSireBonus(marePedigree: AncestorEntry[]): BreedingTheory[] {
  const damSire = marePedigree.find(e => e.position === 'F');
  if (!damSire) return [];

  const hasFamousFactor = damSire.factorTypes.some(f =>
    f === 'FAMOUS_SIRE' || f === 'GREAT_SIRE' || f === 'SPEED' || f === 'STAMINA',
  );
  if (!hasFamousFactor) return [];

  return [{
    type: 'DAM_SIRE_BONUS',
    label: `母父○（${damSire.ancestorName}）`,
    detail: `母父【${damSire.ancestorName}】が有効な因子を保有`,
    power: 3,
    subPower: 1,
    risk: 0,
    tags: ['母父○'],
  }];
}

// ─────────────────────────────────────────
// メイン計算関数
// ─────────────────────────────────────────

/**
 * 配合理論を総合計算して結果を返す
 */
export function calculateBreeding(
  stallion: StallionInput,
  mare: MareInput,
  nicksTable: NicksRelation[],
): BreedingResult {
  const theories: BreedingTheory[] = [];

  // 1. ニックス
  theories.push(...calcNicks(stallion, mare.pedigree, nicksTable));

  // 2. インブリード
  const { theories: inbreedTheories, inbreeds } = calcInbreed(stallion.pedigree, mare.pedigree);
  theories.push(...inbreedTheories);

  // 3. 血脈活性化
  theories.push(...calcBloodActivation(stallion.pedigree, mare.pedigree, inbreeds.length > 0));

  // 4. ラインブリード
  theories.push(...calcLineBreed(stallion, stallion.pedigree, mare.pedigree));

  // 5. 活力補完
  theories.push(...calcVitalityComplement(stallion.pedigree, mare.pedigree));

  // 6. 隔世遺伝
  theories.push(...calcAtavism(stallion, stallion.pedigree, mare, mare.pedigree));

  // 7. 母父○
  theories.push(...calcDamSireBonus(mare.pedigree));

  // 集計
  const totalPower = theories.reduce((s, t) => s + t.power, 0);
  const subPower = theories.reduce((s, t) => s + t.subPower, 0);
  const totalRisk = theories.reduce((s, t) => s + t.risk, 0);

  let rank: BreedingRank;
  if (totalPower >= 30) rank = 'S+';
  else if (totalPower >= 20) rank = 'S';
  else if (totalPower >= 14) rank = 'A';
  else if (totalPower >= 8) rank = 'B';
  else if (totalPower >= 4) rank = 'C';
  else rank = 'D';

  const summary =
    theories.length === 0
      ? '特に配合理論は成立していません。'
      : `${theories.length}個の配合理論が成立。爆発力 ${totalPower}pt / リスク ${totalRisk}pt`;

  return { theories, totalPower, subPower, totalRisk, rank, summary };
}
