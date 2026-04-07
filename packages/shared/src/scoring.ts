// 印の組み合わせからスピードスコアを推測するロジック
import type { EvalMark } from './constants';

const MARK_SCORES: Record<EvalMark, number> = {
  DOUBLE_CIRCLE: 5,
  CIRCLE: 3,
  TRIANGLE: 1,
  NONE: 0,
};

export interface SpeedEstimate {
  score: number;
  rank: string;
  description: string;
}

/**
 * 河童木と美香の印からスピードスコアを推測する
 *
 * 河童木: スピード + 成長度
 * 美香: スピード + サブパラ合計
 *
 * 美香の方がスピードの信頼度が高いため、重み付けを大きくする
 */
export function estimateSpeed(
  kappaMark: EvalMark,
  mikaMark: EvalMark,
  growthType?: string
): SpeedEstimate {
  const kappaScore = MARK_SCORES[kappaMark];
  const mikaScore = MARK_SCORES[mikaMark];

  // 美香の印に1.5倍の重みを付ける
  let rawScore = kappaScore + mikaScore * 1.5;

  // 晩成馬で河童木の印が高い場合はボーナス（成長度に左右されない実力）
  if (growthType === 'LATE' || growthType === 'SUPER_LATE') {
    if (kappaMark === 'DOUBLE_CIRCLE' || kappaMark === 'CIRCLE') {
      rawScore += 2;
    }
  }

  // 早熟馬は河童木の印を割り引く（成長度の恩恵で高くなっている可能性）
  if (growthType === 'SUPER_EARLY' || growthType === 'EARLY') {
    rawScore -= kappaScore * 0.3;
  }

  const score = Math.round(rawScore * 10) / 10;

  let rank: string;
  let description: string;

  if (score >= 10) {
    rank = 'S';
    description = '世代トップクラスのスピード。最優先で所有すべき。';
  } else if (score >= 7) {
    rank = 'A';
    description = '高いスピードが期待できる。G1級の素質あり。';
  } else if (score >= 5) {
    rank = 'B';
    description = 'そこそこのスピード。重賞クラスは目指せる。';
  } else if (score >= 3) {
    rank = 'C';
    description = '平均的。相手次第では好走可能。';
  } else {
    rank = 'D';
    description = 'スピードは期待薄。繁殖入り候補。';
  }

  return { score, rank, description };
}
