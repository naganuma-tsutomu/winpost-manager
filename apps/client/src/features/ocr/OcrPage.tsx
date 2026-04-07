import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Upload, Image as ImageIcon, Zap, CheckCircle,
  AlertTriangle, RefreshCw, X, Info, Eye,
} from 'lucide-react';
import { EVAL_MARKS, GROWTH_TYPES, GENDERS, FACTOR_TYPES } from '@winpost/shared';
import type { Stallion, Mare, ChildLineageWithParent } from '@winpost/shared';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

// ─────────────────────────────────────────
// OCR モード
// ─────────────────────────────────────────

type OcrMode = 'foal' | 'stallion' | 'mare';

const OCR_MODES: { key: OcrMode; label: string; desc: string }[] = [
  { key: 'foal',    label: '幼駒',      desc: '幼駒評価画面' },
  { key: 'stallion', label: '種牡馬',   desc: '種牡馬情報画面' },
  { key: 'mare',    label: '繁殖牝馬',  desc: '繁殖牝馬情報画面' },
];

// Tailwind 用共通ネイティブ select クラス
const nativeSelectClass = "flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

// ─────────────────────────────────────────
// レスポンス型
// ─────────────────────────────────────────

interface OcrRawItem { text: string; confidence: number; }
interface OcrFoalData { name?: string; gender?: string; birthYear?: number; sireName?: string; damName?: string; kappaMark?: string; mikaMark?: string; growthType?: string; bodyComment?: string; }
interface OcrStallionData { name?: string; lineageName?: string; speed?: number; stamina?: number; power?: number; guts?: number; wisdom?: number; health?: number; factors: string[]; }
interface OcrMareData { name?: string; lineageName?: string; speed?: number; stamina?: number; factors: string[]; }
interface OcrFoalResult { foal: OcrFoalData; confidence: number; raw: OcrRawItem[]; }
interface OcrStallionResult { stallion: OcrStallionData; confidence: number; raw: OcrRawItem[]; }
interface OcrMareResult { mare: OcrMareData; confidence: number; raw: OcrRawItem[]; }
type OcrResult = OcrFoalResult | OcrStallionResult | OcrMareResult;

async function runOcr(mode: OcrMode, file: File): Promise<OcrResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`/api/ocr/${mode}`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'OCR に失敗しました' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function checkOcrHealth() {
  const res = await fetch('/api/ocr/health');
  return res.json();
}

// ─────────────────────────────────────────
// DropZone（共通）
// ─────────────────────────────────────────

function DropZone({ onFile, previewUrl, onClear, mode }: { onFile: (f: File) => void; previewUrl: string | null; onClear: () => void; mode: OcrMode; }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) onFile(file);
  }, [onFile]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'));
    if (item) { const file = item.getAsFile(); if (file) onFile(file); }
  }, [onFile]);

  const modeDesc = OCR_MODES.find(m => m.key === mode)?.desc ?? '';

  if (previewUrl) {
    return (
      <div className="relative rounded-xl overflow-hidden mt-2">
        <img src={previewUrl} alt="アップロード画像" className="w-full max-h-[320px] object-contain bg-black" />
        <button onClick={onClear} className="absolute top-2 right-2 bg-black/60 border-none rounded-full w-8 h-8 flex items-center justify-center cursor-pointer text-white hover:bg-black/80 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onPaste={handlePaste}
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      className={`
        border-2 border-dashed rounded-xl p-12 text-center cursor-pointer outline-none transition-all mt-2
        ${dragging ? 'border-primary bg-primary/5' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}
      `}>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
      <div className="font-semibold text-slate-700 mb-1">
        ドロップ / クリック / Ctrl+V で貼り付け
      </div>
      <div className="text-xs text-slate-500">
        ウイニングポスト10 の{modeDesc}をスクリーンショットしてください<br />
        PNG / JPEG / WebP 対応 (最大 10MB)
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// 信頼度バー・行表示（共通）
// ─────────────────────────────────────────

function ConfidenceBadge({ confidence, rawCount }: { confidence: number; rawCount: number }) {
  const pct = Math.round(confidence * 100);
  const colorToken = pct >= 70 ? 'emerald' : pct >= 40 ? 'amber' : 'rose';
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg bg-${colorToken}-50 border border-${colorToken}-200`}>
      <div className={`text-2xl font-black text-${colorToken}-600`}>{pct}%</div>
      <div>
        <div className={`text-sm font-semibold text-${colorToken}-700`}>認識精度</div>
        <div className={`text-xs text-${colorToken}-600 opacity-80`}>{rawCount} テキストブロック検出</div>
      </div>
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value: string | number | undefined }) {
  const display = value !== undefined && value !== null && value !== '' ? String(value) : undefined;
  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-md border ${display ? 'bg-indigo-50/50 border-indigo-100' : 'bg-slate-50 border-slate-100'}`}>
      <span className="text-xs font-semibold text-slate-500 w-24 flex-shrink-0">{label}</span>
      {display
        ? <span className="text-sm font-semibold text-slate-900">{display}</span>
        : <span className="text-xs text-slate-400 italic">未検出</span>
      }
    </div>
  );
}

