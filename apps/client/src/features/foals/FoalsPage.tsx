import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { EVAL_MARKS, GENDERS, GROWTH_TYPES, FLAG_TYPES, estimateSpeed } from '@winpost/shared';
import type { EvalMark, GrowthType } from '@winpost/shared';
import { Plus, Pencil, Trash2, Search, X, Flag, Tag } from 'lucide-react';

const evalMarkClass: Record<string, string> = {
  DOUBLE_CIRCLE: 'eval-mark eval-mark-dc',
  CIRCLE: 'eval-mark eval-mark-c',
  TRIANGLE: 'eval-mark eval-mark-t',
  NONE: 'eval-mark eval-mark-n',
};

const speedRankClass: Record<string, string> = {
  S: 'speed-rank speed-rank-s',
  A: 'speed-rank speed-rank-a',
  B: 'speed-rank speed-rank-b',
  C: 'speed-rank speed-rank-c',
  D: 'speed-rank speed-rank-d',
};

export function FoalsPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [showFlagModal, setShowFlagModal] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [filterYear, setFilterYear] = useState('');

  const { data: foals = [], isLoading } = useQuery({
    queryKey: ['foals'],
    queryFn: () => api.foals.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: api.foals.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['foals'] }),
  });

  const deleteFlagMutation = useMutation({
    mutationFn: ({ foalId, flagId }: { foalId: number; flagId: number }) => api.foals.deleteFlag(foalId, flagId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['foals'] }),
  });

  const filtered = foals.filter((f) => {
    const matchSearch = !search || f.name?.toLowerCase().includes(search.toLowerCase());
    const matchYear = !filterYear || f.birthYear === Number(filterYear);
    return matchSearch && matchYear;
  });

  const birthYears = useMemo(() => {
    return [...new Set(foals.map((f) => f.birthYear))].sort((a, b) => b - a);
  }, [foals]);

  return (
    <>
      <div className="page-header">
        <h1>幼駒管理</h1>
        <p>幼駒の評価印・スピード推測・フラグを管理します</p>
      </div>
      <div className="page-body">
        <div className="toolbar">
          <div className="search-input">
            <Search />
            <input className="form-input" placeholder="幼駒を検索..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '2.5rem', width: 240 }} />
          </div>
          <select className="form-select" value={filterYear} onChange={(e) => setFilterYear(e.target.value)}
            style={{ width: 140 }}>
            <option value="">全年度</option>
            {birthYears.map((y) => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>
          <div className="toolbar-spacer" />
          <button className="btn btn-primary" onClick={() => { setEditId(null); setShowModal(true); }}>
            <Plus /> 新規登録
          </button>
        </div>

        {isLoading ? (
          <div className="loading-container"><div className="loading-spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Search />
            <h3>幼駒が登録されていません</h3>
            <p>「新規登録」ボタンから幼駒を追加してください</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>名前</th>
                  <th>年</th>
                  <th>性別</th>
                  <th>父</th>
                  <th>母</th>
                  <th>河童木</th>
                  <th>美香</th>
                  <th>推測</th>
                  <th>成長</th>
                  <th>フラグ</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => {
                  const estimate = estimateSpeed(
                    f.kappaMark,
                    f.mikaMark,
                    f.growthType || undefined
                  );
                  return (
                    <tr key={f.id}>
                      <td style={{ fontWeight: 600 }}>{f.name || '（未命名）'}</td>
                      <td>{f.birthYear}</td>
                      <td>
                        <span className={`badge ${f.gender === 'MALE' ? 'badge-info' : 'badge-danger'}`}>
                          {GENDERS[f.gender]}
                        </span>
                      </td>
                      <td style={{ fontSize: 'var(--text-xs)' }}>{f.sire?.name || '—'}</td>
                      <td style={{ fontSize: 'var(--text-xs)' }}>{f.dam?.name || '—'}</td>
                      <td>
                        <span className={evalMarkClass[f.kappaMark] || 'eval-mark eval-mark-n'}>
                          {EVAL_MARKS[f.kappaMark] || '－'}
                        </span>
                      </td>
                      <td>
                        <span className={evalMarkClass[f.mikaMark] || 'eval-mark eval-mark-n'}>
                          {EVAL_MARKS[f.mikaMark] || '－'}
                        </span>
                      </td>
                      <td>
                        <span className={speedRankClass[estimate.rank] || 'speed-rank'} title={estimate.description}>
                          {estimate.rank}
                        </span>
                      </td>
                      <td style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                        {f.growthType ? GROWTH_TYPES[f.growthType] : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                          {f.flags?.map((flag) => (
                            <span key={flag.id}
                              className={`badge ${flag.type === 'KEEP' ? 'badge-success' : flag.type === 'SELL' ? 'badge-danger' : flag.type === 'OVERSEAS_SALE' ? 'badge-warning' : 'badge-info'}`}
                              style={{ cursor: 'pointer' }}
                              onClick={() => {
                                if (confirm(`フラグ「${FLAG_TYPES[flag.type]}」を削除しますか？`)) {
                                  deleteFlagMutation.mutate({ foalId: f.id, flagId: flag.id });
                                }
                              }}>
                              {FLAG_TYPES[flag.type]} ×
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => { setEditId(f.id); setShowModal(true); }}>
                            <Pencil />
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setShowFlagModal(f.id)}>
                            <Flag />
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => {
                            if (confirm(`幼駒を削除しますか？`)) deleteMutation.mutate(f.id);
                          }}>
                            <Trash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && <FoalModal editId={editId} onClose={() => setShowModal(false)} />}
      {showFlagModal && <FlagModal foalId={showFlagModal} onClose={() => setShowFlagModal(null)} />}
    </>
  );
}

interface FoalForm {
  name: string;
  birthYear: number;
  gender: string;
  sireId: number | '';
  damId: number | '';
  kappaMark: string;
  mikaMark: string;
  bodyComment: string;
  growthType: string;
  memo: string;
}

const EMPTY_FOAL_FORM: FoalForm = {
  name: '', birthYear: new Date().getFullYear(), gender: 'MALE',
  sireId: '', damId: '', kappaMark: 'NONE', mikaMark: 'NONE',
  bodyComment: '', growthType: '', memo: '',
};

function FoalModal({ editId, onClose }: { editId: number | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const isEdit = editId !== null;

  const { data: existing } = useQuery({
    queryKey: ['foal', editId],
    queryFn: () => api.foals.get(editId!),
    enabled: isEdit,
  });

  const { data: stallions = [] } = useQuery({ queryKey: ['stallions'], queryFn: api.stallions.list });
  const { data: mares = [] } = useQuery({ queryKey: ['mares'], queryFn: api.mares.list });

  const [form, setForm] = useState<FoalForm>(() => {
    if (isEdit && existing) {
      return {
        name: existing.name || '',
        birthYear: existing.birthYear,
        gender: existing.gender,
        sireId: existing.sireId ?? '',
        damId: existing.damId ?? '',
        kappaMark: existing.kappaMark,
        mikaMark: existing.mikaMark,
        bodyComment: existing.bodyComment || '',
        growthType: existing.growthType || '',
        memo: existing.memo || '',
      };
    }
    return EMPTY_FOAL_FORM;
  });

  const estimate = useMemo(() =>
    estimateSpeed(form.kappaMark as EvalMark, form.mikaMark as EvalMark, (form.growthType || undefined) as GrowthType | undefined),
    [form.kappaMark, form.mikaMark, form.growthType]
  );

  const mutation = useMutation({
    mutationFn: (data: unknown) => isEdit ? api.foals.update(editId!, data) : api.foals.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foals'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      ...form,
      birthYear: Number(form.birthYear),
      sireId: form.sireId !== '' ? Number(form.sireId) : null,
      damId: form.damId !== '' ? Number(form.damId) : null,
      growthType: form.growthType || null,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? '幼駒を編集' : '幼駒を登録'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">名前</label>
                <input className="form-input" value={form.name} placeholder="未命名でもOK"
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">出生年 *</label>
                <input className="form-input" type="number" required value={form.birthYear}
                  onChange={(e) => setForm({ ...form, birthYear: Number(e.target.value) })} />
              </div>
              <div className="form-group">
                <label className="form-label">性別 *</label>
                <select className="form-select" required value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                  {Object.entries(GENDERS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">父（種牡馬）</label>
                <select className="form-select" value={form.sireId}
                  onChange={(e) => setForm({ ...form, sireId: e.target.value ? Number(e.target.value) : '' })}>
                  <option value="">未選択</option>
                  {stallions.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">母（繁殖牝馬）</label>
                <select className="form-select" value={form.damId}
                  onChange={(e) => setForm({ ...form, damId: e.target.value ? Number(e.target.value) : '' })}>
                  <option value="">未選択</option>
                  {mares.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 評価印 + リアルタイム推測 */}
            <div className="card" style={{ marginBottom: 'var(--space-5)', padding: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
                <Tag style={{ width: 18, height: 18, color: 'var(--color-accent-warning)' }} />
                <span style={{ fontWeight: 600 }}>評価印 & スピード推測</span>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">河童木の印</label>
                  <select className="form-select" value={form.kappaMark}
                    onChange={(e) => setForm({ ...form, kappaMark: e.target.value })}>
                    {Object.entries(EVAL_MARKS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">美香の印</label>
                  <select className="form-select" value={form.mikaMark}
                    onChange={(e) => setForm({ ...form, mikaMark: e.target.value })}>
                    {Object.entries(EVAL_MARKS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">成長型</label>
                  <select className="form-select" value={form.growthType}
                    onChange={(e) => setForm({ ...form, growthType: e.target.value })}>
                    <option value="">不明</option>
                    {Object.entries(GROWTH_TYPES).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
                padding: 'var(--space-3)', background: 'var(--color-bg-input)',
                borderRadius: 'var(--radius-md)', marginTop: 'var(--space-2)'
              }}>
                <span className={speedRankClass[estimate.rank] || 'speed-rank'}>
                  {estimate.rank}
                </span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                    スコア: {estimate.score}
                  </div>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
                    {estimate.description}
                  </div>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">馬体診断コメント</label>
              <textarea className="form-textarea" value={form.bodyComment}
                onChange={(e) => setForm({ ...form, bodyComment: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">メモ</label>
              <textarea className="form-textarea" value={form.memo}
                onChange={(e) => setForm({ ...form, memo: e.target.value })} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>キャンセル</button>
            <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? '保存中...' : isEdit ? '更新' : '登録'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FlagModal({ foalId, onClose }: { foalId: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [type, setType] = useState('WATCH');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');

  const mutation = useMutation({
    mutationFn: (data: unknown) => api.foals.addFlag(foalId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foals'] });
      onClose();
    },
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h2>フラグを追加</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X /></button>
        </div>
        <form onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate({ type, description: description || null, targetDate: targetDate || null });
        }}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">フラグ種別 *</label>
              <select className="form-select" required value={type}
                onChange={(e) => setType(e.target.value)}>
                {Object.entries(FLAG_TYPES).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">説明</label>
              <input className="form-input" value={description}
                placeholder="例: ジャパンカップ路線で使用"
                onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">目標日</label>
              <input className="form-input" value={targetDate}
                placeholder="例: 12月4週"
                onChange={(e) => setTargetDate(e.target.value)} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>キャンセル</button>
            <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>追加</button>
          </div>
        </form>
      </div>
    </div>
  );
}
