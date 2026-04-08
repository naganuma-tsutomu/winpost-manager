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

export interface FoalAdvice {
  summary: string;
  subParaAdvice: string;
  growthAdvice: string;
  managerAdvice: string;
}

/**
 * 複数の印と成長型、牧場長コメントから詳細な幼駒評価アドバイスを生成する
 */
export function generateFoalAdvice(
  kappaMark: EvalMark,
  mikaMark: EvalMark,
  managerMark: EvalMark,
  secretaryMark: EvalMark,
  nagamineMark: EvalMark,
  growthType?: string,
  comments?: Record<string, string>
): FoalAdvice {

  // 1. 美香の印によるサブパラ評価
  let subParaAdvice = '美香の印が薄い（または無印）ため、スピードがあってもサブパラがボロボロの可能性が高いです。優先度を下げたほうが無難です。';
  if (mikaMark === 'DOUBLE_CIRCLE') {
    subParaAdvice = '美香◎は全体的な能力の高さを示し、最も信頼度が高いと言われています。弱点が少ない大物の可能性が極めて高いです。';
  } else if (mikaMark === 'CIRCLE') {
    subParaAdvice = '美香○はまずまずのサブパラを備えていることを示します。堅実に走ります。';
  } else if (mikaMark === 'TRIANGLE') {
    subParaAdvice = '美香▲はサブパラに多少の不安がありますが、スピードなど何か一芸に秀でている可能性があります。';
  }

  // 2. 成長型と河童木のバランス
  let growthAdvice = '成長型と河童木の印のバランスは平均的です。';
  if (growthType === 'SUPER_EARLY' || growthType === 'EARLY') {
    if (kappaMark !== 'DOUBLE_CIRCLE' && kappaMark !== 'CIRCLE') {
      growthAdvice = '「早熟」で河童木の印が薄い馬は期待薄です。';
    } else {
      growthAdvice = '早熟馬として順当な評価です。早期からの活躍に期待できます。（成長度の恩恵を含むため過信は禁物）';
    }
  } else if (growthType === 'LATE' || growthType === 'SUPER_LATE') {
    if (kappaMark === 'DOUBLE_CIRCLE' || kappaMark === 'CIRCLE') {
      growthAdvice = '「晩成」なのに河童木の印が重い（◎や○）場合は、スピードのポテンシャルが非常に高い証拠となります！超大物の期待大です。';
    } else {
      growthAdvice = '晩成馬のため、河童木の印が薄くても将来的に化ける可能性があります。じっくり育てましょう。';
    }
  }

  // 3. 牧場長コメントの分析
  let managerAdvice = '牧場長のコメントが不足しているため、ステータスの穴（弱点）が把握できません。';
  if (comments) {
    const praises = Object.values(comments).filter(c => c === 'GOOD' || c === 'EXCELLENT' || c === 'OUTSTANDING');
    if (praises.length >= 4) {
      managerAdvice = '牧場長から複数の能力が褒められています。ステータスに穴がなく、全体的に非常に優秀です！';
    } else if (praises.length >= 2) {
      managerAdvice = '牧場長からいくつかの能力を褒められています。長所を活かす走りに期待できます。';
    } else if (praises.length === 0) {
      // コメントが全てNONEの場合
      managerAdvice = '牧場長からの褒め言葉が見当たりません。ステータスに大きな穴（パワー不足、柔軟性不足など）がある可能性があります。';
    }
  }

  // 4. 総合判断
  let summary = '';
  if (mikaMark === 'DOUBLE_CIRCLE' && (kappaMark === 'DOUBLE_CIRCLE' || kappaMark === 'CIRCLE') && (growthType === 'LATE' || growthType === 'SUPER_LATE')) {
    summary = '【歴史的名馬級】美香◎で欠点なし、晩成で河童木重めという究極のポテンシャル。文句なしの大当たりです！';
  } else if (mikaMark === 'DOUBLE_CIRCLE' && (kappaMark === 'DOUBLE_CIRCLE' || kappaMark === 'CIRCLE')) {
    summary = '【G1級】美香の印があり、河童木の印と成長型のバランスも良いです。最も当たりを引きやすい堅実な見分け方ができる馬です。';
  } else if (mikaMark === 'NONE' && (kappaMark === 'DOUBLE_CIRCLE' || kappaMark === 'CIRCLE')) {
    summary = '【地雷注意】河童木の印は重いですが美香が無印です。スピードだけで勝負根性等のサブパラが壊滅的な危険馬です。';
  } else if (mikaMark === 'NONE' && kappaMark === 'NONE') {
    summary = '【期待薄】全体的に印が薄く、競走馬としてのポテンシャルは低そうです。';
  } else {
    summary = '【重賞級レベル】相対評価の影響もあるため、相手関係やサブパラ次第で十分に活躍できる素質があります。';
  }

  return {
    summary,
    subParaAdvice,
    growthAdvice,
    managerAdvice
  };
}
