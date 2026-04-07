import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Upload, Image as ImageIcon, Zap, CheckCircle,
  AlertTriangle, RefreshCw, X, Info, Eye,
} from 'lucide-react';
import { EVAL_MARKS, GROWTH_TYPES, GENDERS, FACTOR_TYPES } from '@winpost/shared';
import type { Stallion, Mare, ChildLineageWithParent } from '@winpost/shared';

// ─────────────────────────────────────────
// OCR モード
// ─────────────────────────────────────────

type OcrMode = 'foal' | 'stallion' | 'mare';

const OCR_MODES: { key: OcrMode; label: string; desc: string }[] = [
  { key: 'foal',    label: '幼駒',      desc: '幼駒評価画面' },
  { key: 'stallion', label: '種牡馬',   desc: '種牡馬情報画面' },
  { key: 'mare',    label: '繁殖牝馬',  desc: '繁殖牝馬情報画面' },
];

// ─────────────────────────────────────────
// レスポンス型
// ─────────────────────────────────────────

interface OcrRawItem {
  text: string;
  confidence: number;
}

interface OcrFoalData {
  name?: string;
  gender?: string;
  birthYear?: number;
  sireName?: string;
  damName?: string;
  kappaMark?: string;
  mikaMark?: string;
  growthType?: string;
  bodyComment?: string;
}

interface OcrStallionData {
  name?: string;
  lineageName?: string;
  speed?: number;
  stamina?: number;
  power?: number;
  guts?: number;
  wisdom?: number;
  health?: number;
  factors: string[];
}

interface OcrMareData {
  name?: string;
  lineageName?: string;
  speed?: number;
  stamina?: number;
  factors: string[];
}

interface OcrFoalResult   { foal: OcrFoalData;       confidence: number; raw: OcrRawItem[]; }
interface OcrStallionResult { stallion: OcrStallionData; confidence: number; raw: OcrRawItem[]; }
interface OcrMareResult   { mare: OcrMareData;        confidence: number; raw: OcrRawItem[]; }

type OcrResult = OcrFoalResult | OcrStallionResult | OcrMareResult;

// ─────────────────────────────────────────
// OCR API
// ─────────────────────────────────────────

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

