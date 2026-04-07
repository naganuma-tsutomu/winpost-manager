/**
 * APIレスポンス型定義
 * サーバーのPrismaクエリ結果に対応する型
 */

import type { EvalMark, FactorType, FlagType, Gender, GrowthType, PlanStatus } from './constants';
import type { BreedingResult } from './breeding';

// ─────────────────────────────────────────
// 共通パーツ
// ─────────────────────────────────────────

export interface Factor {
  id: number;
  type: FactorType;
  stallionId: number | null;
  mareId: number | null;
}

export interface ParentLineage {
  id: number;
  name: string;
  createdAt: string;
}

export interface ParentLineageWithChildren extends ParentLineage {
  childLineages: ChildLineage[];
}

export interface ChildLineage {
  id: number;
  name: string;
  parentLineageId: number;
  createdAt: string;
}

export interface ChildLineageWithParent extends ChildLineage {
  parentLineage: ParentLineage;
}

// ─────────────────────────────────────────
// 種牡馬
// ─────────────────────────────────────────

export interface Stallion {
  id: number;
  name: string;
  childLineageId: number;
  childLineage: ChildLineageWithParent;
  speed: number | null;
  stamina: number | null;
  power: number | null;
  guts: number | null;
  wisdom: number | null;
  health: number | null;
  memo: string | null;
  factors: Factor[];
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────
// 繁殖牝馬
// ─────────────────────────────────────────

export interface Mare {
  id: number;
  name: string;
  lineage: string;
  speed: number | null;
  stamina: number | null;
  memo: string | null;
  factors: Factor[];
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────
// 幼駒
// ─────────────────────────────────────────

export interface FoalFlag {
  id: number;
  foalId: number;
  type: FlagType;
  description: string | null;
  targetDate: string | null;
}

export interface Foal {
  id: number;
  name: string | null;
  birthYear: number;
  gender: Gender;
  sireId: number | null;
  sire: { id: number; name: string } | null;
  damId: number | null;
  dam: { id: number; name: string } | null;
  kappaMark: EvalMark;
  mikaMark: EvalMark;
  bodyComment: string | null;
  growthType: GrowthType | null;
  estimatedSpeed: number | null;
  memo: string | null;
  flags: FoalFlag[];
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────
// 血統表
// ─────────────────────────────────────────

export interface PedigreeEntryRecord {
  id: number;
  horseType: string;
  horseId: number;
  ancestorId: number;
  ancestor: Stallion;
  generation: number;
  position: string;
}

// ─────────────────────────────────────────
// ニックス相性
// ─────────────────────────────────────────

export interface NicksRelationRecord {
  id: number;
  lineageAId: number;
  lineageBId: number;
  level: number;
}

// ─────────────────────────────────────────
// 配合計画
// ─────────────────────────────────────────

export interface BreedingPlan {
  id: number;
  year: number;
  stallionId: number;
  stallion: { id: number; name: string; childLineage: ChildLineageWithParent };
  mareId: number;
  mare: { id: number; name: string; lineage: string };
  memo: string | null;
  status: PlanStatus;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────
// カレンダーイベント
// ─────────────────────────────────────────

export interface GameEvent {
  id: number;
  targetYear: number | null;
  targetMonth: number;
  targetWeek: number;
  title: string;
  description: string | null;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────
// ギャラリー
// ─────────────────────────────────────────

export interface GalleryEntry {
  id: number;
  title: string;
  imageUrl: string | null;
  content: string;
  eventDate: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────
// 現役馬
// ─────────────────────────────────────────

export type Surface = 'TURF' | 'DIRT' | 'BOTH';
export type HorseStatus = 'ACTIVE' | 'RETIRED';
export type Temperament = 'FIERCE' | 'ROUGH' | 'NORMAL' | 'MILD' | 'SUPER_MILD';
export type RunningStyle = 'GREAT_ESCAPE' | 'ESCAPE' | 'LEADER' | 'CLOSER' | 'CHASER' | 'VERSATILE';

export interface Racehorse {
  id: number;
  name: string;
  birthYear: number | null;
  gender: 'MALE' | 'FEMALE';
  sireId: number | null;
  sire: { id: number; name: string } | null;
  damId: number | null;
  dam: { id: number; name: string } | null;
  growthType: GrowthType | null;
  surface: Surface | null;
  distanceMin: number | null;
  distanceMax: number | null;
  temperament: Temperament | null;
  runningStyle: RunningStyle | null;
  spirit: EvalMark;
  health: EvalMark;
  autoComment: string | null;
  aiComment: string | null;
  memo: string | null;
  status: HorseStatus;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────
// 配合計算レスポンス
// ─────────────────────────────────────────

export interface BreedingCalculateResponse {
  stallion: { id: number; name: string; lineage: string | undefined };
  mare: { id: number; name: string; lineage: string };
  result: BreedingResult;
}
