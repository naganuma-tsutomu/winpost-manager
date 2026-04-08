import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { BreedingPlan } from '@winpost/shared';
import { Plus, Trash2, CheckCircle, XCircle, Clock, Calendar, Check, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const PLAN_STATUS_CONFIG = {
  PLANNED:   { label: '予定', icon: Clock,        color: 'text-indigo-600', bg: 'bg-indigo-100/50', border: 'border-indigo-200' },
  COMPLETED: { label: '実施済み', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-100/50', border: 'border-emerald-200' },
  CANCELLED: { label: '取消',     icon: XCircle,    color: 'text-slate-500', bg: 'bg-slate-100', border: 'border-slate-200' },
};

const BASE_GAME_YEAR = 1970;
const MAX_GAME_YEAR = 2100;

function useGameYear() {
  const [year, setYear] = useState(() => {
    const saved = localStorage.getItem('winpost_current_year');
    return saved ? parseInt(saved, 10) : new Date().getFullYear();
  });

  const updateYear = (y: number) => {
    setYear(y);
    localStorage.setItem('winpost_current_year', y.toString());
  };

  return [year, updateYear] as const;
}

function PlanCard({ plan, onStatusChange, onDelete }: {
  plan: BreedingPlan;
  onStatusChange: (id: number, status: string) => void;
  onDelete: (id: number) => void;
}) {
  const cfg = PLAN_STATUS_CONFIG[plan.status as keyof typeof PLAN_STATUS_CONFIG] ?? PLAN_STATUS_CONFIG.PLANNED;
  const Icon = cfg.icon;
  
  return (
    <Card className={`border-l-4 overflow-hidden mb-3 transition-colors ${cfg.border}`}>
      <div className={`p-4 flex flex-col sm:flex-row sm:items-center gap-4 ${plan.status === 'CANCELLED' ? 'opacity-60 bg-slate-50/50' : 'bg-white'}`}>
        <div className="flex items-start flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-4 flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <span className={`font-bold text-base ${plan.status === 'CANCELLED' ? 'text-slate-500' : 'text-slate-900'} truncate`}>
                {plan.stallion?.name ?? '?'}
                <span className="text-slate-400 mx-1.5 text-sm">×</span>
                {plan.mare?.name ?? '?'}
              </span>
              <Badge variant="outline" className={`${cfg.bg} ${cfg.color} ${cfg.border} font-bold px-2 border`}>
                {cfg.label}
              </Badge>
            </div>
            {plan.memo && (
              <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                {plan.memo}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap pl-14 sm:pl-0">
          {plan.status !== 'COMPLETED' && (
            <Button size="sm" variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 hover:text-emerald-700 h-8 px-3"
              onClick={() => onStatusChange(plan.id, 'COMPLETED')}>
              <Check className="w-3 h-3 mr-1" /> 実施済み
            </Button>
          )}
          {plan.status !== 'CANCELLED' && (
            <Button size="sm" variant="outline" className="text-slate-500 border-slate-200 hover:bg-slate-100 h-8 px-3"
              onClick={() => onStatusChange(plan.id, 'CANCELLED')}>
              <X className="w-3 h-3 mr-1" /> 取消
            </Button>
          )}
          {plan.status !== 'PLANNED' && (
            <Button size="sm" variant="outline" className="bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100 hover:text-indigo-700 h-8 px-3"
              onClick={() => onStatusChange(plan.id, 'PLANNED')}>
              <Clock className="w-3 h-3 mr-1" /> 予定に戻す
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 ml-auto sm:ml-0"
            onClick={() => { if(confirm('この計画を削除しますか？')) onDelete(plan.id); }}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function BreedingPlanPage() {
  const queryClient = useQueryClient();
  const [selectedYear, setSelectedYear] = useGameYear();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ stallionId: 'none', mareId: 'none', memo: '' });

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
      setForm({ stallionId: 'none', mareId: 'none', memo: '' });
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

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">配合計画</h1>
        <p className="text-slate-500 mt-1">年度ごとの種付けプランを管理します</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* 年度選択バー */}
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200">
          <Calendar className="text-slate-400 w-5 h-5 mr-1" />
          <input 
            type="number"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            min={BASE_GAME_YEAR}
            max={MAX_GAME_YEAR}
            className="w-20 text-xl font-bold text-slate-900 outline-none text-center bg-transparent appearance-none"
          />
          <span className="font-semibold text-slate-500 text-lg">年</span>
        </div>
        
        <Button onClick={() => setShowModal(true)} size="lg" className="shadow-sm">
          <Plus className="w-5 h-5 mr-2" /> 種付け追加
        </Button>
      </div>

      {/* 統計サマリー */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '予定', count: plannedList.length, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100' },
          { label: '実施済み', count: completedList.length, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
          { label: '取消', count: cancelledList.length, color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' },
        ].map(s => (
          <Card key={s.label} className={`${s.bg} border shadow-none`}>
            <CardContent className="p-4 text-center">
              <div className={`text-3xl font-black ${s.color}`}>{s.count}</div>
              <div className={`text-xs font-semibold uppercase tracking-wider mt-1 opacity-70 ${s.color}`}>{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12 text-slate-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
          読み込み中...
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-dashed border-slate-300 flex flex-col items-center justify-center p-16 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <Calendar className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800">{selectedYear}年の配合計画はまだありません</h3>
          <p className="text-slate-500 mt-1">「種付け追加」ボタンから配合計画を登録できます</p>
        </div>
      ) : (
        <div className="space-y-8">
          {plannedList.length > 0 && (
            <section>
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest pl-1 mb-3">予定</h3>
              <div>
                {plannedList.map((p) => (
                  <PlanCard key={p.id} plan={p}
                    onStatusChange={(id, status) => updateStatusMutation.mutate({ id, status })}
                    onDelete={(id) => deleteMutation.mutate(id)} />
                ))}
              </div>
            </section>
          )}
          {completedList.length > 0 && (
            <section>
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest pl-1 mb-3">実施済み</h3>
              <div>
                {completedList.map((p) => (
                  <PlanCard key={p.id} plan={p}
                    onStatusChange={(id, status) => updateStatusMutation.mutate({ id, status })}
                    onDelete={(id) => deleteMutation.mutate(id)} />
                ))}
              </div>
            </section>
          )}
          {cancelledList.length > 0 && (
            <section>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest pl-1 mb-3">取消</h3>
              <div className="opacity-80 flex flex-col">
                {cancelledList.map((p) => (
                  <PlanCard key={p.id} plan={p}
                    onStatusChange={(id, status) => updateStatusMutation.mutate({ id, status })}
                    onDelete={(id) => deleteMutation.mutate(id)} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* 登録モーダル */}
      {showModal && (
        <Dialog open={true} onOpenChange={() => setShowModal(false)}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>種付け計画を追加</DialogTitle>
            </DialogHeader>

            <div className="grid gap-5 py-4">
              <div className="space-y-2">
                <Label>年度</Label>
                <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-md text-slate-600 font-medium">
                  {selectedYear}年
                </div>
              </div>

              <div className="space-y-2">
                <Label>種牡馬 <span className="text-rose-500">*</span></Label>
                <Select value={form.stallionId} onValueChange={v => setForm({ ...form, stallionId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="── 選択してください ──" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">── 選択してください ──</SelectItem>
                    {stallions.map((s) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>繁殖牝馬 <span className="text-rose-500">*</span></Label>
                <Select value={form.mareId} onValueChange={v => setForm({ ...form, mareId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="── 選択してください ──" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">── 選択してください ──</SelectItem>
                    {mares.map((m) => <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>メモ</Label>
                <Textarea rows={2} value={form.memo}
                  onChange={e => setForm({ ...form, memo: e.target.value })}
                  placeholder="覚書など..." />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowModal(false)}>キャンセル</Button>
              <Button 
                disabled={form.stallionId === 'none' || form.mareId === 'none' || createMutation.isPending}
                onClick={() => createMutation.mutate({
                  year: selectedYear,
                  stallionId: Number(form.stallionId),
                  mareId: Number(form.mareId),
                  memo: form.memo || null,
                })}>
                {createMutation.isPending ? '登録中...' : '登録'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
