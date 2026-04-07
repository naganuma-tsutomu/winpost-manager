import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Upload, Image as ImageIcon, Zap, CheckCircle,
  AlertTriangle, RefreshCw, X, Info, Eye,
} from 'lucide-react';
import { EVAL_MARKS, GROWTH_TYPES, GENDERS } from '@winpost/shared';

// ─────────────────────────────────────────
// OCR API クライアント（api.ts 未追加分）
// ─────────────────────────────────────────

async function checkOcrHealth() {
  const res = await fetch('/api/ocr/health');
  return res.json();
}

async function runOcrFoal(file: File): Promise<any> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/ocr/foal', { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'OCR に失敗しました' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─────────────────────────────────────────
// ドロップゾーン
// ─────────────────────────────────────────

function DropZone({
  onFile, previewUrl, onClear,
}: {
  onFile: (f: File) => void;
  previewUrl: string | null;
  onClear: () => void;
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
        ウイニングポスト10 の幼駒評価画面をスクリーンショットしてください<br />
        PNG / JPEG / WebP 対応 (最大 10MB)
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// OCR 結果プレビュー
// ─────────────────────────────────────────

function OcrResultPreview({ result }: { result: any }) {
  const foal = result.foal;
  const confidence = Math.round(result.confidence * 100);

  const rows: { label: string; value: string | undefined }[] = [
    { label: '馬名', value: foal.name },
    { label: '性別', value: foal.gender ? GENDERS[foal.gender as keyof typeof GENDERS] : undefined },
    { label: '誕生年', value: foal.birthYear?.toString() },
    { label: '父馬', value: foal.sireName },
    { label: '母馬', value: foal.damName },
    { label: '河童木の印', value: foal.kappaMark ? EVAL_MARKS[foal.kappaMark as keyof typeof EVAL_MARKS] : undefined },
    { label: '美香の印', value: foal.mikaMark ? EVAL_MARKS[foal.mikaMark as keyof typeof EVAL_MARKS] : undefined },
    { label: '成長型', value: foal.growthType ? GROWTH_TYPES[foal.growthType as keyof typeof GROWTH_TYPES] : undefined },
    { label: '馬体コメント', value: foal.bodyComment },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 信頼度 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', borderRadius: 'var(--radius-md)',
        background: confidence >= 70 ? 'rgba(16,185,129,0.1)' : confidence >= 40 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
        border: `1px solid ${confidence >= 70 ? 'rgba(16,185,129,0.3)' : confidence >= 40 ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}`,
      }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: confidence >= 70 ? '#10b981' : confidence >= 40 ? '#f59e0b' : '#ef4444' }}>
          {confidence}%
        </div>
        <div>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
            認識精度
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {result.raw.length} テキストブロック検出
          </div>
        </div>
      </div>

      {/* 抽出データ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map(r => (
          <div key={r.label} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 12px', borderRadius: 'var(--radius-sm)',
            background: r.value ? 'rgba(99,102,241,0.08)' : 'var(--color-bg-input)',
            border: `1px solid ${r.value ? 'rgba(99,102,241,0.2)' : 'var(--color-border)'}`,
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', width: 90, flexShrink: 0 }}>
              {r.label}
            </span>
            {r.value ? (
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {r.value}
              </span>
            ) : (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                未検出
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// 幼駒登録フォーム（OCR 結果から自動補完）
// ─────────────────────────────────────────

const DEFAULT_FORM = {
  name: '',
  birthYear: new Date().getFullYear(),
  gender: 'MALE',
  sireId: '',
  damId: '',
  kappaMark: 'NONE',
  mikaMark: 'NONE',
  growthType: '',
  bodyComment: '',
  memo: '',
};

function FoalRegistrationForm({
  ocrData,
  stallions,
  mares,
  onSuccess,
}: {
  ocrData: any;
  stallions: any[];
  mares: any[];
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => {
    if (!ocrData) return DEFAULT_FORM;
    // OCR データで初期値を補完
    const foal = ocrData.foal;
    const matchedSire = stallions.find((s: any) =>
      foal.sireName && s.name.includes(foal.sireName.trim())
    );
    const matchedMare = mares.find((m: any) =>
      foal.damName && m.name.includes(foal.damName.trim())
    );
    return {
      name: foal.name || '',
      birthYear: foal.birthYear || new Date().getFullYear(),
      gender: foal.gender || 'MALE',
      sireId: matchedSire?.id?.toString() || '',
      damId: matchedMare?.id?.toString() || '',
      kappaMark: foal.kappaMark || 'NONE',
      mikaMark: foal.mikaMark || 'NONE',
      growthType: foal.growthType || '',
      bodyComment: foal.bodyComment || '',
      memo: '',
    };
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.foals.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foals'] });
      onSuccess();
    },
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
          <input className="form-input" value={form.name} onChange={set('name')} placeholder="未入力OK" />
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
            {stallions.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">母馬</label>
          <select className="form-select" value={form.damId} onChange={set('damId')}>
            <option value="">── 未設定 ──</option>
            {mares.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">🎯 河童木の印</label>
          <select className="form-select" value={form.kappaMark} onChange={set('kappaMark')}>
            {Object.entries(EVAL_MARKS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">💄 美香の印</label>
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
        <textarea className="form-textarea" rows={2} value={form.memo} onChange={set('memo')} placeholder="自由記入..." />
      </div>

      <button
        className="btn btn-primary btn-lg"
        style={{ width: '100%' }}
        disabled={createMutation.isPending}
        onClick={() => createMutation.mutate({
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
        {createMutation.isPending ? '登録中...' : '✓ 幼駒を登録する'}
      </button>

      {createMutation.isError && (
        <div style={{ color: 'var(--color-accent-danger)', fontSize: 'var(--text-sm)' }}>
          登録に失敗しました: {(createMutation.error as any)?.message}
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
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [showRaw, setShowRaw] = useState(false);

  const { data: stallions = [] } = useQuery({ queryKey: ['stallions'], queryFn: api.stallions.list });
  const { data: mares = [] } = useQuery({ queryKey: ['mares'], queryFn: api.mares.list });

  // OCR サービスの状態確認
  const { data: ocrHealth } = useQuery({
    queryKey: ['ocr-health'],
    queryFn: checkOcrHealth,
    retry: false,
    refetchInterval: 30_000,
  });
  const ocrAvailable = ocrHealth?.status === 'ok';

  const ocrMutation = useMutation({
    mutationFn: () => runOcrFoal(file!),
    onSuccess: (data) => {
      setOcrResult(data);
      setStep('result');
    },
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

  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setPreviewUrl(null);
    setOcrResult(null);
  };

  const steps = [
    { key: 'upload', label: '画像アップロード' },
    { key: 'result', label: 'OCR 結果確認' },
    { key: 'register', label: '幼駒登録' },
  ];

  return (
    <>
      <div className="page-header">
        <h1>OCR 自動入力</h1>
        <p>ゲーム画面のスクリーンショットから幼駒データを自動認識して登録します</p>
      </div>
      <div className="page-body">

        {/* OCR サービス状態 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24,
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
          /* 完了画面 */
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <CheckCircle style={{ width: 56, height: 56, color: '#10b981', margin: '0 auto 16px' }} />
            <h2 style={{ marginBottom: 8 }}>幼駒を登録しました！</h2>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: 24 }}>幼駒管理画面で内容を確認できます</p>
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
                  </h2>
                </div>
                <DropZone onFile={handleFile} previewUrl={previewUrl} onClear={handleClear} />
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
                  {(ocrMutation.error as any)?.message}
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
                      {ocrResult.raw?.map((r: any, i: number) => (
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
                  <OcrResultPreview result={ocrResult} />
                </div>
              )}

              {step === 'register' && (
                <div className="card">
                  <div className="card-header" style={{ marginBottom: 12 }}>
                    <h2 className="card-title" style={{ fontSize: 'var(--text-base)' }}>幼駒登録</h2>
                    <button className="btn btn-ghost btn-sm" onClick={() => setStep('result')}>
                      ← 戻る
                    </button>
                  </div>
                  <FoalRegistrationForm
                    ocrData={ocrResult}
                    stallions={stallions}
                    mares={mares}
                    onSuccess={() => setStep('done')}
                  />
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </>
  );
}
