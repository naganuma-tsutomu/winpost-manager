import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Cigarette,
  Heart,
  Baby,
  GitBranch,
} from 'lucide-react';

export function DashboardPage() {
  const { data: stallions } = useQuery({ queryKey: ['stallions'], queryFn: api.stallions.list });
  const { data: mares } = useQuery({ queryKey: ['mares'], queryFn: api.mares.list });
  const { data: foals } = useQuery({ queryKey: ['foals'], queryFn: () => api.foals.list() });
  const { data: lineages } = useQuery({ queryKey: ['lineages'], queryFn: api.lineages.parentList });

  return (
    <>
      <div className="page-header">
        <h1>ダッシュボード</h1>
        <p>ウイニングポスト10 2025 データ管理</p>
      </div>
      <div className="page-body">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon stat-icon-primary">
              <Cigarette />
            </div>
            <div>
              <div className="stat-value">{stallions?.length ?? '—'}</div>
              <div className="stat-label">種牡馬</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon stat-icon-success">
              <Heart />
            </div>
            <div>
              <div className="stat-value">{mares?.length ?? '—'}</div>
              <div className="stat-label">繁殖牝馬</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon stat-icon-warning">
              <Baby />
            </div>
            <div>
              <div className="stat-value">{foals?.length ?? '—'}</div>
              <div className="stat-label">幼駒</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon stat-icon-info">
              <GitBranch />
            </div>
            <div>
              <div className="stat-value">{lineages?.length ?? '—'}</div>
              <div className="stat-label">親系統</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">🏇 ようこそ WinPost Manager へ</h2>
          </div>
          <div style={{ color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
            <p>ウイニングポスト10 2025 のデータ管理アプリです。</p>
            <ul style={{ marginTop: 'var(--space-4)', paddingLeft: 'var(--space-6)' }}>
              <li><strong>種牡馬・繁殖牝馬</strong>のデータを登録・管理</li>
              <li><strong>幼駒</strong>の評価印を記録し、スピード値を推測</li>
              <li><strong>系統</strong>データを整理して配合に備える</li>
            </ul>
            <p style={{ marginTop: 'var(--space-4)' }}>
              サイドバーのメニューから各機能にアクセスしてください。
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
