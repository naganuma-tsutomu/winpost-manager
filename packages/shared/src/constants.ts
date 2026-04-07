// 評価印
export const EVAL_MARKS = {
  DOUBLE_CIRCLE: '◎',
  CIRCLE: '○',
  TRIANGLE: '▲',
  NONE: '－',
} as const;

export type EvalMark = keyof typeof EVAL_MARKS;

// 性別
export const GENDERS = {
  MALE: '牡',
  FEMALE: '牝',
} as const;

export type Gender = keyof typeof GENDERS;

// 成長型
export const GROWTH_TYPES = {
  SUPER_EARLY: '超早熟',
  EARLY: '早熟',
  NORMAL: '普通',
  LATE: '晩成',
  SUPER_LATE: '超晩成',
} as const;

export type GrowthType = keyof typeof GROWTH_TYPES;

// 因子タイプ
export const FACTOR_TYPES = {
  SPEED: 'スピード',
  STAMINA: 'スタミナ',
  POWER: 'パワー',
  TENACITY: '根性',
  AGILITY: '瞬発力',
  HEALTH: '健康',
  SPIRIT: '精神力',
  WISDOM: '賢さ',
  FAMOUS_SIRE: '名種牡馬因子',
  GREAT_SIRE: '大種牡馬因子',
} as const;

export type FactorType = keyof typeof FACTOR_TYPES;

// フラグ
export const FLAG_TYPES = {
  OVERSEAS_SALE: '海外セリ候補',
  KEEP: '所有確定',
  SELL: '売却予定',
  WATCH: '要観察',
} as const;

export type FlagType = keyof typeof FLAG_TYPES;

// 配合計画ステータス
export const PLAN_STATUSES = {
  PLANNED: '予定',
  COMPLETED: '実施済み',
  CANCELLED: '取消',
} as const;

export type PlanStatus = keyof typeof PLAN_STATUSES;
