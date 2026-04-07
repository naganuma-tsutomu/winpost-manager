import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Save, Info } from 'lucide-react';

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
  const [horseId, setHorseId] = useState<number | null>(null);
  const [entries, setEntries] = useState<PedigreeEntries>({});
  const [saved, setSaved] = useState(false);

  const { data: stallions = [] } = useQuery({ queryKey: ['stallions'], queryFn: api.stallions.list });
  const { data: mares = [] } = useQuery({ queryKey: ['mares'], queryFn: api.mares.list });

  // 選択した馬の血統データをロード
  const { isLoading: pLoading } = useQuery({
    queryKey: ['pedigree', horseType, horseId],
    queryFn: () => api.breeding.getPedigree(horseType, horseId!),
    enabled: !!horseId,
    onSuccess: (data: any[]) => {
      const map: PedigreeEntries = {};
      for (const e of data) {
        map[e.position] = { ancestorId: e.ancestorId, ancestorName: e.ancestor?.name ?? '' };
      }
      setEntries(map);
      setSaved(false);
    },
  } as any);

  const saveMutation = useMutation({
    mutationFn: () => {
      const entriesToSave = PEDIGREE_POSITIONS
        .filter(p => entries[p.position]?.ancestorId)
        .map(p => ({
          ancestorId: entries[p.position].ancestorId,
          generation: p.generation,
          position: p.position,
        }));
      return api.breeding.savePedigree(horseType, horseId!, entriesToSave);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedigree', horseType, horseId] });
      setSaved(true);
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
    <>
      <div className="page-header">
        <h1>血統表入力</h1>
        <p>種牡馬・繁殖牝馬の血統を登録します（最大4代）</p>
      </div>
      <div className="page-body">

        {/* 対象選択 */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">対象</label>
              <select className="form-select" value={horseType}
                onChange={e => { setHorseType(e.target.value as any); setHorseId(null); setEntries({}); }}>
                <option value="stallion">種牡馬</option>
                <option value="mare">繁殖牝馬</option>
              </select>
            </div>
            <div className="form-group" style={{ margin: 0, minWidth: 240 }}>
              <label className="form-label">馬の名前</label>
              <select className="form-select" value={horseId ?? ''}
                onChange={e => { setHorseId(e.target.value ? Number(e.target.value) : null); setEntries({}); }}>
                <option value="">── 選択してください ──</option>
                {horses.map((h: any) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
            {horseId && (
              <button className="btn btn-primary"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}>
                <Save /> {saveMutation.isPending ? '保存中...' : '血統表を保存'}
              </button>
            )}
            {saved && (
              <span style={{ color: 'var(--color-accent-success)', fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 4 }}>
                ✓ 保存しました
              </span>
            )}
          </div>
        </div>

        {!horseId ? (
          <div className="empty-state">
            <Info />
            <h3>馬を選択してください</h3>
            <p>対象を選択すると血統表の入力フォームが表示されます</p>
          </div>
        ) : pLoading ? (
          <div className="loading-container"><div className="loading-spinner" /></div>
        ) : (
          <div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 8,
              overflowX: 'auto',
            }}>
              {[1, 2, 3].map(gen => (
                <div key={gen} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{
                    fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-muted)',
                    textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em',
                    padding: '4px 0',
                  }}>
                    {gen === 1 ? '1代（父・母）' : gen === 2 ? '2代（祖父母）' : '3代（8頭）'}
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

            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
              <Info style={{ width: 14, height: 14 }} />
              血統表の先祖はすべて種牡馬から選択します。繁殖牝馬の血統を入力する場合も、先祖は種牡馬として登録してください。
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function PedigreeCell({
  posInfo, value, stallions, onChange, onClear,
}: {
  posInfo: typeof PEDIGREE_POSITIONS[0];
  value?: { ancestorId: number; ancestorName: string };
  stallions: any[];
  onChange: (id: number, name: string) => void;
  onClear: () => void;
}) {
  const depth = posInfo.generation;
  const colors = ['', 'var(--color-accent-primary)', 'var(--color-accent-secondary)', '#10b981'];

  return (
    <div style={{
      background: value ? 'rgba(99,102,241,0.08)' : 'var(--color-bg-input)',
      border: `1px solid ${value ? 'rgba(99,102,241,0.3)' : 'var(--color-border)'}`,
      borderLeft: `3px solid ${colors[depth] || '#333'}`,
      borderRadius: 'var(--radius-sm)',
      padding: '8px 10px',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)',
        marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ color: colors[depth] || 'inherit' }}>{posInfo.label}</span>
        {value && (
          <button
            onClick={onClear}
            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 0, fontSize: 11 }}>
            ×
          </button>
        )}
      </div>
      <select
        className="form-select"
        style={{ fontSize: 11, padding: '4px 6px' }}
        value={value?.ancestorId ?? ''}
        onChange={e => {
          if (!e.target.value) { onClear(); return; }
          const s = stallions.find((s: any) => s.id === Number(e.target.value));
          if (s) onChange(s.id, s.name);
        }}>
        <option value="">── 未登録 ──</option>
        {stallions.map((s: any) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
    </div>
  );
}
