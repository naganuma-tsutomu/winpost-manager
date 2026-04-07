import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { FACTOR_TYPES } from '@winpost/shared';
import { Plus, Pencil, Trash2, Search, X } from 'lucide-react';

export function MaresPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const { data: mares = [], isLoading } = useQuery({
    queryKey: ['mares'],
    queryFn: api.mares.list,
  });

  const deleteMutation = useMutation({
    mutationFn: api.mares.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mares'] }),
  });

  const filtered = mares.filter((m: any) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="page-header">
        <h1>繁殖牝馬管理</h1>
        <p>繁殖牝馬のデータを登録・管理します</p>
      </div>
      <div className="page-body">
        <div className="toolbar">
          <div className="search-input">
            <Search />
            <input className="form-input" placeholder="繁殖牝馬を検索..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '2.5rem', width: 280 }} />
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
            <h3>繁殖牝馬が登録されていません</h3>
            <p>「新規登録」ボタンから繁殖牝馬を追加してください</p>
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
                  <th>メモ</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m: any) => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 600 }}>{m.name}</td>
                    <td><span className="badge badge-success">{m.lineage}</span></td>
                    <td>
                      <div className="factor-tags">
                        {m.factors?.map((f: any) => (
                          <span key={f.id} className="factor-tag">
                            {FACTOR_TYPES[f.type as keyof typeof FACTOR_TYPES] || f.type}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>{m.speed ?? '—'}</td>
                    <td>{m.stamina ?? '—'}</td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.memo || '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setEditId(m.id); setShowModal(true); }}>
                          <Pencil />
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => {
                          if (confirm(`「${m.name}」を削除しますか？`)) deleteMutation.mutate(m.id);
                        }}>
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
        <MareModal editId={editId} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}

function MareModal({ editId, onClose }: { editId: number | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const isEdit = editId !== null;

  const { data: existing } = useQuery({
    queryKey: ['mare', editId],
    queryFn: () => api.mares.get(editId!),
    enabled: isEdit,
  });

  const [form, setForm] = useState<any>(() => {
    if (isEdit && existing) {
      return {
        name: existing.name,
        lineage: existing.lineage,
        speed: existing.speed,
        stamina: existing.stamina,
        memo: existing.memo || '',
        factors: existing.factors?.map((f: any) => f.type) || [],
      };
    }
    return { name: '', lineage: '', speed: '', stamina: '', memo: '', factors: [] };
  });

  const mutation = useMutation({
    mutationFn: (data: any) => isEdit ? api.mares.update(editId!, data) : api.mares.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mares'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      ...form,
      speed: form.speed !== '' ? Number(form.speed) : null,
      stamina: form.stamina !== '' ? Number(form.stamina) : null,
    });
  };

  const toggleFactor = (type: string) => {
    setForm((prev: any) => ({
      ...prev,
      factors: prev.factors.includes(type)
        ? prev.factors.filter((f: string) => f !== type)
        : [...prev.factors, type],
    }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? '繁殖牝馬を編集' : '繁殖牝馬を登録'}</h2>
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
              <label className="form-label">系統 *</label>
              <input className="form-input" required value={form.lineage}
                placeholder="例: ノーザンダンサー系"
                onChange={(e) => setForm({ ...form, lineage: e.target.value })} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">SP</label>
                <input className="form-input" type="number" min={0} max={100}
                  value={form.speed} onChange={(e) => setForm({ ...form, speed: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">ST</label>
                <input className="form-input" type="number" min={0} max={100}
                  value={form.stamina} onChange={(e) => setForm({ ...form, stamina: e.target.value })} />
              </div>
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
