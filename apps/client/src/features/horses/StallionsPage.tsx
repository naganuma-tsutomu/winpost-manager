import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { FACTOR_TYPES, type ChildLineageWithParent } from '@winpost/shared';
import { Plus, Pencil, Trash2, Search, X } from 'lucide-react';

export function StallionsPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const { data: stallions = [], isLoading } = useQuery({
    queryKey: ['stallions'],
    queryFn: api.stallions.list,
  });

  const { data: childLineages = [] } = useQuery({
    queryKey: ['childLineages'],
    queryFn: api.lineages.childList,
  });

  const deleteMutation = useMutation({
    mutationFn: api.stallions.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stallions'] }),
  });

  const filtered = stallions.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (id: number) => {
    setEditId(id);
    setShowModal(true);
  };

  const handleDelete = (id: number, name: string) => {
    if (confirm(`「${name}」を削除しますか？`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <>
      <div className="page-header">
        <h1>種牡馬管理</h1>
        <p>種牡馬のデータを登録・管理します</p>
      </div>
      <div className="page-body">
        <div className="toolbar">
          <div className="search-input">
            <Search />
            <input
              className="form-input"
              placeholder="種牡馬を検索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '2.5rem', width: 280 }}
            />
          </div>
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
            <h3>種牡馬が登録されていません</h3>
            <p>「新規登録」ボタンから種牡馬を追加してください</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>名前</th>
                  <th>系統</th>
                  <th>因子</th>
                  <th>SP</th>
                  <th>ST</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td>
                      <span className="badge badge-info">
                        {s.childLineage?.parentLineage?.name}
                      </span>
                      {' '}
                      <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-xs)' }}>
                        {s.childLineage?.name}
                      </span>
                    </td>
                    <td>
                      <div className="factor-tags">
                        {s.factors?.map((f) => (
                          <span key={f.id} className="factor-tag">
                            {FACTOR_TYPES[f.type] || f.type}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>{s.speed ?? '—'}</td>
                    <td>{s.stamina ?? '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(s.id)}>
                          <Pencil />
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(s.id, s.name)}>
                          <Trash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <StallionModal
          editId={editId}
          childLineages={childLineages}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

// フォームの内部状態型（number入力は未入力時に '' を許容）
interface StallionForm {
  name: string;
  childLineageId: number | '';
  speed: number | '';
  stamina: number | '';
  power: number | '';
  guts: number | '';
  wisdom: number | '';
  health: number | '';
  memo: string;
  factors: string[];
}

const EMPTY_FORM: StallionForm = {
  name: '', childLineageId: '', speed: '', stamina: '', power: '',
  guts: '', wisdom: '', health: '', memo: '', factors: [],
};

function StallionModal({ editId, childLineages, onClose }: {
  editId: number | null;
  childLineages: ChildLineageWithParent[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = editId !== null;

  const { data: existing } = useQuery({
    queryKey: ['stallion', editId],
    queryFn: () => api.stallions.get(editId!),
    enabled: isEdit,
  });

  const [form, setForm] = useState<StallionForm>(() => {
    if (isEdit && existing) {
      return {
        name: existing.name,
        childLineageId: existing.childLineageId,
        speed: existing.speed ?? '',
        stamina: existing.stamina ?? '',
        power: existing.power ?? '',
        guts: existing.guts ?? '',
        wisdom: existing.wisdom ?? '',
        health: existing.health ?? '',
        memo: existing.memo || '',
        factors: existing.factors.map((f) => f.type),
      };
    }
    return EMPTY_FORM;
  });

  const mutation = useMutation({
    mutationFn: (data: unknown) => isEdit ? api.stallions.update(editId!, data) : api.stallions.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stallions'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...form,
      childLineageId: Number(form.childLineageId),
      speed: form.speed !== '' ? Number(form.speed) : null,
      stamina: form.stamina !== '' ? Number(form.stamina) : null,
      power: form.power !== '' ? Number(form.power) : null,
      guts: form.guts !== '' ? Number(form.guts) : null,
      wisdom: form.wisdom !== '' ? Number(form.wisdom) : null,
      health: form.health !== '' ? Number(form.health) : null,
    };
    mutation.mutate(data);
  };

  const toggleFactor = (type: string) => {
    setForm((prev) => ({
      ...prev,
      factors: prev.factors.includes(type)
        ? prev.factors.filter((f) => f !== type)
        : [...prev.factors, type],
    }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? '種牡馬を編集' : '種牡馬を登録'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">名前 *</label>
              <input className="form-input" required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">子系統 *</label>
              <select className="form-select" required value={form.childLineageId}
                onChange={(e) => setForm({ ...form, childLineageId: e.target.value === '' ? '' : Number(e.target.value) })}>
                <option value="">選択してください</option>
                {childLineages.map((l) => (
                  <option key={l.id} value={l.id}>{l.parentLineage?.name} → {l.name}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              {(['speed', 'stamina', 'power', 'guts', 'wisdom', 'health'] as const).map(field => (
                <div className="form-group" key={field}>
                  <label className="form-label">
                    {{ speed: 'SP', stamina: 'ST', power: 'パワー', guts: '根性', wisdom: '賢さ', health: '健康' }[field]}
                  </label>
                  <input className="form-input" type="number" min={0} max={100}
                    value={form[field]}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value === '' ? '' : Number(e.target.value) })} />
                </div>
              ))}
            </div>
            <div className="form-group">
              <label className="form-label">因子</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {Object.entries(FACTOR_TYPES).map(([key, label]) => (
                  <button key={key} type="button"
                    className={`btn btn-sm ${form.factors.includes(key) ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => toggleFactor(key)}>
                    {label}
                  </button>
                ))}
              </div>
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
