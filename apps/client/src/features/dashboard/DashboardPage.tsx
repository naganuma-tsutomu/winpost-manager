import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Cigarette,
  Heart,
  Baby,
  GitBranch,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function DashboardPage() {
  const { data: stallions } = useQuery({ queryKey: ['stallions'], queryFn: api.stallions.list });
  const { data: mares } = useQuery({ queryKey: ['mares'], queryFn: api.mares.list });
  const { data: foals } = useQuery({ queryKey: ['foals'], queryFn: () => api.foals.list() });
  const { data: lineages } = useQuery({ queryKey: ['lineages'], queryFn: api.lineages.parentList });

  const stats = [
    {
      title: '種牡馬',
      value: stallions?.length ?? '—',
      icon: Cigarette,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100/50',
      link: '/stallions',
    },
    {
      title: '繁殖牝馬',
      value: mares?.length ?? '—',
      icon: Heart,
      color: 'text-rose-600',
      bgColor: 'bg-rose-100/50',
      link: '/mares',
    },
    {
      title: '幼駒',
      value: foals?.length ?? '—',
      icon: Baby,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100/50',
      link: '/foals',
    },
    {
      title: '親系統',
      value: lineages?.length ?? '—',
      icon: GitBranch,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100/50',
      link: '/lineages',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">ダッシュボード</h1>
        <p className="text-slate-500 mt-1">ウイニングポスト10 2025 データ管理</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{stat.value}</div>
              <Link to={stat.link} className="text-xs text-slate-500 hover:text-primary flex items-center gap-1 mt-2 transition-colors w-fit">
                詳細を見る <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <TrendingUp className="w-48 h-48" />
          </div>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <span className="text-2xl">🏇</span> ようこそ WinPost Manager へ
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              ウイニングポスト10 2025 のデータ管理・配合シミュレーター
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 relative z-10 text-slate-600">
            <p className="leading-relaxed">
              このアプリケーションでは、ゲーム内の様々なデータをブラウザ上で効率よく管理・計算することができます。
            </p>
            <ul className="space-y-2.5">
              <li className="flex items-start gap-2">
                <span className="bg-primary/10 text-primary rounded-full p-1 mt-0.5"><Cigarette className="w-3 h-3" /></span>
                <span><strong>種牡馬・繁殖牝馬</strong>のデータを登録・一元管理</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-primary/10 text-primary rounded-full p-1 mt-0.5"><Baby className="w-3 h-3" /></span>
                <span><strong>幼駒</strong>の評価印を記録し、競走馬としての能力・スピード値を推測</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-primary/10 text-primary rounded-full p-1 mt-0.5"><GitBranch className="w-3 h-3" /></span>
                <span><strong>系統</strong>データを整理し、次世代の配合に備える</span>
              </li>
            </ul>
            <div className="pt-4 border-t border-slate-100 flex gap-3">
              <Button asChild>
                <Link to="/breeding/simulator">配合シミュレーターを開く</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/calendar">進行カレンダーを見る</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
