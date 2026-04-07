import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { BreedingCalculateResponse, BreedingResult, BreedingTheory } from '@winpost/shared';
import {
  Zap, AlertTriangle, CheckCircle, Info,
  ChevronRight, Flame, Shield,
} from 'lucide-react';

// ─────────────────────────────────────────
// 爆発力ランク表示
// ─────────────────────────────────────────

const rankConfig: Record<string, { bg: string; text: string; label: string }> = {
  'S+': { bg: 'linear-gradient(135deg,#f59e0b,#ef4444)', text: '#fff', label: 'S+' },
  'S':  { bg: 'linear-gradient(135deg,#6366f1,#8b5cf6)', text: '#fff', label: 'S'  },
  'A':  { bg: 'rgba(239,68,68,0.2)',   text: '#ef4444', label: 'A'  },
  'B':  { bg: 'rgba(59,130,246,0.2)',  text: '#3b82f6', label: 'B'  },
  'C':  { bg: 'rgba(16,185,129,0.2)', text: '#10b981', label: 'C'  },
  'D':  { bg: 'rgba(100,116,139,0.15)',text: '#64748b', label: 'D'  },
};

function RankBadge({ rank, large }: { rank: string; large?: boolean }) {
  const cfg = rankConfig[rank] ?? rankConfig['D'];
  const size = large ? 72 : 40;
  return (
    <div style={{
      width: size, height: size,
      background: cfg.bg, color: cfg.text,
      borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 900, fontSize: large ? 32 : 18,
      boxShadow: rank === 'S+' ? '0 0 24px rgba(245,158,11,0.5)' : undefined,
      flexShrink: 0,
    }}>
      {cfg.label}
    </div>
  );
}

// ─────────────────────────────────────────
// 配合理論 1 件のカード
// ─────────────────────────────────────────

const theoryColorByType: Record<string, string> = {
  NICKS_SINGLE: '#6366f1', NICKS_DOUBLE: '#8b5cf6',
  NICKS_TRIPLE: '#a855f7', NICKS_FORCE: '#d946ef',
  INBREED: '#f59e0b', MOTHER_INBREED: '#f59e0b',
  BLOOD_ACTIVATION: '#06b6d4', BLOOD_ACTIVATION_INBREED: '#0ea5e9',
  LINE_BREED_PARENT: '#10b981', LINE_BREED_CHILD: '#34d399',
  LINE_BREED_EXPLOSION: '#2dd4bf',
  VITALITY_FAMOUS_SIRE: '#f97316', VITALITY_FAMOUS_MARE: '#fb923c',
  VITALITY_DIFFERENT_LINE: '#fbbf24', VITALITY_COMPLETE: '#eab208',
  ATAVISM: '#ec4899',
  DAM_SIRE_BONUS: '#94a3b8',
  MAIL_LINE_ACTIVATION: '#64748b',
};

