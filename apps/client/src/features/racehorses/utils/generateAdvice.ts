export type HorseParams = {
  surface?: 'TURF' | 'DIRT' | 'BOTH' | null;
  distanceMin?: number | null;
  distanceMax?: number | null;
  growthType?: 'SUPER_EARLY' | 'EARLY' | 'NORMAL' | 'LATE' | 'SUPER_LATE' | null;
  gender?: 'MALE' | 'FEMALE';
};

export const generateRuleBasedAdvice = (params: HorseParams): string => {
  if (!params.growthType || !params.surface) return 'データが不足しているため、アドバイスを生成できません。';

  let strategy = '';
  
  // 成長型による判断
  if (params.growthType === 'SUPER_EARLY' || params.growthType === 'EARLY') {
    strategy += '早熟傾向のため、2歳戦から積極的に使いましょう。';
  } else if (params.growthType === 'NORMAL') {
    strategy += '標準的な成長型です。3歳クラシック～古馬まで幅広い活躍が見込めます。';
  } else {
    strategy += '晩成傾向です。3歳までは自己条件でじっくり育て、古馬王道を目指しましょう。';
  }

  strategy += ' ';

  // 距離・馬場適性による判断
  const max = params.distanceMax || 2000;
  
  if (params.surface === 'DIRT') {
    if (max <= 1600) {
      strategy += 'ダート短距離～マイル戦が主戦場です。全日本2歳優駿やフェブラリーS、JBCスプリントなどを目標にしてください。';
    } else {
      strategy += 'ダート中距離路線で活躍できます。ジャパンダートダービーやチャンピオンズカップ、東京大賞典が目標になります。';
    }
  } else {
    if (max <= 1400) {
      strategy += '生粋のスプリンターです。スプリンターズSや高松宮記念などの短距離G1制覇を狙いましょう。';
    } else if (max <= 1800) {
      if (params.gender === 'FEMALE') {
        strategy += '桜花賞やヴィクトリアマイルなど、牝馬マイル路線での活躍が期待できます。';
      } else {
        strategy += 'NHKマイルCや安田記念など、マイルG1路線を主軸にローテーションを組みましょう。';
      }
    } else if (max <= 2400) {
      if (params.gender === 'FEMALE') {
        strategy += 'オークスやエリザベス女王杯など、牝馬王道路線で主役を張れる器です。';
      } else {
        strategy += '皐月賞・ダービーのクラシック路線、および王道の秋古馬三冠（天皇賞秋・JC・有馬）が最大の目標です。';
      }
    } else {
      strategy += '豊富なスタミナを持つステイヤーです。菊花賞や天皇賞・春から海外の長距離レースなどを視野に入れましょう。';
    }
  }

  return strategy;
};
