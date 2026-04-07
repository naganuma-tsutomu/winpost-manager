import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { FACTOR_TYPES } from '@winpost/shared';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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

  const filtered = mares.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">繁殖牝馬管理</h1>
          <p className="text-slate-500 mt-1">繁殖牝馬のデータを登録・管理します</p>
        </div>
        <Button onClick={() => { setEditId(null); setShowModal(true); }} size="lg">
          <Plus className="w-5 h-5 mr-2" /> 新規登録
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9 bg-white"
            placeholder="繁殖牝馬を検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
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
            <h3 className="text-lg font-semibold text-slate-800">繁殖牝馬が登録されていません</h3>
            <p className="text-slate-500 mt-1">「新規登録」ボタンから繁殖牝馬を追加してください</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead className="font-semibold text-slate-700">名前</TableHead>
                <TableHead className="font-semibold text-slate-700">系統</TableHead>
                <TableHead className="font-semibold text-slate-700">因子</TableHead>
                <TableHead className="font-semibold text-slate-700 w-16 text-center">SP</TableHead>
                <TableHead className="font-semibold text-slate-700 w-16 text-center">ST</TableHead>
                <TableHead className="font-semibold text-slate-700 min-w-[200px]">メモ</TableHead>
                <TableHead className="font-semibold text-slate-700 w-24 text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
                <TableRow key={m.id} className="hover:bg-slate-50">
                  <TableCell className="font-bold text-slate-900">{m.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                      {m.lineage}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {m.factors && m.factors.length > 0 ? m.factors.map((f) => (
                        <Badge key={f.id} variant="secondary" className="font-normal text-xs bg-slate-100 text-slate-700">
                          {FACTOR_TYPES[f.type] || f.type}
                        </Badge>
                      )) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-medium">{m.speed ?? '—'}</TableCell>
                  <TableCell className="text-center font-medium">{m.stamina ?? '—'}</TableCell>
                  <TableCell className="text-slate-500 text-xs max-w-[200px] truncate">
                    {m.memo || '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900" onClick={() => { setEditId(m.id); setShowModal(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50" onClick={() => {
                        if (confirm(`「${m.name}」を削除しますか？`)) deleteMutation.mutate(m.id);
                      }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {showModal && (
        <MareModal editId={editId} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}

interface MareForm {
  name: string;
  lineage: string;
  speed: number | '';
  stamina: number | '';
  memo: string;
  factors: string[];
}

const EMPTY_FORM: MareForm = {
  name: '', lineage: '', speed: '', stamina: '', memo: '', factors: [],
};

function MareModal({ editId, onClose }: { editId: number | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const isEdit = editId !== null;

  const { data: existing } = useQuery({
    queryKey: ['mare', editId],
    queryFn: () => api.mares.get(editId!),
    enabled: isEdit,
  });

  const [form, setForm] = useState<MareForm>(() => {
    if (isEdit && existing) {
      return {
        name: existing.name,
        lineage: existing.lineage,
        speed: existing.speed ?? '',
        stamina: existing.stamina ?? '',
        memo: existing.memo || '',
        factors: existing.factors.map((f) => f.type),
      };
    }
    return EMPTY_FORM;
  });

  const mutation = useMutation({
    mutationFn: (data: unknown) => isEdit ? api.mares.update(editId!, data) : api.mares.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mares'] });
      onClose();
    },
  });

  const handleSubmit = () => {
    if (!form.name || !form.lineage) return;
    mutation.mutate({
      ...form,
      speed: form.speed !== '' ? Number(form.speed) : null,
      stamina: form.stamina !== '' ? Number(form.stamina) : null,
    });
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
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{isEdit ? '繁殖牝馬を編集' : '繁殖牝馬を登録'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-5 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">名前 <span className="text-rose-500">*</span></Label>
            <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="lineage">系統 <span className="text-rose-500">*</span></Label>
            <Input id="lineage" required placeholder="例: ノーザンダンサー系" value={form.lineage} onChange={(e) => setForm({ ...form, lineage: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-4 border border-slate-100 bg-slate-50 p-4 rounded-lg">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500 uppercase">SP</Label>
              <Input type="number" min={0} max={100} className="bg-white"
                value={form.speed}
                onChange={(e) => setForm({ ...form, speed: e.target.value === '' ? '' : Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500 uppercase">ST</Label>
              <Input type="number" min={0} max={100} className="bg-white"
                value={form.stamina}
                onChange={(e) => setForm({ ...form, stamina: e.target.value === '' ? '' : Number(e.target.value) })} />
            </div>
          </div>

          <div className="space-y-3">
            <Label>因子</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(FACTOR_TYPES).map(([key, label]) => (
                <Badge
                  key={key}
                  variant={form.factors.includes(key) ? 'default' : 'outline'}
                  className="cursor-pointer text-sm py-1 px-3 hover:opacity-80 transition-opacity"
                  onClick={() => toggleFactor(key)}
                >
                  {label}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="memo">メモ</Label>
            <Textarea id="memo" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>キャンセル</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending || !form.name || !form.lineage}>
            {mutation.isPending ? '保存中...' : isEdit ? '更新' : '登録'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