// ─────────────────────────────────────────
// プレビューコンポーネント
// ─────────────────────────────────────────

function FoalResultPreview({ result }: { result: OcrFoalResult }) {
  const f = result.foal;
  return (
    <div className="flex flex-col gap-3">
      <ConfidenceBadge confidence={result.confidence} rawCount={result.raw.length} />
      <div className="flex flex-col gap-1.5">
        <ResultRow label="馬名" value={f.name} />
        <ResultRow label="性別" value={f.gender ? GENDERS[f.gender as keyof typeof GENDERS] : undefined} />
        <ResultRow label="誕生年" value={f.birthYear} />
        <ResultRow label="父馬" value={f.sireName} />
        <ResultRow label="母馬" value={f.damName} />
        <ResultRow label="河童木の印" value={f.kappaMark ? EVAL_MARKS[f.kappaMark as keyof typeof EVAL_MARKS] : undefined} />
        <ResultRow label="美香の印" value={f.mikaMark ? EVAL_MARKS[f.mikaMark as keyof typeof EVAL_MARKS] : undefined} />
        <ResultRow label="成長型" value={f.growthType ? GROWTH_TYPES[f.growthType as keyof typeof GROWTH_TYPES] : undefined} />
        <ResultRow label="馬体コメント" value={f.bodyComment} />
      </div>
    </div>
  );
}

function StallionResultPreview({ result }: { result: OcrStallionResult }) {
  const s = result.stallion;
  const factorLabels = s.factors.map(f => FACTOR_TYPES[f as keyof typeof FACTOR_TYPES] ?? f).join(', ');
  return (
    <div className="flex flex-col gap-3">
      <ConfidenceBadge confidence={result.confidence} rawCount={result.raw.length} />
      <div className="flex flex-col gap-1.5">
        <ResultRow label="馬名" value={s.name} />
        <ResultRow label="系統名" value={s.lineageName} />
        <ResultRow label="スピード" value={s.speed} />
        <ResultRow label="スタミナ" value={s.stamina} />
        <ResultRow label="パワー" value={s.power} />
        <ResultRow label="勝負根性" value={s.guts} />
        <ResultRow label="賢さ" value={s.wisdom} />
        <ResultRow label="健康" value={s.health} />
        <ResultRow label="因子" value={factorLabels || undefined} />
      </div>
    </div>
  );
}