function TheoryCard({ theory }: { theory: BreedingTheory }) {
  const color = theoryColorByType[theory.type] ?? '#64748b';
  return (
    <div style={{
      background: 'var(--color-bg-input)',
      border: `1px solid ${color}40`,
      borderLeft: `4px solid ${color}`,
      borderRadius: 'var(--radius-md)',
      padding: '12px 16px',
      display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      <div style={{ flexShrink: 0 }}>
        <Zap style={{ width: 16, height: 16, color }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color }}>
            {theory.label}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700,
            background: `${color}25`, color,
            padding: '1px 6px', borderRadius: 20,
          }}>
            +{theory.power}pt
          </span>
          {theory.subPower > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 700,
              background: 'rgba(16,185,129,0.2)', color: '#10b981',
              padding: '1px 6px', borderRadius: 20,
            }}>
              サブ +{theory.subPower}
            </span>
          )}
          {theory.risk > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 700,
              background: 'rgba(239,68,68,0.2)', color: '#ef4444',
              padding: '1px 6px', borderRadius: 20,
            }}>
              危険 +{theory.risk}
            </span>
          )}
          {theory.risk < 0 && (
            <span style={{
              fontSize: 11, fontWeight: 700,
              background: 'rgba(16,185,129,0.2)', color: '#10b981',
              padding: '1px 6px', borderRadius: 20,
            }}>
              危険 {theory.risk}
            </span>
          )}
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
          {theory.detail}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
          {theory.tags.map(tag => (
            <span key={tag} style={{
              fontSize: 10, fontWeight: 600,
              background: `${color}15`, color,
              padding: '1px 6px', borderRadius: 20,
            }}>{tag}</span>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* サマリーカード */}
      <div className="card" style={{
        background: 'linear-gradient(145deg,rgba(30,41,59,0.9),rgba(15,23,42,0.95))',
        border: '1px solid var(--color-border-focus)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <RankBadge rank={result.rank} large />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 4 }}>
              {stallionName} × {mareName}
            </div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: '#f59e0b' }}>
                  {result.totalPower}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Flame style={{ width: 12, height: 12 }} /> 総爆発力
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: '#10b981' }}>
                  {result.subPower}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Zap style={{ width: 12, height: 12 }} /> サブパラ爆発
                </div>
              </div>
              <div>
                <div style={{
                  fontSize: 'var(--text-2xl)', fontWeight: 800,
                  color: result.totalRisk >= 6 ? '#ef4444' : result.totalRisk >= 3 ? '#f59e0b' : '#64748b',
                }}>
                  {result.totalRisk}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Shield style={{ width: 12, height: 12 }} /> 危険度
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: '#6366f1' }}>
                  {result.theories.length}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle style={{ width: 12, height: 12 }} /> 成立理論
                </div>
              </div>
            </div>
            <div style={{ marginTop: 8, fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
              {result.summary}
            </div>
          </div>
        </div>
      </div>

      {/* 危険度警告 */}
      {result.totalRisk >= 6 && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 'var(--radius-md)', padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          color: '#ef4444', fontSize: 'var(--text-sm)',
        }}>
          <AlertTriangle style={{ width: 18, height: 18, flexShrink: 0 }} />
          危険度が高い配合です。両親の健康状態を確認してください。
        </div>
      )}

      {/* 理論一覧 */}
      {result.theories.length === 0 ? (
        <div className="empty-state" style={{ padding: 32 }}>
          <Info />
          <h3>配合理論は成立していません</h3>
          <p>血統表を登録すると、より詳細な判定が可能になります</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
            成立した配合理論
          </div>
          {result.theories.map((t, i) => (
            <TheoryCard key={i} theory={t} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// メインコンポーネント: 配合シミュレーター
// ─────────────────────────────────────────

export function BreedingSimulatorPage() {
  const [stallionId, setStallionId] = useState<number | null>(null);
  const [mareId, setMareId] = useState<number | null>(null);
  const [result, setResult] = useState<BreedingCalculateResponse | null>(null);

  const { data: stallions = [] } = useQuery({ queryKey: ['stallions'], queryFn: api.stallions.list });
  const { data: mares = [] } = useQuery({ queryKey: ['mares'], queryFn: api.mares.list });

  const calcMutation = useMutation({
    mutationFn: () => api.breeding.calculate(stallionId!, mareId!),
    onSuccess: (data) => setResult(data),
  });

  const handleCalculate = useCallback(() => {
    if (!stallionId || !mareId) return;
    calcMutation.mutate();
  }, [stallionId, mareId, calcMutation]);

  const selectedStallion = stallions.find((s) => s.id === stallionId);
  const selectedMare = mares.find((m) => m.id === mareId);

  return (
    <>
      <div className="page-header">
        <h1>配合シミュレーター</h1>
        <p>種牡馬と繁殖牝馬を選択して、爆発力と成立する配合理論を計算します</p>
      </div>
      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'start' }}>

          {/* 左: 選択フォーム */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* 種牡馬選択 */}
            <div className="card">
              <div className="card-header" style={{ marginBottom: 12 }}>
                <h2 className="card-title" style={{ fontSize: 'var(--text-base)' }}>🐎 種牡馬</h2>
              </div>
              <select className="form-select" value={stallionId ?? ''} onChange={e => {
                setStallionId(e.target.value ? Number(e.target.value) : null);
                setResult(null);
              }}>
                <option value="">── 種牡馬を選択 ──</option>
                {stallions.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {selectedStallion && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--color-bg-input)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                    <span className="badge badge-info">{selectedStallion.childLineage?.parentLineage?.name}</span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                      {selectedStallion.childLineage?.name}
                    </span>
                  </div>
                  <div className="factor-tags">
                    {selectedStallion.factors?.map((f) => (
                      <span key={f.id} className="factor-tag">{f.type}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 繁殖牝馬選択 */}
            <div className="card">
              <div className="card-header" style={{ marginBottom: 12 }}>
                <h2 className="card-title" style={{ fontSize: 'var(--text-base)' }}>🌸 繁殖牝馬</h2>
              </div>
              <select className="form-select" value={mareId ?? ''} onChange={e => {
                setMareId(e.target.value ? Number(e.target.value) : null);
                setResult(null);
              }}>
                <option value="">── 繁殖牝馬を選択 ──</option>
                {mares.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              {selectedMare && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--color-bg-input)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                    <span className="badge badge-success">{selectedMare.lineage}</span>
                  </div>
                  <div className="factor-tags">
                    {selectedMare.factors?.map((f) => (
                      <span key={f.id} className="factor-tag">{f.type}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 計算ボタン */}
            <button
              className="btn btn-primary btn-lg"
              style={{ width: '100%', fontSize: 'var(--text-base)', padding: '14px 0' }}
              disabled={!stallionId || !mareId || calcMutation.isPending}
              onClick={handleCalculate}
            >
              {calcMutation.isPending ? (
                <><div className="loading-spinner" style={{ width: 18, height: 18 }} /> 計算中...</>
              ) : (
                <><Zap /> 爆発力を計算する <ChevronRight /></>
              )}
            </button>

            {calcMutation.isError && (
              <div style={{ color: 'var(--color-accent-danger)', fontSize: 'var(--text-sm)', textAlign: 'center' }}>
                計算中にエラーが発生しました。
              </div>
            )}
          </div>

          {/* 右: 計算結果 */}
          <div>
            {result ? (
              <ResultPanel
                result={result.result}
                stallionName={result.stallion?.name ?? ''}
                mareName={result.mare?.name ?? ''}
              />
            ) : (
              <div className="card" style={{ minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
                <Zap style={{ width: 48, height: 48, color: 'var(--color-accent-primary)', opacity: 0.3 }} />
                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                  種牡馬と繁殖牝馬を選択して計算してください
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
