import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Stallion } from '@winpost/shared';
import { Save, Info, Network, CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

/** 血統表の位置一覧 (最大4代) */
const PEDIGREE_POSITIONS: { position: string; label: string; generation: number; col: number; row: number }[] = [
  // 1代 (父・母)
  { position: 'F',  label: '父',     generation: 1, col: 1, row: 1 },
  { position: 'M',  label: '母',     generation: 1, col: 1, row: 2 },
  // 2代 (祖父・祖母 × 4)
  { position: 'FF', label: '父父',   generation: 2, col: 2, row: 1 },
  { position: 'FM', label: '父母',   generation: 2, col: 2, row: 2 },
  { position: 'MF', label: '母父',   generation: 2, col: 2, row: 3 },
  { position: 'MM', label: '母母',   generation: 2, col: 2, row: 4 },
  // 3代 (8頭)
  { position: 'FFF', label: '父父父', generation: 3, col: 3, row: 1 },
  { position: 'FFM', label: '父父母', generation: 3, col: 3, row: 2 },
  { position: 'FMF', label: '父母父', generation: 3, col: 3, row: 3 },
  { position: 'FMM', label: '父母母', generation: 3, col: 3, row: 4 },
  { position: 'MFF', label: '母父父', generation: 3, col: 3, row: 5 },
  { position: 'MFM', label: '母父母', generation: 3, col: 3, row: 6 },
  { position: 'MMF', label: '母母父', generation: 3, col: 3, row: 7 },
  { position: 'MMM', label: '母母母', generation: 3, col: 3, row: 8 },
];

type PedigreeEntries = Record<string, { ancestorId: number; ancestorName: string }>;

export function PedigreeEditorPage() {
  const queryClient = useQueryClient();
  const [horseType, setHorseType] = useState<'stallion' | 'mare'>('stallion');
  const [horseId, setHorseId] = useState<string>('none');
  const [entries, setEntries] = useState<PedigreeEntries>({});
  const [saved, setSaved] = useState(false);

  const { data: stallions = [] } = useQuery({ queryKey: ['stallions'], queryFn: api.stallions.list });
  const { data: mares = [] } = useQuery({ queryKey: ['mares'], queryFn: api.mares.list });

  const numHorseId = horseId !== 'none' ? Number(horseId) : null;

  // 選択した馬の血統データをロード
  const { data: pedigreeData, isLoading: pLoading } = useQuery({
    queryKey: ['pedigree', horseType, numHorseId],
    queryFn: () => api.breeding.getPedigree(horseType, numHorseId!),
    enabled: !!numHorseId,
  });

  useEffect(() => {
    if (!pedigreeData) return;
    const map: PedigreeEntries = {};
    for (const e of pedigreeData) {
      map[e.position] = { ancestorId: e.ancestorId, ancestorName: e.ancestor?.name ?? '' };
    }
    setEntries(map);
    setSaved(false);
  }, [pedigreeData, numHorseId]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const entriesToSave = PEDIGREE_POSITIONS
        .filter(p => entries[p.position]?.ancestorId)
        .map(p => ({
          ancestorId: entries[p.position].ancestorId,
          generation: p.generation,
          position: p.position,
        }));
      return api.breeding.savePedigree(horseType, numHorseId!, entriesToSave);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedigree', horseType, numHorseId] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const handleSelectAncestor = (position: string, _generation: number, ancestorId: number, ancestorName: string) => {
    setEntries(prev => ({
      ...prev,
      [position]: { ancestorId, ancestorName },
    }));
    setSaved(false);
  };

  const handleClearAncestor = (position: string) => {
    setEntries(prev => {
      const next = { ...prev };
      delete next[position];
      return next;
    });
    setSaved(false);
  };

  const horses = horseType === 'stallion' ? stallions : mares;

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">血統表入力</h1>
        <p className="text-slate-500 mt-1">種牡馬・繁殖牝馬の血統を登録します（最大4代）</p>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="space-y-2 w-full md:w-48">
              <Label className="text-slate-700">対象</Label>
              <Select value={horseType} onValueChange={(v) => { setHorseType(v as 'stallion'|'mare'); setHorseId('none'); setEntries({}); }}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stallion">種牡馬</SelectItem>
                  <SelectItem value="mare">繁殖牝馬</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2 w-full md:w-[300px]">
              <Label className="text-slate-700">馬の名前</Label>
              <Select value={horseId} onValueChange={(v) => { setHorseId(v); setEntries({}); }}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="── 選択してください ──" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">── 選択してください ──</SelectItem>
                  {horses.map((h: { id: number; name: string }) => (
                    <SelectItem key={h.id} value={h.id.toString()}>{h.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-3">
              {saved && (
                <span className="text-emerald-600 text-sm flex items-center font-medium animate-pulse">
                  <CheckCircle2 className="w-4 h-4 mr-1" /> 保存しました
                </span>
              )}
              {numHorseId && (
                <Button 
                  onClick={() => saveMutation.mutate()} 
                  disabled={saveMutation.isPending}
                  className="shadow-sm"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saveMutation.isPending ? '保存中...' : '血統表を保存'}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {!numHorseId ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <Network className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-1">馬を選択してください</h3>
          <p className="text-slate-500 max-w-sm">対象の種牡馬または繁殖牝馬を選択すると、血統表の入力フォームが表示されます。</p>
        </div>
      ) : pLoading ? (
        <div className="flex justify-center py-20 text-slate-500 bg-white rounded-xl border border-slate-200">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
          読み込み中...
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 overflow-x-auto bg-slate-50 p-4 md:p-6 rounded-xl border border-slate-200 text-sm">
            {[1, 2, 3].map(gen => (
              <div key={gen} className="flex flex-col gap-3 min-w-[200px]">
                <div className="text-xs font-bold text-slate-400 text-center uppercase tracking-widest pb-1 border-b border-slate-200">
                  {gen === 1 ? '1代（父母）' : gen === 2 ? '2代（祖父母）' : '3代（曽祖父母）'}
                </div>
                {PEDIGREE_POSITIONS.filter(p => p.generation === gen).map(pos => (
                  <PedigreeCell
                    key={pos.position}
                    posInfo={pos}
                    value={entries[pos.position]}
                    stallions={stallions}
                    onChange={(id, name) => handleSelectAncestor(pos.position, pos.generation, id, name)}
                    onClear={() => handleClearAncestor(pos.position)}
                  />
                ))}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 text-slate-500 text-xs bg-blue-50/50 p-3 rounded-md border border-blue-100">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <p>
              血統表の先祖はすべて種牡馬から選択します。繁殖牝馬の血統を入力する場合も、先祖は種牡馬として登録してください。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function PedigreeCell({
  posInfo, value, stallions, onChange, onClear,
}: {
  posInfo: typeof PEDIGREE_POSITIONS[0];
  value?: { ancestorId: number; ancestorName: string };
  stallions: Stallion[];
  onChange: (id: number, name: string) => void;
  onClear: () => void;
}) {
  const depth = posInfo.generation;
  // generation 1: primary, 2: indigo, 3: emerald
  const colors = ['', 'border-blue-500 text-blue-700', 'border-indigo-400 text-indigo-700', 'border-emerald-400 text-emerald-700'];
  const labelColors = ['', 'text-blue-600', 'text-indigo-500', 'text-emerald-500'];
  
  const hasValue = !!value;

  return (
    <div className={`
      relative rounded-md p-2.5 transition-colors border
      ${hasValue ? 'bg-indigo-50/40 border-indigo-200' : 'bg-white border-slate-200'}
      border-l-4 ${colors[depth]} shadow-sm
    `}>
      <div className="flex justify-between items-center mb-1.5">
        <span className={`text-[10px] font-bold ${labelColors[depth]}`}>{posInfo.label}</span>
        {hasValue && (
          <button
            onClick={onClear}
            className="text-slate-400 hover:text-rose-500 transition-colors w-4 h-4 flex items-center justify-center font-bold text-lg leading-none"
            title="クリア"
          >
            ×
          </button>
        )}
      </div>
      <select
        className={`
          w-full text-xs rounded-sm border p-1.5 outline-none transition-colors
          ${hasValue ? 'bg-white border-indigo-200 font-semibold text-slate-800' : 'bg-slate-50 border-slate-200 text-slate-500'}
          focus:border-primary focus:ring-1 focus:ring-primary
        `}
        value={value?.ancestorId ?? ''}
        onChange={e => {
          if (!e.target.value) { onClear(); return; }
          const s = stallions.find((s) => s.id === Number(e.target.value));
          if (s) onChange(s.id, s.name);
        }}>
        <option value="">── 未登録 ──</option>
        {stallions.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
    </div>
  );
}