function MareResultPreview({ result }: { result: OcrMareResult }) {
  const m = result.mare;
  const factorLabels = m.factors.map(f => FACTOR_TYPES[f as keyof typeof FACTOR_TYPES] ?? f).join(', ');
  return (
    <div className="flex flex-col gap-3">
      <ConfidenceBadge confidence={result.confidence} rawCount={result.raw.length} />
      <div className="flex flex-col gap-1.5">
        <ResultRow label="馬名" value={m.name} />
        <ResultRow label="系統名" value={m.lineageName} />
        <ResultRow label="スピード" value={m.speed} />
        <ResultRow label="スタミナ" value={m.stamina} />
        <ResultRow label="因子" value={factorLabels || undefined} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// 因子チェックボックス群
// ─────────────────────────────────────────
function FactorCheckboxes({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (key: string) => { onChange(value.includes(key) ? value.filter(k => k !== key) : [...value, key]); };
  return (
    <div className="flex flex-wrap gap-2 mt-1.5">
      {Object.entries(FACTOR_TYPES).map(([key, label]) => (
        <Label key={key} className={`
          flex items-center gap-1.5 cursor-pointer px-2.5 py-1.5 rounded-md border text-xs font-semibold select-none
          ${value.includes(key) ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}
        `}>
          <input type="checkbox" className="hidden" checked={value.includes(key)} onChange={() => toggle(key)} />
          {label}
        </Label>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────
// 幼駒登録フォーム
// ─────────────────────────────────────────
function FoalRegistrationForm({ ocrData, stallions, mares, onSuccess }: { ocrData: OcrFoalResult | null; stallions: Stallion[]; mares: Mare[]; onSuccess: () => void; }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => {
    if (!ocrData) return { name: '', birthYear: new Date().getFullYear(), gender: 'MALE', sireId: '', damId: '', kappaMark: 'NONE', mikaMark: 'NONE', growthType: '', bodyComment: '', memo: '' };
    const f = ocrData.foal;
    return {
      name: f.name || '', birthYear: f.birthYear || new Date().getFullYear(), gender: f.gender || 'MALE',
      sireId: stallions.find(s => f.sireName && s.name.includes(f.sireName.trim()))?.id?.toString() || '',
      damId: mares.find(m => f.damName && m.name.includes(f.damName.trim()))?.id?.toString() || '',
      kappaMark: f.kappaMark || 'NONE', mikaMark: f.mikaMark || 'NONE', growthType: f.growthType || '', bodyComment: f.bodyComment || '', memo: '',
    };
  });
  const mutation = useMutation({ mutationFn: (data: unknown) => api.foals.create(data), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['foals'] }); onSuccess(); } });
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [key]: e.target.value }));

  return (
    <div className="flex flex-col gap-4">
      <div className="text-xs text-slate-500 flex items-center gap-1.5 bg-slate-50 p-2 rounded-md">
        <Info className="w-4 h-4 text-indigo-500 flex-shrink-0" /> OCR で検出した値が自動入力されています。不足分を手動で補完してください。
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5"><Label>馬名</Label><Input value={form.name} onChange={set('name')} /></div>
        <div className="space-y-1.5"><Label>誕生年</Label><Input type="number" value={form.birthYear} onChange={set('birthYear')} /></div>
        <div className="space-y-1.5">
          <Label>性別 <span className="text-rose-500">*</span></Label>
          <select className={nativeSelectClass} value={form.gender} onChange={set('gender')}>
            <option value="MALE">牡</option>
            <option value="FEMALE">牝</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>成長型</Label>
          <select className={nativeSelectClass} value={form.growthType} onChange={set('growthType')}>
            <option value="">未設定</option>
            {Object.entries(GROWTH_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>父馬</Label>
          <select className={nativeSelectClass} value={form.sireId} onChange={set('sireId')}>
            <option value="">── 未設定 ──</option>
            {stallions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>母馬</Label>
          <select className={nativeSelectClass} value={form.damId} onChange={set('damId')}>
            <option value="">── 未設定 ──</option>
            {mares.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>河童木の印</Label>
          <select className={nativeSelectClass} value={form.kappaMark} onChange={set('kappaMark')}>
            {Object.entries(EVAL_MARKS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>美香の印</Label>
          <select className={nativeSelectClass} value={form.mikaMark} onChange={set('mikaMark')}>
            {Object.entries(EVAL_MARKS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div className="space-y-1.5"><Label>馬体コメント</Label><Textarea rows={2} value={form.bodyComment} onChange={set('bodyComment')} /></div>
      <div className="space-y-1.5"><Label>メモ</Label><Textarea rows={2} value={form.memo} onChange={set('memo')} /></div>
      
      <Button
        size="lg" className="w-full text-base font-bold"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate({
          name: form.name || null, birthYear: Number(form.birthYear), gender: form.gender,
          sireId: form.sireId ? Number(form.sireId) : null, damId: form.damId ? Number(form.damId) : null,
          kappaMark: form.kappaMark, mikaMark: form.mikaMark, growthType: form.growthType || null,
          bodyComment: form.bodyComment || null, memo: form.memo || null,
        })}>
        {mutation.isPending ? '登録中...' : '✓ 幼駒を登録する'}
      </Button>
      {mutation.isError && <div className="text-rose-500 text-sm bg-rose-50 p-2 rounded">{(mutation.error as Error)?.message}</div>}
    </div>
  );
}

// ─────────────────────────────────────────
// 種牡馬登録フォーム
// ─────────────────────────────────────────
function StallionRegistrationForm({ ocrData, childLineages, onSuccess }: { ocrData: OcrStallionResult | null; childLineages: ChildLineageWithParent[]; onSuccess: () => void; }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => {
    if (!ocrData) return { name: '', childLineageId: '', speed: '', stamina: '', power: '', guts: '', wisdom: '', health: '', factors: [] as string[], memo: '' };
    const s = ocrData.stallion;
    const matchedLineage = childLineages.find(l => s.lineageName && l.name.includes(s.lineageName.replace(/系$/, '').trim()) );
    return {
      name: s.name || '', childLineageId: matchedLineage?.id?.toString() || '',
      speed: s.speed?.toString() || '', stamina: s.stamina?.toString() || '', power: s.power?.toString() || '', guts: s.guts?.toString() || '', wisdom: s.wisdom?.toString() || '', health: s.health?.toString() || '',
      factors: s.factors || [], memo: '',
    };
  });
  const mutation = useMutation({ mutationFn: (data: unknown) => api.stallions.create(data), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['stallions'] }); onSuccess(); } });
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [key]: e.target.value }));

  return (
    <div className="flex flex-col gap-4">
      <div className="text-xs text-slate-500 flex items-center gap-1.5 bg-slate-50 p-2 rounded-md">
        <Info className="w-4 h-4 text-indigo-500 flex-shrink-0" /> OCR で検出した値が自動入力されています。不足分を手動で補完してください。
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5"><Label>馬名 <span className="text-rose-500">*</span></Label><Input value={form.name} onChange={set('name')} /></div>
        <div className="space-y-1.5">
          <Label>子系統 <span className="text-rose-500">*</span></Label>
          <select className={nativeSelectClass} value={form.childLineageId} onChange={set('childLineageId')}>
            <option value="">── 選択 ──</option>
            {childLineages.map(l => <option key={l.id} value={l.id}>{l.name}（{l.parentLineage?.name ?? '?'}系）</option>)}
          </select>
          {ocrData?.stallion.lineageName && !form.childLineageId && (
            <div className="text-[10px] text-amber-600 font-medium">※ OCR検出: "{ocrData.stallion.lineageName}" に合う系統を選択してください</div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {(['speed', 'stamina', 'power', 'guts', 'wisdom', 'health'] as const).map(key => (
          <div key={key} className="space-y-1.5">
            <Label className="text-xs">{{ speed: 'スピード', stamina: 'スタミナ', power: 'パワー', guts: '勝負根性', wisdom: '賢さ', health: '健康' }[key]}</Label>
            <Input type="number" min={0} max={100} value={form[key]} onChange={set(key)} placeholder="0-100" />
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label>因子</Label>
        <FactorCheckboxes value={form.factors} onChange={factors => setForm(f => ({ ...f, factors }))} />
      </div>
      <div className="space-y-1.5"><Label>メモ</Label><Textarea rows={2} value={form.memo} onChange={set('memo')} /></div>
      
      <Button
        size="lg" className="w-full text-base font-bold"
        disabled={mutation.isPending || !form.name || !form.childLineageId}
        onClick={() => mutation.mutate({
          name: form.name, childLineageId: Number(form.childLineageId),
          speed: form.speed ? Number(form.speed) : null, stamina: form.stamina ? Number(form.stamina) : null, power: form.power ? Number(form.power) : null, guts: form.guts ? Number(form.guts) : null, wisdom: form.wisdom ? Number(form.wisdom) : null, health: form.health ? Number(form.health) : null,
          factors: form.factors, memo: form.memo || null,
        })}>
        {mutation.isPending ? '登録中...' : '✓ 種牡馬を登録する'}
      </Button>
      {mutation.isError && <div className="text-rose-500 text-sm bg-rose-50 p-2 rounded">{(mutation.error as Error)?.message}</div>}
    </div>
  );
}

// ─────────────────────────────────────────
// 繁殖牝馬登録フォーム
// ─────────────────────────────────────────
function MareRegistrationForm({ ocrData, onSuccess }: { ocrData: OcrMareResult | null; onSuccess: () => void; }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => {
    if (!ocrData) return { name: '', lineage: '', speed: '', stamina: '', factors: [] as string[], memo: '' };
    const m = ocrData.mare;
    return { name: m.name || '', lineage: m.lineageName || '', speed: m.speed?.toString() || '', stamina: m.stamina?.toString() || '', factors: m.factors || [], memo: '' };
  });
  const mutation = useMutation({ mutationFn: (data: unknown) => api.mares.create(data), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['mares'] }); onSuccess(); } });
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [key]: e.target.value }));

  return (
    <div className="flex flex-col gap-4">
      <div className="text-xs text-slate-500 flex items-center gap-1.5 bg-slate-50 p-2 rounded-md">
        <Info className="w-4 h-4 text-indigo-500 flex-shrink-0" /> OCR で検出した値が自動入力されています。不足分を手動で補完してください。
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5"><Label>馬名 <span className="text-rose-500">*</span></Label><Input value={form.name} onChange={set('name')} /></div>
        <div className="space-y-1.5"><Label>系統名 <span className="text-rose-500">*</span></Label><Input value={form.lineage} onChange={set('lineage')} placeholder="例: ノーザンダンサー系" /></div>
        <div className="space-y-1.5"><Label>スピード</Label><Input type="number" min={0} max={100} value={form.speed} onChange={set('speed')} /></div>
        <div className="space-y-1.5"><Label>スタミナ</Label><Input type="number" min={0} max={100} value={form.stamina} onChange={set('stamina')} /></div>
      </div>
      <div className="space-y-1.5">
        <Label>因子</Label>
        <FactorCheckboxes value={form.factors} onChange={factors => setForm(f => ({ ...f, factors }))} />
      </div>
      <div className="space-y-1.5"><Label>メモ</Label><Textarea rows={2} value={form.memo} onChange={set('memo')} /></div>
      
      <Button
        size="lg" className="w-full text-base font-bold"
        disabled={mutation.isPending || !form.name || !form.lineage}
        onClick={() => mutation.mutate({
          name: form.name, lineage: form.lineage, speed: form.speed ? Number(form.speed) : null, stamina: form.stamina ? Number(form.stamina) : null,
          factors: form.factors, memo: form.memo || null,
        })}>
        {mutation.isPending ? '登録中...' : '✓ 繁殖牝馬を登録する'}
      </Button>
      {mutation.isError && <div className="text-rose-500 text-sm bg-rose-50 p-2 rounded">{(mutation.error as Error)?.message}</div>}
    </div>
  );
}

