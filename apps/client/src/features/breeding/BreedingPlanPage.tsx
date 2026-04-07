import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { BreedingPlan } from '@winpost/shared';
import { Plus, Trash2, CheckCircle, XCircle, Clock, Calendar } from 'lucide-react';

const PLAN_STATUS_CONFIG = {
  PLANNED:   { label: '予定', icon: Clock,        color: '#6366f1', bg: 'rgba(99,102,241,0.15)'  },
  COMPLETED: { label: '実施済み', icon: CheckCircle, color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  CANCELLED: { label: '取消',     icon: XCircle,    color: '#64748b', bg: 'rgba(100,116,139,0.15)' },
};

const BASE_GAME_YEAR = 1985;
const MAX_GAME_YEAR = 2090;

function genYears() {
  const years: number[] = [];
  for (let y = BASE_GAME_YEAR; y <= MAX_GAME_YEAR; y++) years.push(y);
  return years;
}

function PlanCard({ plan, onStatusChange, onDelete }: {
  plan: BreedingPlan;
  onStatusChange: (id: number, status: string) => void;
  onDelete: (id: number) => void;
}) {
  const cfg = PLAN_STATUS_CONFIG[plan.status] ?? PLAN_STATUS_CONFIG.PLANNED;
  const Icon = cfg.icon;
  return (
    <div style={{
      background: 'var(--color-bg-input)',
      border: `1px solid var(--color-border)`,
      borderLeft: `4px solid ${cfg.color}`,
      borderRadius: 'var(--radius-md)',
      padding: '12px 16px',
      display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: cfg.bg, color: cfg.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon style={{ width: 18, height: 18 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
            {plan.stallion?.name ?? '?'}
            <span style={{ color: 'var(--color-text-muted)', margin: '0 4px' }}>×</span>
            {plan.mare?.name ?? '?'}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700,
            background: cfg.bg, color: cfg.color,
            padding: '2px 8px', borderRadius: 20,
          }}>{cfg.label}</span>
        </div>
        {plan.memo && (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 6 }}>
            {plan.memo}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {plan.status !== 'COMPLETED' && (
            <button className="btn btn-success" style={{ padding: '3px 10px', fontSize: 11 }}
              onClick={() => onStatusChange(plan.id, 'COMPLETED')}>
              ✓ 実施済み
            </button>
          )}
          {plan.status !== 'CANCELLED' && (
            <button className="btn" style={{ padding: '3px 10px', fontSize: 11, background: 'rgba(100,116,139,0.2)', color: 'var(--color-text-secondary)' }}
              onClick={() => onStatusChange(plan.id, 'CANCELLED')}>
              取消
            </button>
          )}
          {plan.status !== 'PLANNED' && (
            <button className="btn" style={{ padding: '3px 10px', fontSize: 11, background: 'rgba(99,102,241,0.2)', color: '#6366f1' }}
              onClick={() => onStatusChange(plan.id, 'PLANNED')}>
              予定に戻す
            </button>
          )}
          <button className="btn btn-danger" style={{ padding: '3px 10px', fontSize: 11, marginLeft: 'auto' }}
            onClick={() => onDelete(plan.id)}>
            <Trash2 style={{ width: 12, height: 12 }} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function BreedingPlanPage() {
  const queryClient = useQueryClient();
  const [selectedYear, setSelectedYear] = useState(1990);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ stallionId: '', mareId: '', memo: '' });

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['breeding-plans', selectedYear],
    queryFn: () => api.breeding.plans.list(selectedYear),
  });

  const { data: stallions = [] } = useQuery({ queryKey: ['stallions'], queryFn: api.stallions.list });
  const { data: mares = [] } = useQuery({ queryKey: ['mares'], queryFn: api.mares.list });

  const createMutation = useMutation({
    mutationFn: (data: unknown) => api.breeding.plans.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['breeding-plans', selectedYear] });
      setShowModal(false);
      setForm({ stallionId: '', mareId: '', memo: '' });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => {
      const plan = plans.find((p) => p.id === id);
      if (!plan) throw new Error('計画が見つかりません');
      return api.breeding.plans.update(id, {
        year: plan.year, stallionId: plan.stallionId, mareId: plan.mareId, memo: plan.memo, status,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['breeding-plans', selectedYear] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.breeding.plans.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['breeding-plans', selectedYear] }),
  });

  const plannedList = plans.filter((p) => p.status === 'PLANNED');
  const completedList = plans.filter((p) => p.status === 'COMPLETED');
  const cancelledList = plans.filter((p) => p.status === 'CANCELLED');

  const years = genYears();

  return (
    <>
      <div className="page-header">
        <h1>配合計画</h1>
        <p>年度ごとの種付けプランを管理します</p>
      </div>
      <div className="page-body">

        {/* 年度選択バー */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24 }}>
          <Calendar style={{ color: 'var(--color-text-muted)' }} />
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flex: 1, paddingBlock: 4 }}>
            {years.slice(0, 30).map(y => (
              <button key={y}
                onClick={() => setSelectedYear(y)}
                style={{
                  padding: '6px 14px', borderRadius: 'var(--radius-md)',
                  fontWeight: 600, fontSize: 'var(--text-sm)',
                  background: y === selectedYear ? 'var(--color-accent-primary)' : 'var(--color-bg-input)',
                  color: y === selectedYear ? '#fff' : 'var(--color-text-secondary)',
                  border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                }}>
                {y}年
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus /> 種付け追加
          </button>
        </div>

        {/* 統計サマリー */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: '予定', count: plannedList.length, color: '#6366f1', bg: 'rgba(99,102,241,0.15)' },
            { label: '実施済み', count: completedList.length, color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
            { label: '取消', count: cancelledList.length, color: '#64748b', bg: 'rgba(100,116,139,0.1)' },
          ].map(s => (
            <div key={s.label} style={{
              background: s.bg, borderRadius: 'var(--radius-md)',
              padding: '12px 16px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.count}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="loading-container"><div className="loading-spinner" /></div>
        ) : plans.length === 0 ? (
          <div className="empty-state">
            <Calendar />
            <h3>{selectedYear}年の配合計画はまだありません</h3>
            <p>「種付け追加」ボタンから配合計画を登録できます</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {plannedList.length > 0 && (
              <div>
                <div className="section-label" style={{ marginBottom: 12 }}>予定</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {plannedList.map((p) => (
                    <PlanCard key={p.id} plan={p}
                      onStatusChange={(id, status) => updateStatusMutation.mutate({ id, status })}
                      onDelete={(id) => deleteMutation.mutate(id)} />
                  ))}
                </div>
              </div>
            )}
            {completedList.length > 0 && (
              <div>
                <div className="section-label" style={{ marginBottom: 12 }}>実施済み</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {completedList.map((p) => (
                    <PlanCard key={p.id} plan={p}
                      onStatusChange={(id, status) => updateStatusMutation.mutate({ id, status })}
                      onDelete={(id) => deleteMutation.mutate(id)} />
                  ))}
                </div>
              </div>
            )}
            {cancelledList.length > 0 && (
              <div>
                <div className="section-label" style={{ marginBottom: 12, opacity: 0.6 }}>取消</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: 0.6 }}>
                  {cancelledList.map((p) => (
                    <PlanCard key={p.id} plan={p}
                      onStatusChange={(id, status) => updateStatusMutation.mutate({ id, status })}
                      onDelete={(id) => deleteMutation.mutate(id)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 登録モーダル */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2 className="modal-title">種付け計画を追加</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">年度 <span style={{ color: 'var(--color-accent-danger)' }}>*</span></label>
                <select className="form-select" value={selectedYear} disabled>
                  <option>{selectedYear}年</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">種牡馬 <span style={{ color: 'var(--color-accent-danger)' }}>*</span></label>
                <select className="form-select" value={form.stallionId}
                  onChange={e => setForm(f => ({ ...f, stallionId: e.target.value }))}>
                  <option value="">── 選択してください ──</option>
                  {stallions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">繁殖牝馬 <span style={{ color: 'var(--color-accent-danger)' }}>*</span></label>
                <select className="form-select" value={form.mareId}
                  onChange={e => setForm(f => ({ ...f, mareId: e.target.value }))}>
                  <option value="">── 選択してください ──</option>
                  {mares.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">メモ</label>
                <textarea className="form-textarea" rows={2} value={form.memo}
                  onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                  placeholder="覚書など..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowModal(false)}>キャンセル</button>
              <button className="btn btn-primary"
                disabled={!form.stallionId || !form.mareId || createMutation.isPending}
                onClick={() => createMutation.mutate({
                  year: selectedYear,
                  stallionId: Number(form.stallionId),
                  mareId: Number(form.mareId),
                  memo: form.memo || null,
                })}>
                {createMutation.isPending ? '登録中...' : '登録'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