function DropZone({
  onFile, previewUrl, onClear, mode,
}: {
  onFile: (f: File) => void;
  previewUrl: string | null;
  onClear: () => void;
  mode: OcrMode;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) onFile(file);
  }, [onFile]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'));
    if (item) {
      const file = item.getAsFile();
      if (file) onFile(file);
    }
  }, [onFile]);

  const modeDesc = OCR_MODES.find(m => m.key === mode)?.desc ?? '';

  if (previewUrl) {
    return (
      <div style={{ position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <img
          src={previewUrl}
          alt="アップロード画像"
          style={{ width: '100%', maxHeight: 320, objectFit: 'contain', background: '#000' }}
        />
        <button
          onClick={onClear}
          style={{
            position: 'absolute', top: 8, right: 8,
            background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%',
            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#fff',
          }}>
          <X style={{ width: 16, height: 16 }} />
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
      style={{
        border: `2px dashed ${dragging ? 'var(--color-accent-primary)' : 'var(--color-border)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '48px 24px',
        textAlign: 'center',
        cursor: 'pointer',
        background: dragging ? 'rgba(99,102,241,0.05)' : 'var(--color-bg-input)',
        transition: 'all 0.2s',
        outline: 'none',
      }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      <Upload style={{ width: 40, height: 40, color: 'var(--color-text-muted)', marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
      <div style={{ fontWeight: 600, marginBottom: 6 }}>
        ドロップ / クリック / Ctrl+V で貼り付け
      </div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
        ウイニングポスト10 の{modeDesc}をスクリーンショットしてください<br />
        PNG / JPEG / WebP 対応 (最大 10MB)
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// 信頼度バー（共通）
// ─────────────────────────────────────────

function ConfidenceBadge({ confidence, rawCount }: { confidence: number; rawCount: number }) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
  const bg   = pct >= 70 ? 'rgba(16,185,129,0.1)' : pct >= 40 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)';
  const border = pct >= 70 ? 'rgba(16,185,129,0.3)' : pct >= 40 ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius-md)', background: bg, border: `1px solid ${border}` }}>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{pct}%</div>
      <div>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>認識精度</div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{rawCount} テキストブロック検出</div>
      </div>
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value: string | number | undefined }) {
  const display = value !== undefined && value !== null && value !== '' ? String(value) : undefined;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 12px', borderRadius: 'var(--radius-sm)',
      background: display ? 'rgba(99,102,241,0.08)' : 'var(--color-bg-input)',
      border: `1px solid ${display ? 'rgba(99,102,241,0.2)' : 'var(--color-border)'}`,
    }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', width: 100, flexShrink: 0 }}>{label}</span>
      {display
        ? <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>{display}</span>
        : <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>未検出</span>
      }
    </div>
  );
}

// ─────────────────────────────────────────
// 幼駒 OCR 結果プレビュー
// ─────────────────────────────────────────

function FoalResultPreview({ result }: { result: OcrFoalResult }) {
  const f = result.foal;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ConfidenceBadge confidence={result.confidence} rawCount={result.raw.length} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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

// ─────────────────────────────────────────
// 種牡馬 OCR 結果プレビュー
// ─────────────────────────────────────────

function StallionResultPreview({ result }: { result: OcrStallionResult }) {
  const s = result.stallion;
  const factorLabels = s.factors.map(f => FACTOR_TYPES[f as keyof typeof FACTOR_TYPES] ?? f).join(', ');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ConfidenceBadge confidence={result.confidence} rawCount={result.raw.length} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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

// ─────────────────────────────────────────
// 繁殖牝馬 OCR 結果プレビュー
// ─────────────────────────────────────────

function MareResultPreview({ result }: { result: OcrMareResult }) {
  const m = result.mare;
  const factorLabels = m.factors.map(f => FACTOR_TYPES[f as keyof typeof FACTOR_TYPES] ?? f).join(', ');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ConfidenceBadge confidence={result.confidence} rawCount={result.raw.length} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
// 因子チェックボックス群（共通）
// ─────────────────────────────────────────

function FactorCheckboxes({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (key: string) => {
    onChange(value.includes(key) ? value.filter(k => k !== key) : [...value, key]);
  };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {Object.entries(FACTOR_TYPES).map(([key, label]) => (
        <label key={key} style={{
          display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
          padding: '4px 10px', borderRadius: 'var(--radius-sm)',
          background: value.includes(key) ? 'rgba(99,102,241,0.15)' : 'var(--color-bg-input)',
          border: `1px solid ${value.includes(key) ? 'rgba(99,102,241,0.4)' : 'var(--color-border)'}`,
          fontSize: 'var(--text-xs)', fontWeight: 600,
          color: value.includes(key) ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
        }}>
          <input type="checkbox" style={{ display: 'none' }} checked={value.includes(key)} onChange={() => toggle(key)} />
          {label}
        </label>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────
// 幼駒登録フォーム
// ─────────────────────────────────────────

const DEFAULT_FOAL_FORM = {
  name: '', birthYear: new Date().getFullYear(), gender: 'MALE',
  sireId: '', damId: '', kappaMark: 'NONE', mikaMark: 'NONE',
  growthType: '', bodyComment: '', memo: '',
};

function FoalRegistrationForm({
  ocrData, stallions, mares, onSuccess,
}: {
  ocrData: OcrFoalResult | null;
  stallions: Stallion[];
  mares: Mare[];
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => {
    if (!ocrData) return DEFAULT_FOAL_FORM;
    const f = ocrData.foal;
    return {
      name: f.name || '',
      birthYear: f.birthYear || new Date().getFullYear(),
      gender: f.gender || 'MALE',
      sireId: stallions.find(s => f.sireName && s.name.includes(f.sireName.trim()))?.id?.toString() || '',
      damId: mares.find(m => f.damName && m.name.includes(f.damName.trim()))?.id?.toString() || '',
      kappaMark: f.kappaMark || 'NONE',
      mikaMark: f.mikaMark || 'NONE',
      growthType: f.growthType || '',
      bodyComment: f.bodyComment || '',
      memo: '',
    };
  });

  const mutation = useMutation({
    mutationFn: (data: unknown) => api.foals.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['foals'] }); onSuccess(); },
  });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Info style={{ width: 14, height: 14 }} />
        OCR で検出した値が自動入力されています。不足分を手動で補完してください。
      </div>
      <div className="form-row">
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">馬名</label>
          <input className="form-input" value={form.name} onChange={set('name')} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">誕生年</label>
          <input className="form-input" type="number" value={form.birthYear} onChange={set('birthYear')} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">性別 <span style={{ color: 'var(--color-accent-danger)' }}>*</span></label>
          <select className="form-select" value={form.gender} onChange={set('gender')}>
            <option value="MALE">牡</option>
            <option value="FEMALE">牝</option>
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">成長型</label>
          <select className="form-select" value={form.growthType} onChange={set('growthType')}>
            <option value="">未設定</option>
            {Object.entries(GROWTH_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">父馬</label>
          <select className="form-select" value={form.sireId} onChange={set('sireId')}>
            <option value="">── 未設定 ──</option>
            {stallions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">母馬</label>
          <select className="form-select" value={form.damId} onChange={set('damId')}>
            <option value="">── 未設定 ──</option>
            {mares.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">河童木の印</label>
          <select className="form-select" value={form.kappaMark} onChange={set('kappaMark')}>
            {Object.entries(EVAL_MARKS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">美香の印</label>
          <select className="form-select" value={form.mikaMark} onChange={set('mikaMark')}>
            {Object.entries(EVAL_MARKS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">馬体コメント</label>
        <textarea className="form-textarea" rows={2} value={form.bodyComment} onChange={set('bodyComment')} />
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">メモ</label>
        <textarea className="form-textarea" rows={2} value={form.memo} onChange={set('memo')} />
      </div>
      <button
        className="btn btn-primary btn-lg"
        style={{ width: '100%' }}
        disabled={mutation.isPending}
        onClick={() => mutation.mutate({
          name: form.name || null,
          birthYear: Number(form.birthYear),
          gender: form.gender,
          sireId: form.sireId ? Number(form.sireId) : null,
          damId: form.damId ? Number(form.damId) : null,
          kappaMark: form.kappaMark,
          mikaMark: form.mikaMark,
          growthType: form.growthType || null,
          bodyComment: form.bodyComment || null,
          memo: form.memo || null,
        })}>
        {mutation.isPending ? '登録中...' : '✓ 幼駒を登録する'}
      </button>
      {mutation.isError && (
        <div style={{ color: 'var(--color-accent-danger)', fontSize: 'var(--text-sm)' }}>
          登録に失敗しました: {(mutation.error as Error)?.message}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// 種牡馬登録フォーム
// ─────────────────────────────────────────

const DEFAULT_STALLION_FORM = {
  name: '', childLineageId: '',
  speed: '', stamina: '', power: '', guts: '', wisdom: '', health: '',
  factors: [] as string[], memo: '',
};

function StallionRegistrationForm({
  ocrData, childLineages, onSuccess,
}: {
  ocrData: OcrStallionResult | null;
  childLineages: ChildLineageWithParent[];
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => {
    if (!ocrData) return DEFAULT_STALLION_FORM;
    const s = ocrData.stallion;
    const matchedLineage = childLineages.find(l =>
      s.lineageName && l.name.includes(s.lineageName.replace(/系$/, '').trim())
    );
    return {
      name: s.name || '',
      childLineageId: matchedLineage?.id?.toString() || '',
      speed: s.speed?.toString() || '',
      stamina: s.stamina?.toString() || '',
      power: s.power?.toString() || '',
      guts: s.guts?.toString() || '',
      wisdom: s.wisdom?.toString() || '',
      health: s.health?.toString() || '',
      factors: s.factors || [],
      memo: '',
    };
  });

  const mutation = useMutation({
    mutationFn: (data: unknown) => api.stallions.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['stallions'] }); onSuccess(); },
  });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Info style={{ width: 14, height: 14 }} />
        OCR で検出した値が自動入力されています。不足分を手動で補完してください。
      </div>
      <div className="form-row">
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">馬名 <span style={{ color: 'var(--color-accent-danger)' }}>*</span></label>
          <input className="form-input" value={form.name} onChange={set('name')} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">子系統 <span style={{ color: 'var(--color-accent-danger)' }}>*</span></label>
          <select className="form-select" value={form.childLineageId} onChange={set('childLineageId')}>
            <option value="">── 選択 ──</option>
            {childLineages.map(l => (
              <option key={l.id} value={l.id}>{l.name}（{l.parentLineage?.name ?? '?'}系）</option>
            ))}
          </select>
          {ocrData?.stallion.lineageName && !form.childLineageId && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 4 }}>
              OCR 検出: "{ocrData.stallion.lineageName}" — 一致する系統を選択してください
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {(['speed', 'stamina', 'power', 'guts', 'wisdom', 'health'] as const).map(key => (
          <div key={key} className="form-group" style={{ margin: 0 }}>
            <label className="form-label">
              {{ speed: 'スピード', stamina: 'スタミナ', power: 'パワー', guts: '勝負根性', wisdom: '賢さ', health: '健康' }[key]}
            </label>
            <input
              className="form-input"
              type="number"
              min={0}
              max={100}
              value={form[key]}
              onChange={set(key)}
              placeholder="0-100"
            />
          </div>
        ))}
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">因子</label>
        <FactorCheckboxes value={form.factors} onChange={factors => setForm(f => ({ ...f, factors }))} />
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">メモ</label>
        <textarea className="form-textarea" rows={2} value={form.memo} onChange={set('memo')} />
      </div>
      <button
        className="btn btn-primary btn-lg"
        style={{ width: '100%' }}
        disabled={mutation.isPending || !form.name || !form.childLineageId}
        onClick={() => mutation.mutate({
          name: form.name,
          childLineageId: Number(form.childLineageId),
          speed: form.speed ? Number(form.speed) : null,
          stamina: form.stamina ? Number(form.stamina) : null,
          power: form.power ? Number(form.power) : null,
          guts: form.guts ? Number(form.guts) : null,
          wisdom: form.wisdom ? Number(form.wisdom) : null,
          health: form.health ? Number(form.health) : null,
          factors: form.factors,
          memo: form.memo || null,
        })}>
        {mutation.isPending ? '登録中...' : '✓ 種牡馬を登録する'}
      </button>
      {mutation.isError && (
        <div style={{ color: 'var(--color-accent-danger)', fontSize: 'var(--text-sm)' }}>
          登録に失敗しました: {(mutation.error as Error)?.message}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// 繁殖牝馬登録フォーム
// ─────────────────────────────────────────

const DEFAULT_MARE_FORM = {
  name: '', lineage: '',
  speed: '', stamina: '',
  factors: [] as string[], memo: '',
};

function MareRegistrationForm({
  ocrData, onSuccess,
}: {
  ocrData: OcrMareResult | null;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => {
    if (!ocrData) return DEFAULT_MARE_FORM;
    const m = ocrData.mare;
    return {
      name: m.name || '',
      lineage: m.lineageName || '',
      speed: m.speed?.toString() || '',
      stamina: m.stamina?.toString() || '',
      factors: m.factors || [],
      memo: '',
    };
  });

  const mutation = useMutation({
    mutationFn: (data: unknown) => api.mares.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['mares'] }); onSuccess(); },
  });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Info style={{ width: 14, height: 14 }} />
        OCR で検出した値が自動入力されています。不足分を手動で補完してください。
      </div>
      <div className="form-row">
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">馬名 <span style={{ color: 'var(--color-accent-danger)' }}>*</span></label>
          <input className="form-input" value={form.name} onChange={set('name')} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">系統名 <span style={{ color: 'var(--color-accent-danger)' }}>*</span></label>
          <input className="form-input" value={form.lineage} onChange={set('lineage')} placeholder="例: ノーザンダンサー系" />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">スピード</label>
          <input className="form-input" type="number" min={0} max={100} value={form.speed} onChange={set('speed')} placeholder="0-100" />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">スタミナ</label>
          <input className="form-input" type="number" min={0} max={100} value={form.stamina} onChange={set('stamina')} placeholder="0-100" />
        </div>
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">因子</label>
        <FactorCheckboxes value={form.factors} onChange={factors => setForm(f => ({ ...f, factors }))} />
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">メモ</label>
        <textarea className="form-textarea" rows={2} value={form.memo} onChange={set('memo')} />
      </div>
      <button
        className="btn btn-primary btn-lg"
        style={{ width: '100%' }}
        disabled={mutation.isPending || !form.name || !form.lineage}
        onClick={() => mutation.mutate({
          name: form.name,
          lineage: form.lineage,
          speed: form.speed ? Number(form.speed) : null,
          stamina: form.stamina ? Number(form.stamina) : null,
          factors: form.factors,
          memo: form.memo || null,
        })}>
        {mutation.isPending ? '登録中...' : '✓ 繁殖牝馬を登録する'}
      </button>
      {mutation.isError && (
        <div style={{ color: 'var(--color-accent-danger)', fontSize: 'var(--text-sm)' }}>
          登録に失敗しました: {(mutation.error as Error)?.message}
        </div>
      )}
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
    queryKey: ['ocr-health'],
    queryFn: checkOcrHealth,
    retry: false,
    refetchInterval: 30_000,
  });
  const ocrAvailable = ocrHealth?.status === 'ok';

  const ocrMutation = useMutation({
    mutationFn: () => runOcr(mode, file!),
    onSuccess: (data) => { setOcrResult(data); setStep('result'); },
  });

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setOcrResult(null);
    setStep('upload');
  }, []);

  const handleClear = useCallback(() => {
    setFile(null);
    setPreviewUrl(null);
    setOcrResult(null);
    setStep('upload');
  }, []);

  const handleModeChange = (m: OcrMode) => {
    setMode(m);
    handleClear();
  };

  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setPreviewUrl(null);
    setOcrResult(null);
  };

  const modeInfo = OCR_MODES.find(m => m.key === mode)!;
  const registerLabel = { foal: '幼駒登録', stallion: '種牡馬登録', mare: '繁殖牝馬登録' }[mode];
  const doneLabel    = { foal: '幼駒', stallion: '種牡馬', mare: '繁殖牝馬' }[mode];

  const steps = [
    { key: 'upload',   label: '画像アップロード' },
    { key: 'result',   label: 'OCR 結果確認' },
    { key: 'register', label: registerLabel },
  ];

  return (
    <>
      <div className="page-header">
        <h1>OCR 自動入力</h1>
        <p>ゲーム画面のスクリーンショットからデータを自動認識して登録します</p>
      </div>
      <div className="page-body">

        {/* OCR サービス状態 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
          padding: '8px 14px', borderRadius: 'var(--radius-md)',
          background: ocrAvailable ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${ocrAvailable ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          fontSize: 'var(--text-sm)',
        }}>
          {ocrAvailable ? (
            <><CheckCircle style={{ width: 16, height: 16, color: '#10b981' }} />
              <span style={{ color: '#10b981', fontWeight: 600 }}>OCR サービス稼働中</span></>
          ) : (
            <><AlertTriangle style={{ width: 16, height: 16, color: '#ef4444' }} />
              <span style={{ color: '#ef4444', fontWeight: 600 }}>OCR サービス停止中</span>
              <span style={{ color: 'var(--color-text-muted)', marginLeft: 8 }}>
                docker compose up -d ocr-service で起動してください
              </span></>
          )}
        </div>

        {/* モード切替タブ */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {OCR_MODES.map(m => (
            <button
              key={m.key}
              className={`btn btn-sm ${mode === m.key ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => handleModeChange(m.key)}
              style={{ fontWeight: mode === m.key ? 700 : 400 }}>
              {m.label}
            </button>
          ))}
        </div>

        {/* ステップナビ */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 28 }}>
          {steps.map((s, i) => {
            const done = steps.findIndex(x => x.key === step) > i;
            const active = s.key === step || (step === 'done' && s.key === 'register');
            return (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 12,
                  background: done || step === 'done' ? 'var(--color-accent-primary)' : active ? 'rgba(99,102,241,0.3)' : 'var(--color-bg-input)',
                  color: done || step === 'done' ? '#fff' : active ? 'var(--color-accent-primary)' : 'var(--color-text-muted)',
                }}>
                  {done || step === 'done' ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                  {s.label}
                </span>
                {i < steps.length - 1 && <div style={{ width: 24, height: 1, background: 'var(--color-border)', margin: '0 4px' }} />}
              </div>
            );
          })}
        </div>

        {step === 'done' ? (
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <CheckCircle style={{ width: 56, height: 56, color: '#10b981', margin: '0 auto 16px' }} />
            <h2 style={{ marginBottom: 8 }}>{doneLabel}を登録しました！</h2>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: 24 }}>管理画面で内容を確認できます</p>
            <button className="btn btn-primary" onClick={handleReset}>
              <RefreshCw /> もう一枚解析する
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'start' }}>

            {/* 左: 画像エリア */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card">
                <div className="card-header" style={{ marginBottom: 12 }}>
                  <h2 className="card-title" style={{ fontSize: 'var(--text-base)' }}>
                    <ImageIcon style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
                    スクリーンショット
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 8 }}>
                      ({modeInfo.desc})
                    </span>
                  </h2>
                </div>
                <DropZone onFile={handleFile} previewUrl={previewUrl} onClear={handleClear} mode={mode} />
              </div>

              {file && step === 'upload' && (
                <button
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%' }}
                  disabled={ocrMutation.isPending || !ocrAvailable}
                  onClick={() => ocrMutation.mutate()}>
                  {ocrMutation.isPending
                    ? <><div className="loading-spinner" style={{ width: 18, height: 18 }} /> OCR 解析中（数秒かかります）</>
                    : <><Zap /> OCR 解析開始</>
                  }
                </button>
              )}

              {ocrMutation.isError && (
                <div style={{
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 'var(--radius-md)', padding: '10px 14px',
                  color: '#ef4444', fontSize: 'var(--text-sm)',
                }}>
                  <AlertTriangle style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6, width: 16, height: 16 }} />
                  {(ocrMutation.error as Error)?.message}
                </div>
              )}

              {/* 生テキスト表示 */}
              {ocrResult && (
                <div className="card">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowRaw(r => !r)}
                    style={{ width: '100%', justifyContent: 'flex-start', marginBottom: showRaw ? 8 : 0 }}>
                    <Eye style={{ width: 14, height: 14 }} />
                    {showRaw ? '生テキストを閉じる' : 'OCR 生テキストを表示'}
                  </button>
                  {showRaw && (
                    <div style={{ maxHeight: 200, overflowY: 'auto', fontSize: 11, color: 'var(--color-text-secondary)' }}>
                      {(ocrResult as OcrFoalResult).raw?.map((r, i) => (
                        <div key={i} style={{ padding: '2px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                          <span style={{ opacity: 0.5 }}>[{Math.round(r.confidence * 100)}%]</span> {r.text}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 右: OCR 結果 / 登録フォーム */}
            <div>
              {step === 'upload' && !file && (
                <div className="card" style={{ minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
                  <ImageIcon style={{ width: 48, height: 48, color: 'var(--color-text-muted)', opacity: 0.3 }} />
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                    左に画像をアップロードすると OCR 結果が表示されます
                  </p>
                </div>
              )}

              {step === 'result' && ocrResult && (
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="card-header" style={{ marginBottom: 8 }}>
                    <h2 className="card-title" style={{ fontSize: 'var(--text-base)' }}>OCR 抽出結果</h2>
                    <button className="btn btn-primary btn-sm" onClick={() => setStep('register')}>
                      この内容で登録 →
                    </button>
                  </div>
                  {mode === 'foal'     && <FoalResultPreview    result={ocrResult as OcrFoalResult} />}
                  {mode === 'stallion' && <StallionResultPreview result={ocrResult as OcrStallionResult} />}
                  {mode === 'mare'     && <MareResultPreview     result={ocrResult as OcrMareResult} />}
                </div>
              )}

              {step === 'register' && (
                <div className="card">
                  <div className="card-header" style={{ marginBottom: 12 }}>
                    <h2 className="card-title" style={{ fontSize: 'var(--text-base)' }}>{registerLabel}</h2>
                    <button className="btn btn-ghost btn-sm" onClick={() => setStep('result')}>
                      ← 戻る
                    </button>
                  </div>
                  {mode === 'foal' && (
                    <FoalRegistrationForm
                      ocrData={ocrResult as OcrFoalResult}
                      stallions={stallions}
                      mares={mares}
                      onSuccess={() => setStep('done')}
                    />
                  )}
                  {mode === 'stallion' && (
                    <StallionRegistrationForm
                      ocrData={ocrResult as OcrStallionResult}
                      childLineages={childLineages}
                      onSuccess={() => setStep('done')}
                    />
                  )}
                  {mode === 'mare' && (
                    <MareRegistrationForm
                      ocrData={ocrResult as OcrMareResult}
                      onSuccess={() => setStep('done')}
                    />
                  )}
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </>
  );
}
