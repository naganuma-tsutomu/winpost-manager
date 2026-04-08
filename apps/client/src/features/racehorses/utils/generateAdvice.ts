export type HorseParams = {
  surface?: 'TURF' | 'DIRT' | 'BOTH' | null;
  distanceMin?: number | null;
  distanceMax?: number | null;
  growthType?: 'SUPER_EARLY' | 'EARLY' | 'NORMAL' | 'LATE' | 'SUPER_LATE' | null;
  gender?: 'MALE' | 'FEMALE';
  // 成績
  starts?: number | null;
  wins?: number | null;
  g1Wins?: number | null;
  // 能力値（グレード）
  speed?: string | null;
  stamina?: string | null;
  power?: string | null;
  guts?: string | null;
  intelligence?: string | null;
};

export const generateRuleBasedAdvice = (params: HorseParams): string => {
  if (!params.growthType || !params.surface) return 'データが不足しているため、アドバイスを生成できません。';

  const lines: string[] = [];

  // ── 成長型による育成方針 ──
  if (params.growthType === 'SUPER_EARLY' || params.growthType === 'EARLY') {
    lines.push('早熟傾向のため、2歳戦から積極的に使いましょう。ピークが短いので3歳中に目標レースを集中させるのが理想です。');
  } else if (params.growthType === 'NORMAL') {
    lines.push('標準的な成長型です。3歳クラシック～古馬まで幅広い活躍が見込めます。');
  } else {
    lines.push('晩成傾向です。3歳までは自己条件でじっくり育て、古馬路線での本格化を狙いましょう。');
  }

  // ── 距離・馬場適性による目標レース ──
  const max = params.distanceMax || 2000;

  if (params.surface === 'DIRT') {
    if (max <= 1600) {
      lines.push('ダート短距離～マイル戦が主戦場です。全日本2歳優駿・フェブラリーS・JBCスプリントなどを目標にしてください。');
    } else {
      lines.push('ダート中距離路線で活躍できます。ジャパンダートダービー・チャンピオンズカップ・東京大賞典が目標になります。');
    }
  } else {
    if (max <= 1400) {
      lines.push('生粋のスプリンターです。スプリンターズS・高松宮記念などの短距離G1制覇を狙いましょう。');
    } else if (max <= 1800) {
      if (params.gender === 'FEMALE') {
        lines.push('桜花賞・ヴィクトリアマイルなど、牝馬マイル路線での活躍が期待できます。');
      } else {
        lines.push('NHKマイルC・安田記念など、マイルG1路線を主軸にローテーションを組みましょう。');
      }
    } else if (max <= 2400) {
      if (params.gender === 'FEMALE') {
        lines.push('オークス・エリザベス女王杯など、牝馬王道路線で主役を張れる器です。');
      } else {
        lines.push('皐月賞・ダービーのクラシック路線、および秋古馬三冠（天皇賞秋・JC・有馬）が最大の目標です。');
      }
    } else {
      lines.push('豊富なスタミナを持つステイヤーです。菊花賞・天皇賞春から海外長距離レースなども視野に入れましょう。');
    }
  }

  // ── 成績コメント ──
  const starts = params.starts ?? 0;
  const wins = params.wins ?? 0;
  const g1Wins = params.g1Wins ?? 0;

  if (starts > 0) {
    const winRate = Math.round((wins / starts) * 100);
    if (g1Wins > 0) {
      lines.push(`現在G1を${g1Wins}勝（${starts}戦${wins}勝、勝率${winRate}%）。引き続き高いレベルでの活躍が期待されます。`);
    } else if (winRate >= 50) {
      lines.push(`勝率${winRate}%（${starts}戦${wins}勝）と安定した成績です。G1挑戦のタイミングを見極めましょう。`);
    } else if (wins === 0) {
      lines.push(`まだ未勝利（${starts}戦）。条件戦での経験を積みながら適性を確認してください。`);
    } else {
      lines.push(`${starts}戦${wins}勝（勝率${winRate}%）。重賞戦線への足がかりを作っていきましょう。`);
    }
  }

  // ── 能力値コメント ──
  const speed = params.speed;
  const stamina = params.stamina;
  const power = params.power;
  const guts = params.guts;
  const intelligence = params.intelligence;

  // グレードを数値ランクに変換（S=11 が最高、F=0 が最低）
  const GRADE_RANK: Record<string, number> = {
    S: 11, 'A+': 10, A: 9, 'B+': 8, B: 7, 'C+': 6, C: 5, 'D+': 4, D: 3, 'E+': 2, E: 1, F: 0,
  };
  const rank = (g: string | null | undefined): number | null =>
    g != null && g in GRADE_RANK ? GRADE_RANK[g] : null;

  const hasAbility = [speed, stamina, power, guts, intelligence].some(v => v != null && v !== '');

  if (hasAbility) {
    const abilityNotes: string[] = [];

    const rSpeed = rank(speed);
    if (rSpeed != null) {
      if (rSpeed >= 10) abilityNotes.push('スピードは超一流');
      else if (rSpeed >= 8) abilityNotes.push('スピードは十分');
      else if (rSpeed <= 4) abilityNotes.push('スピードが課題');
    }

    const rStamina = rank(stamina);
    if (rStamina != null) {
      if (rStamina >= 10) abilityNotes.push('スタミナは超一流');
      else if (rStamina >= 8) abilityNotes.push('スタミナは豊富');
      else if (rStamina <= 4) abilityNotes.push('スタミナが不足気味');
    }

    const rPower = rank(power);
    if (rPower != null && rPower <= 4) abilityNotes.push('パワー強化が必要');

    const rGuts = rank(guts);
    if (rGuts != null && rGuts <= 4) abilityNotes.push('根性の育成を優先して');

    const rInt = rank(intelligence);
    if (rInt != null) {
      if (rInt >= 9) abilityNotes.push('賢さが高く折り合いが楽');
      else if (rInt <= 4) abilityNotes.push('賢さが低いため気性管理に注意');
    }

    if (abilityNotes.length > 0) {
      lines.push(`【能力評価】${abilityNotes.join('、')}。`);
    }

    // 能力バランス評価
    const ranks = [rSpeed, rStamina, rPower, rGuts, rInt].filter((v): v is number => v != null);
    if (ranks.length >= 3) {
      const avg = ranks.reduce((a, b) => a + b, 0) / ranks.length;
      if (avg >= 9) {
        lines.push('全体的な能力値が高く、G1でも十分戦える器です。');
      } else if (avg < 5) {
        lines.push('能力値の底上げが先決です。調教や因子継承で強化を図りましょう。');
      }
    }
  }

  return lines.join('\n');
};
