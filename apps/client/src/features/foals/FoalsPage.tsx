import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { EVAL_MARKS, GENDERS, GROWTH_TYPES, FLAG_TYPES, estimateSpeed } from '@winpost/shared';
import type { EvalMark, GrowthType } from '@winpost/shared';
import { Plus, Pencil, Trash2, Search, Flag, Tag, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const evalMarkClass: Record<string, string> = {
  DOUBLE_CIRCLE: 'text-rose-600 font-black',
  CIRCLE: 'text-orange-500 font-bold',
  TRIANGLE: 'text-emerald-500 font-semibold',
  NONE: 'text-slate-300',
};

const speedRankClass: Record<string, string> = {
  S: 'bg-gradient-to-br from-rose-500 to-orange-500 text-white border-transparent',
  A: 'bg-orange-100 text-orange-700 border-orange-200',
  B: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  C: 'bg-blue-100 text-blue-700 border-blue-200',
  D: 'bg-slate-100 text-slate-600 border-slate-200',
};

export function FoalsPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [showFlagModal, setShowFlagModal] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [filterYear, setFilterYear] = useState('all');
  const [filterFlag, setFilterFlag] = useState('all');

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
    const matchYear = filterYear === 'all' || f.birthYear === Number(filterYear);
    const matchFlag = filterFlag === 'all' || f.flags?.some(flag => flag.type === filterFlag);
    return matchSearch && matchYear && matchFlag;
  });

  const birthYears = useMemo(() => {
    return [...new Set(foals.map((f) => f.birthYear))].sort((a, b) => b - a);
  }, [foals]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">幼駒管理</h1>
          <p className="text-slate-500 mt-1">幼駒の評価印・スピード推測・フラグを管理します</p>
        </div>
        <Button onClick={() => { setEditId(null); setShowModal(true); }} size="lg">
          <Plus className="w-5 h-5 mr-2" /> 新規登録
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input className="pl-9 bg-white" placeholder="幼駒を検索..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-[140px] bg-white">
            <SelectValue placeholder="全年度" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全年度</SelectItem>
            {birthYears.map((y) => (
              <SelectItem key={y} value={y.toString()}>{y}年</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterFlag} onValueChange={setFilterFlag}>
          <SelectTrigger className="w-[160px] bg-white">
            <SelectValue placeholder="全てのフラグ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全てのフラグ</SelectItem>
            {Object.entries(FLAG_TYPES).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center p-12 text-slate-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
            読み込み中...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center">
            <Search className="h-12 w-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-800">幼駒が見つかりません</h3>
            <p className="text-slate-500 mt-1">「新規登録」ボタンから幼駒を追加してください</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50/80 sticky top-0">
              <TableRow>
                <TableHead className="font-semibold text-slate-700">名前</TableHead>
                <TableHead className="font-semibold text-slate-700 text-center w-16">年</TableHead>
                <TableHead className="font-semibold text-slate-700 text-center w-16">性別</TableHead>
                <TableHead className="font-semibold text-slate-700">父 / 母</TableHead>
                <TableHead className="font-semibold text-slate-700 text-center w-20">河童木</TableHead>
                <TableHead className="font-semibold text-slate-700 text-center w-20">美香</TableHead>
                <TableHead className="font-semibold text-slate-700 text-center w-20">推測</TableHead>
                <TableHead className="font-semibold text-slate-700 w-24">成長</TableHead>
                <TableHead className="font-semibold text-slate-700 min-w-[150px]">フラグ</TableHead>
                <TableHead className="font-semibold text-slate-700 w-32 text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((f) => {
                const estimate = estimateSpeed(f.kappaMark, f.mikaMark, f.growthType || undefined);
                return (
                  <TableRow key={f.id} className="hover:bg-slate-50">
                    <TableCell className="font-bold text-slate-900">{f.name || '（未命名）'}</TableCell>
                    <TableCell className="text-center tabular-nums text-slate-600">{f.birthYear}</TableCell>
                    <TableCell className="text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${f.gender === 'MALE' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                        {GENDERS[f.gender]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold text-blue-700">{f.sire?.name || '—'}</span>
                        <span className="text-xs text-rose-600">{f.dam?.name || '—'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-lg">
                      <span className={evalMarkClass[f.kappaMark] || evalMarkClass.NONE}>{EVAL_MARKS[f.kappaMark] || '－'}</span>
                    </TableCell>
                    <TableCell className="text-center text-lg">
                      <span className={evalMarkClass[f.mikaMark] || evalMarkClass.NONE}>{EVAL_MARKS[f.mikaMark] || '－'}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`w-8 h-8 rounded-full flex items-center justify-center p-0 font-bold ${speedRankClass[estimate.rank] || speedRankClass.D}`} title={estimate.description}>
                        {estimate.rank}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                      {f.growthType ? GROWTH_TYPES[f.growthType] : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {f.flags?.map((flag) => {
                          const isKeep = flag.type === 'KEEP';
                          const isDanger = flag.type === 'SALE_AUGUST' || flag.type === 'SALE_OVERSEAS';
                          const isInfo = flag.type === 'CLUB';
                          const cls = isKeep ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' :
                                      isDanger ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100' :
                                      isInfo ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' :
                                      'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100';
                          return (
                            <Badge key={flag.id} variant="outline" className={`cursor-pointer ${cls}`}
                              onClick={() => {
                                if (confirm(`フラグ「${FLAG_TYPES[flag.type]}」を削除しますか？`)) {
                                  deleteFlagMutation.mutate({ foalId: f.id, flagId: flag.id });
                                }
                              }}
                            >
                              {FLAG_TYPES[flag.type]} <X className="w-3 h-3 ml-1 opacity-50" />
                            </Badge>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900" onClick={() => { setEditId(f.id); setShowModal(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-50" onClick={() => setShowFlagModal(f.id)}>
                          <Flag className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50" onClick={() => {
                          if (confirm(`幼駒を削除しますか？`)) deleteMutation.mutate(f.id);
                        }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {showModal && <FoalModal editId={editId} onClose={() => setShowModal(false)} />}
      {showFlagModal && <FlagModal foalId={showFlagModal} onClose={() => setShowFlagModal(null)} />}
    </div>
  );
}

// ---------------- Foal Modal ----------------
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

  const handleSubmit = () => {
    mutation.mutate({
      ...form,
      birthYear: Number(form.birthYear),
      sireId: form.sireId !== '' ? Number(form.sireId) : null,
      damId: form.damId !== '' ? Number(form.damId) : null,
      growthType: form.growthType || null,
    });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{isEdit ? '幼駒を編集' : '幼駒を登録'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-5 py-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2 col-span-2 md:col-span-1">
              <Label>名前</Label>
              <Input value={form.name} placeholder="未命名でもOK" onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>出生年 <span className="text-rose-500">*</span></Label>
              <Input type="number" required value={form.birthYear} onChange={(e) => setForm({ ...form, birthYear: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>性別 <span className="text-rose-500">*</span></Label>
              <Select value={form.gender} onValueChange={(val) => setForm({ ...form, gender: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(GENDERS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-slate-100 bg-slate-50 p-4 rounded-lg">
            <div className="space-y-2">
              <Label className="text-blue-700">父（種牡馬）</Label>
              <Select value={form.sireId.toString()} onValueChange={(val) => setForm({ ...form, sireId: val === 'none' ? '' : Number(val) })}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="未選択" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">未選択</SelectItem>
                  {stallions.map((s) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-rose-700">母（繁殖牝馬）</Label>
              <Select value={form.damId.toString()} onValueChange={(val) => setForm({ ...form, damId: val === 'none' ? '' : Number(val) })}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="未選択" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">未選択</SelectItem>
                  {mares.map((m) => <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4 border border-amber-100 bg-amber-50/30 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-amber-700">
              <Tag className="w-5 h-5" />
              <span className="font-semibold">評価印 & スピード推測</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>河童木の印</Label>
                <Select value={form.kappaMark} onValueChange={(val) => setForm({ ...form, kappaMark: val })}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(EVAL_MARKS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>美香の印</Label>
                <Select value={form.mikaMark} onValueChange={(val) => setForm({ ...form, mikaMark: val })}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(EVAL_MARKS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>成長型</Label>
                <Select value={form.growthType || 'none'} onValueChange={(val) => setForm({ ...form, growthType: val === 'none' ? '' : val })}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="不明" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不明</SelectItem>
                    {Object.entries(GROWTH_TYPES).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-white p-3 rounded-md border border-slate-200 mt-2">
              <Badge variant="outline" className={`w-10 h-10 rounded-full flex items-center justify-center p-0 text-lg font-bold ${speedRankClass[estimate.rank] || speedRankClass.D}`}>
                {estimate.rank}
              </Badge>
              <div>
                <div className="font-bold text-slate-800">スコア: {estimate.score}</div>
                <div className="text-sm text-slate-500">{estimate.description}</div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>馬体診断コメント</Label>
            <Textarea value={form.bodyComment} onChange={(e) => setForm({ ...form, bodyComment: e.target.value })} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>メモ</Label>
            <Textarea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>キャンセル</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? '保存中...' : isEdit ? '更新' : '登録'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Flag Modal ----------------
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
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>フラグを追加</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>フラグ種別 <span className="text-rose-500">*</span></Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(FLAG_TYPES).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>説明</Label>
            <Input value={description} placeholder="例: ジャパンカップ路線で使用" onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>目標日</Label>
            <Input value={targetDate} placeholder="例: 12月4週" onChange={(e) => setTargetDate(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>キャンセル</Button>
          <Button onClick={() => mutation.mutate({ type, description: description || null, targetDate: targetDate || null })} disabled={mutation.isPending}>
            追加
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