// ─────────────────────────────────────────
// メインページ
// ─────────────────────────────────────────

type Step = 'upload' | 'result' | 'register' | 'done';

export function OcrPage() {
  const [mode, setMode] = useState<OcrMode>('foal');
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const { data: stallions = [] } = useQuery({ queryKey: ['stallions'], queryFn: api.stallions.list });
  const { data: mares = [] } = useQuery({ queryKey: ['mares'], queryFn: api.mares.list });
  const { data: childLineages = [] } = useQuery({ queryKey: ['lineages-child'], queryFn: api.lineages.childList });

  const { data: ocrHealth } = useQuery({
    queryKey: ['ocr-health'], queryFn: checkOcrHealth, retry: false, refetchInterval: 30_000,
  });
  const ocrAvailable = ocrHealth?.status === 'ok';

  const ocrMutation = useMutation({
    mutationFn: () => runOcr(mode, file!),
    onSuccess: (data) => { setOcrResult(data); setStep('result'); },
  });

  const handleFile = useCallback((f: File) => { setFile(f); setPreviewUrl(URL.createObjectURL(f)); setOcrResult(null); setStep('upload'); }, []);
  const handleClear = useCallback(() => { setFile(null); setPreviewUrl(null); setOcrResult(null); setStep('upload'); }, []);
  const handleModeChange = (m: OcrMode) => { setMode(m); handleClear(); };
  const handleReset = () => { setStep('upload'); setFile(null); setPreviewUrl(null); setOcrResult(null); };

  const modeInfo = OCR_MODES.find(m => m.key === mode)!;
  const registerLabel = { foal: '幼駒登録', stallion: '種牡馬登録', mare: '繁殖牝馬登録' }[mode];
  const doneLabel    = { foal: '幼駒', stallion: '種牡馬', mare: '繁殖牝馬' }[mode];

  const steps = [
    { key: 'upload',   label: '画像アップロード' },
    { key: 'result',   label: 'OCR 結果確認' },
    { key: 'register', label: registerLabel },
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">OCR 自動入力</h1>
        <p className="text-slate-500 mt-1">ゲーム画面のスクリーンショットからデータを自動認識して登録します</p>
      </div>

      {/* OCR サービス状態 */}
      <div className={`p-3 rounded-md border flex items-center gap-2 text-sm font-semibold mb-2 ${ocrAvailable ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-rose-50 border-rose-200 text-rose-600'}`}>
        {ocrAvailable ? (
          <><CheckCircle className="w-4 h-4" /> OCR サービス稼働中</>
        ) : (
          <><AlertTriangle className="w-4 h-4" /> OCR サービス停止中 <span className="font-normal opacity-80 text-xs ml-2">docker-compose up -d ocr-service で起動してください</span></>
        )}
      </div>

      {/* モード切替タブ */}
      <div className="flex gap-2 mb-4 bg-slate-100 p-1.5 rounded-lg w-max">
        {OCR_MODES.map(m => (
          <button key={m.key} className={`px-4 py-1.5 rounded-md text-sm transition-all ${mode === m.key ? 'bg-white shadow-sm font-bold text-slate-900' : 'text-slate-500 hover:text-slate-700'}`} onClick={() => handleModeChange(m.key)}>
            {m.label}
          </button>
        ))}
      </div>

      {/* ステップナビ */}
      <div className="flex items-center gap-1 mb-8">
        {steps.map((s, i) => {
          const done = steps.findIndex(x => x.key === step) > i;
          const active = s.key === step || (step === 'done' && s.key === 'register');
          return (
            <div key={s.key} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${done || step === 'done' ? 'bg-indigo-600 text-white' : active ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'}`}>
                {done || step === 'done' ? '✓' : i + 1}
              </div>
              <span className={`text-xs font-bold transition-colors ${active || done || step === 'done' ? 'text-slate-800' : 'text-slate-400'}`}>{s.label}</span>
              {i < steps.length - 1 && <div className="w-6 h-px bg-slate-200 mx-2" />}
            </div>
          );
        })}
      </div>

      {step === 'done' ? (
        <Card className="text-center py-16 px-4 shadow-sm">
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">{doneLabel}を登録しました！</h2>
          <p className="text-slate-500 mb-8">管理画面で内容を確認できます</p>
          <Button onClick={handleReset} size="lg"><RefreshCw className="w-4 h-4 mr-2" /> もう一枚解析する</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          
          {/* 左: 画像エリア */}
          <div className="flex flex-col gap-4">
            <Card className="shadow-sm">
              <CardHeader className="py-4 border-b border-slate-100">
                <CardTitle className="text-base flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 opacity-70" /> スクリーンショット
                  <span className="text-xs font-normal text-slate-500 ml-2">({modeInfo.desc})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <DropZone onFile={handleFile} previewUrl={previewUrl} onClear={handleClear} mode={mode} />
              </CardContent>
            </Card>

            {file && step === 'upload' && (
              <Button size="lg" className="w-full text-base py-6 shadow-sm" disabled={ocrMutation.isPending || !ocrAvailable} onClick={() => ocrMutation.mutate()}>
                {ocrMutation.isPending ? <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3" /> OCR 解析中（数秒かかります）</> : <><Zap className="w-5 h-5 mr-2" /> OCR 解析開始</>}
              </Button>
            )}
            
            {ocrMutation.isError && (
              <div className="bg-rose-50 border border-rose-200 rounded-md p-3 text-rose-600 text-sm flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" /> {(ocrMutation.error as Error)?.message}
              </div>
            )}

            {/* 生テキスト表示 */}
            {ocrResult && (
              <Card className="shadow-sm overflow-hidden">
                <Button variant="ghost" className="w-full justify-start rounded-none h-12 border-b border-transparent" onClick={() => setShowRaw(r => !r)}>
                  <Eye className="w-4 h-4 mr-2 opacity-70" /> {showRaw ? '生テキストを閉じる' : 'OCR 生テキストを表示'}
                </Button>
                {showRaw && (
                  <div className="max-h-52 overflow-y-auto p-4 bg-slate-900 border-t border-slate-200">
                    {ocrResult.raw?.map((r, i) => (
                      <div key={i} className="py-1 border-b border-slate-800 text-[10px] text-slate-300 font-mono">
                        <span className="text-slate-500 mr-2">[{Math.round(r.confidence * 100)}%]</span> {r.text}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>

          {/* 右: OCR 結果 / 登録フォーム */}
          <div className="flex flex-col gap-4">
            {step === 'upload' && !file && (
              <Card className="min-h-[300px] flex items-center justify-center border-dashed shadow-none bg-slate-50/50">
                <div className="text-center text-slate-400">
                  <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">左に画像をアップロードすると<br/>OCR 結果が表示されます</p>
                </div>
              </Card>
            )}

            {step === 'result' && ocrResult && (
              <Card className="shadow-md border-indigo-100">
                <CardHeader className="py-4 border-b border-slate-100 bg-indigo-50/30 flex flex-row items-center justify-between">
                  <CardTitle className="text-base text-indigo-900">OCR 抽出結果</CardTitle>
                  <Button size="sm" className="h-8" onClick={() => setStep('register')}>この内容で登録 →</Button>
                </CardHeader>
                <CardContent className="p-5">
                  {mode === 'foal' && <FoalResultPreview result={ocrResult as OcrFoalResult} />}
                  {mode === 'stallion' && <StallionResultPreview result={ocrResult as OcrStallionResult} />}
                  {mode === 'mare' && <MareResultPreview result={ocrResult as OcrMareResult} />}
                </CardContent>
              </Card>
            )}

            {step === 'register' && (
              <Card className="shadow-md border-indigo-200">
                <CardHeader className="py-4 border-b border-slate-100 bg-indigo-50/50 flex flex-row items-center justify-between">
                  <CardTitle className="text-base text-indigo-900">{registerLabel}</CardTitle>
                  <Button variant="outline" size="sm" className="h-8 bg-white" onClick={() => setStep('result')}>← 戻る</Button>
                </CardHeader>
                <CardContent className="p-5">
                  {mode === 'foal' && <FoalRegistrationForm ocrData={ocrResult as OcrFoalResult} stallions={stallions} mares={mares} onSuccess={() => setStep('done')} />}
                  {mode === 'stallion' && <StallionRegistrationForm ocrData={ocrResult as OcrStallionResult} childLineages={childLineages} onSuccess={() => setStep('done')} />}
                  {mode === 'mare' && <MareRegistrationForm ocrData={ocrResult as OcrMareResult} onSuccess={() => setStep('done')} />}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
