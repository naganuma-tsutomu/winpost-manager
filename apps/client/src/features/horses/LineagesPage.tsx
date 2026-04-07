import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Plus, Trash2, X, GitBranch } from 'lucide-react';

export function LineagesPage() {
  const queryClient = useQueryClient();
  const [showParentModal, setShowParentModal] = useState(false);
  const [showChildModal, setShowChildModal] = useState(false);

  const { data: parentLineages = [], isLoading } = useQuery({
    queryKey: ['lineages'],
    queryFn: api.lineages.parentList,
  });

  const deleteParent = useMutation({
    mutationFn: api.lineages.parentDelete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lineages'] }),
  });

  const deleteChild = useMutation({
    mutationFn: api.lineages.childDelete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lineages'] }),
  });

  return (
    <>
      <div className="page-header">
        <h1>系統管理</h1>
        <p>親系統・子系統のマスタデータを管理します</p>
      </div>
      <div className="page-body">
        <div className="toolbar">
          <button className="btn btn-primary" onClick={() => setShowParentModal(true)}>
            <Plus /> 親系統を追加
          </button>
          <button className="btn btn-secondary" onClick={() => setShowChildModal(true)}>
            <Plus /> 子系統を追加
          </button>
        </div>

        {isLoading ? (
          <div className="loading-container"><div className="loading-spinner" /></div>
        ) : parentLineages.length === 0 ? (
          <div className="empty-state">
            <GitBranch />
            <h3>系統が登録されていません</h3>
            <p>まず親系統を追加し、その後に子系統を追加してください</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            {parentLineages.map((pl: any) => (
              <div key={pl.id} className="card">
                <div className="card-header">
                  <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <GitBranch style={{ width: 18, height: 18, color: 'var(--color-accent-primary)' }} />
                    {pl.name}
                  </h3>
                  <button className="btn btn-ghost btn-sm" onClick={() => {
                    if (confirm(`「${pl.name}」を削除しますか？子系統も全て削除されます。`)) deleteParent.mutate(pl.id);
                  }}>
                    <Trash2 />
                  </button>
                </div>
                {pl.childLineages?.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                    {pl.childLineages.map((cl: any) => (
                      <span key={cl.id} className="badge badge-primary" style={{ padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--text-sm)', cursor: 'pointer' }}
                        onClick={() => {
                          if (confirm(`子系統「${cl.name}」を削除しますか？`)) deleteChild.mutate(cl.id);
                        }}>
                        {cl.name} ×
                      </span>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>子系統なし</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showParentModal && <ParentLineageModal onClose={() => setShowParentModal(false)} />}
      {showChildModal && <ChildLineageModal parentLineages={parentLineages} onClose={() => setShowChildModal(false)} />}
    </>
  );
}

function ParentLineageModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');

  const mutation = useMutation({
    mutationFn: api.lineages.parentCreate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lineages'] });
      onClose();
    },
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h2>親系統を追加</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate({ name }); }}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">系統名 *</label>
              <input className="form-input" required value={name} placeholder="例: ノーザンダンサー系"
                onChange={(e) => setName(e.target.value)} />
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

function ChildLineageModal({ parentLineages, onClose }: { parentLineages: any[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [parentLineageId, setParentLineageId] = useState('');

  const mutation = useMutation({
    mutationFn: api.lineages.childCreate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lineages'] });
      queryClient.invalidateQueries({ queryKey: ['childLineages'] });
      onClose();
    },
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h2>子系統を追加</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate({ name, parentLineageId: Number(parentLineageId) }); }}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">親系統 *</label>
              <select className="form-select" required value={parentLineageId}
                onChange={(e) => setParentLineageId(e.target.value)}>
                <option value="">選択してください</option>
                {parentLineages.map((pl: any) => (
                  <option key={pl.id} value={pl.id}>{pl.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">子系統名 *</label>
              <input className="form-input" required value={name} placeholder="例: サドラーズウェルズ系"
                onChange={(e) => setName(e.target.value)} />
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
