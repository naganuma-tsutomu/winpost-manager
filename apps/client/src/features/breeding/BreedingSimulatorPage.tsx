import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { BreedingCalculateResponse, BreedingResult, BreedingTheory } from '@winpost/shared';
import {
  Zap, AlertTriangle, CheckCircle, Info,
  ChevronRight, Flame, Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

// ─────────────────────────────────────────
// 爆発力ランク表示
// ─────────────────────────────────────────

const rankConfig: Record<string, { bg: string; text: string; label: string; shadow?: string }> = {
  'S+': { bg: 'bg-gradient-to-br from-amber-500 to-rose-500', text: 'text-white', label: 'S+', shadow: 'shadow-[0_0_24px_rgba(245,158,11,0.5)]' },
  'S':  { bg: 'bg-gradient-to-br from-indigo-500 to-purple-500', text: 'text-white', label: 'S'  },
  'A':  { bg: 'bg-rose-100', text: 'text-rose-600', label: 'A' },
  'B':  { bg: 'bg-blue-100', text: 'text-blue-600', label: 'B' },
  'C':  { bg: 'bg-emerald-100', text: 'text-emerald-600', label: 'C' },
  'D':  { bg: 'bg-slate-100', text: 'text-slate-500', label: 'D' },
};

function RankBadge({ rank, large }: { rank: string; large?: boolean }) {
  const cfg = rankConfig[rank] ?? rankConfig['D'];
  const sizeClass = large ? 'w-20 h-20 text-3xl' : 'w-10 h-10 text-lg';
  return (
    <div className={`${sizeClass} ${cfg.bg} ${cfg.text} ${cfg.shadow || ''} rounded-xl flex items-center justify-center font-black flex-shrink-0`}>
      {cfg.label}
    </div>
  );
}

// ─────────────────────────────────────────
// 配合理論 1 件のカード
// ─────────────────────────────────────────

const theoryColorByType: Record<string, string> = {
  NICKS_SINGLE: 'text-indigo-500 border-indigo-200 bg-indigo-50', NICKS_DOUBLE: 'text-purple-500 border-purple-200 bg-purple-50',
  NICKS_TRIPLE: 'text-purple-600 border-purple-200 bg-purple-50', NICKS_FORCE: 'text-fuchsia-500 border-fuchsia-200 bg-fuchsia-50',
  INBREED: 'text-amber-500 border-amber-200 bg-amber-50', MOTHER_INBREED: 'text-amber-500 border-amber-200 bg-amber-50',
  BLOOD_ACTIVATION: 'text-cyan-500 border-cyan-200 bg-cyan-50', BLOOD_ACTIVATION_INBREED: 'text-sky-500 border-sky-200 bg-sky-50',
  LINE_BREED_PARENT: 'text-emerald-500 border-emerald-200 bg-emerald-50', LINE_BREED_CHILD: 'text-emerald-400 border-emerald-200 bg-emerald-50',
  LINE_BREED_EXPLOSION: 'text-teal-400 border-teal-200 bg-teal-50',
  VITALITY_FAMOUS_SIRE: 'text-orange-500 border-orange-200 bg-orange-50', VITALITY_FAMOUS_MARE: 'text-orange-400 border-orange-200 bg-orange-50',
  VITALITY_DIFFERENT_LINE: 'text-amber-400 border-amber-200 bg-amber-50', VITALITY_COMPLETE: 'text-yellow-500 border-yellow-200 bg-yellow-50',
  ATAVISM: 'text-pink-500 border-pink-200 bg-pink-50',
  DAM_SIRE_BONUS: 'text-slate-500 border-slate-200 bg-slate-50',
  MAIL_LINE_ACTIVATION: 'text-slate-600 border-slate-200 bg-slate-50',
};

function TheoryCard({ theory }: { theory: BreedingTheory }) {
  const colorClass = theoryColorByType[theory.type] ?? 'text-slate-500 border-slate-200 bg-slate-50';
  
  // Parse colors to get text color for icon
  const iconColor = colorClass.split(' ').find(c => c.startsWith('text-'));
  
  return (
    <div className={`border-l-4 rounded-md p-3 flex gap-3 items-start ${colorClass}`}>
      <div className="flex-shrink-0 mt-0.5">
        <Zap className={`w-4 h-4 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className={`font-bold text-sm ${iconColor}`}>
            {theory.label}
          </span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/60 ${iconColor} border border-current/20`}>
            +{theory.power}pt
          </span>
          {theory.subPower > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600">
              サブ +{theory.subPower}
            </span>
          )}
          {theory.risk > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-600">
              危険 +{theory.risk}
            </span>
          )}
          {theory.risk < 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600">
              危険 {theory.risk}
            </span>
          )}
        </div>
        <div className="text-xs text-slate-600 mb-1.5 opacity-90">
          {theory.detail}
        </div>
        <div className="flex gap-1 flex-wrap">
          {theory.tags.map(tag => (
            <span key={tag} className={`text-[9px] font-semibold px-1.5 py-[1px] rounded-full bg-white/50 ${iconColor}`}>
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// 計算結果全体パネル
// ─────────────────────────────────────────

function ResultPanel({ result, stallionName, mareName }: {
  result: BreedingResult; stallionName: string; mareName: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* サマリーカード */}
      <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 text-white shadow-lg">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <RankBadge rank={result.rank} large />
            <div className="flex-1 w-full text-center sm:text-left">
              <div className="text-xs text-slate-400 mb-3 font-medium">
                {stallionName} <span className="text-slate-500 mx-1">×</span> {mareName}
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <div className="text-3xl font-black text-amber-400">
                    {result.totalPower}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center justify-center sm:justify-start gap-1 mt-1 font-medium">
                    <Flame className="w-3 h-3" /> 総爆発力
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-black text-emerald-400">
                    {result.subPower}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center justify-center sm:justify-start gap-1 mt-1 font-medium">
                    <Zap className="w-3 h-3" /> サブパラ爆発
                  </div>
                </div>
                <div>
                  <div className={`text-3xl font-black ${result.totalRisk >= 6 ? 'text-rose-400' : result.totalRisk >= 3 ? 'text-amber-400' : 'text-slate-400'}`}>
                    {result.totalRisk}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center justify-center sm:justify-start gap-1 mt-1 font-medium">
                    <Shield className="w-3 h-3" /> 危険度
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-black text-indigo-400">
                    {result.theories.length}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center justify-center sm:justify-start gap-1 mt-1 font-medium">
                    <CheckCircle className="w-3 h-3" /> 成立理論
                  </div>
                </div>
              </div>
              <div className="mt-4 text-[13px] text-slate-300 leading-relaxed bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                {result.summary}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 危険度警告 */}
      {result.totalRisk >= 6 && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 flex items-center gap-3 text-rose-600 text-sm font-medium shadow-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          危険度が高い配合です。両親の健康状態を確認してください。
        </div>
      )}

      {/* 理論一覧 */}
      {result.theories.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center p-12 text-center text-slate-500">
          <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
            <Info className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="font-semibold text-slate-700">配合理論は成立していません</h3>
          <p className="text-sm mt-1">血統表を登録すると、より詳細な判定が可能になります</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="text-sm font-bold text-slate-500 flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4" /> 成立した配合理論
          </div>
          <div className="grid gap-2.5">
            {result.theories.map((t, i) => (
              <TheoryCard key={i} theory={t} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// メインコンポーネント: 配合シミュレーター
// ─────────────────────────────────────────

export function BreedingSimulatorPage() {
  const [stallionId, setStallionId] = useState<string>('none');
  const [mareId, setMareId] = useState<string>('none');
  const [result, setResult] = useState<BreedingCalculateResponse | null>(null);

  const { data: stallions = [] } = useQuery({ queryKey: ['stallions'], queryFn: api.stallions.list });
  const { data: mares = [] } = useQuery({ queryKey: ['mares'], queryFn: api.mares.list });

  const numStallionId = stallionId !== 'none' ? Number(stallionId) : null;
  const numMareId = mareId !== 'none' ? Number(mareId) : null;

  const calcMutation = useMutation({
    mutationFn: () => api.breeding.calculate(numStallionId!, numMareId!),
    onSuccess: (data) => setResult(data),
  });

  const handleCalculate = useCallback(() => {
    if (!numStallionId || !numMareId) return;
    calcMutation.mutate();
  }, [numStallionId, numMareId, calcMutation]);

  const selectedStallion = stallions.find((s) => s.id === numStallionId);
  const selectedMare = mares.find((m) => m.id === numMareId);

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">配合シミュレーター</h1>
        <p className="text-slate-500 mt-1">種牡馬と繁殖牝馬を選択して、爆発力と成立する配合理論を計算します</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        {/* 左: 選択フォーム */}
        <div className="flex flex-col gap-5">
          {/* 種牡馬選択 */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="text-xl">🐎</span> 種牡馬
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <Select value={stallionId} onValueChange={(v) => { setStallionId(v); setResult(null); }}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="── 種牡馬を選択 ──" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">── 種牡馬を選択 ──</SelectItem>
                  {stallions.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedStallion && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="flex gap-2 flex-wrap mb-2 items-center">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      {selectedStallion.childLineage?.parentLineage?.name}
                    </Badge>
                    <span className="text-xs text-slate-500 font-medium">
                      {selectedStallion.childLineage?.name}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {selectedStallion.factors?.map((f) => (
                      <Badge key={f.id} variant="secondary" className="text-[10px] font-normal bg-white text-slate-600 border border-slate-200">
                        {f.type}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 繁殖牝馬選択 */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="text-xl">🌸</span> 繁殖牝馬
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <Select value={mareId} onValueChange={(v) => { setMareId(v); setResult(null); }}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="── 繁殖牝馬を選択 ──" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">── 繁殖牝馬を選択 ──</SelectItem>
                  {mares.map((m) => (
                    <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedMare && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="flex gap-2 flex-wrap mb-2 items-center">
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                      {selectedMare.lineage}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {selectedMare.factors?.map((f) => (
                      <Badge key={f.id} variant="secondary" className="text-[10px] font-normal bg-white text-slate-600 border border-slate-200">
                        {f.type}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 計算ボタン */}
          <Button
            size="lg"
            className="w-full text-base py-6 shadow-md transition-all hover:scale-[1.02]"
            disabled={!numStallionId || !numMareId || calcMutation.isPending}
            onClick={handleCalculate}
          >
            {calcMutation.isPending ? (
              <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3" /> 計算中...</>
            ) : (
              <><Zap className="w-5 h-5 mr-2" /> 爆発力を計算する <ChevronRight className="w-5 h-5 ml-1" /></>
            )}
          </Button>

          {calcMutation.isError && (
            <div className="text-rose-500 font-medium text-sm text-center bg-rose-50 p-3 rounded-md border border-rose-100">
              計算中にエラーが発生しました。
            </div>
          )}
        </div>

        {/* 右: 計算結果 */}
        <div className="flex-1">
          {result ? (
            <ResultPanel
              result={result.result}
              stallionName={result.stallion?.name ?? ''}
              mareName={result.mare?.name ?? ''}
            />
          ) : (
            <Card className="min-h-[400px] flex items-center justify-center border-dashed border-2 border-slate-200 bg-slate-50/50 shadow-none">
              <CardContent className="flex flex-col items-center gap-4 text-slate-400 p-8">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
                  <Zap className="w-10 h-10 text-slate-300" />
                </div>
                <p className="text-sm font-medium">種牡馬と繁殖牝馬を選択して計算してください</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
