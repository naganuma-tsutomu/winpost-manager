import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { FACTOR_TYPES, type ChildLineageWithParent } from '@winpost/shared';
import { Plus, Pencil, Trash2, Search, X } from 'lucide-react';

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">種牡馬管理</h1>
          <p className="text-slate-500 mt-1">種牡馬のデータを登録・管理します</p>
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
            placeholder="種牡馬を検索..."
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
            <h3 className="text-lg font-semibold text-slate-800">種牡馬が登録されていません</h3>
            <p className="text-slate-500 mt-1">「新規登録」ボタンから種牡馬を追加してください</p>
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
                <TableHead className="font-semibold text-slate-700 w-24 text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id} className="hover:bg-slate-50">
                  <TableCell className="font-bold text-slate-900">{s.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-sm w-fit border border-blue-100">
                        {s.childLineage?.parentLineage?.name}
                      </span>
                      <span className="text-xs text-slate-500">{s.childLineage?.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {s.factors && s.factors.length > 0 ? s.factors.map((f) => (
                        <Badge key={f.id} variant="secondary" className="font-normal text-xs bg-slate-100 text-slate-700">
                          {FACTOR_TYPES[f.type] || f.type}
                        </Badge>
                      )) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-medium">{s.speed ?? '—'}</TableCell>
                  <TableCell className="text-center font-medium">{s.stamina ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900" onClick={() => handleEdit(s.id)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50" onClick={() => handleDelete(s.id, s.name)}>
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
        <StallionModal
          editId={editId}
          childLineages={childLineages}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
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

  const handleSubmit = () => {
    if (!form.name || form.childLineageId === '') return;
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
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{isEdit ? '種牡馬を編集' : '種牡馬を登録'}</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-5 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">名前 <span className="text-rose-500">*</span></Label>
            <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lineage">子系統 <span className="text-rose-500">*</span></Label>
            <Select 
              value={form.childLineageId.toString()} 
              onValueChange={(val) => setForm({ ...form, childLineageId: Number(val) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="選択してください" />
              </SelectTrigger>
              <SelectContent>
                {childLineages.map((l) => (
                  <SelectItem key={l.id} value={l.id.toString()}>
                    {l.parentLineage?.name} → {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-4 border border-slate-100 bg-slate-50 p-4 rounded-lg">
            {(['speed', 'stamina', 'power', 'guts', 'wisdom', 'health'] as const).map(field => (
              <div className="space-y-1.5" key={field}>
                <Label className="text-xs text-slate-500 uppercase">
                  {{ speed: 'SP', stamina: 'ST', power: 'パワー', guts: '根性', wisdom: '賢さ', health: '健康' }[field]}
                </Label>
                <Input type="number" min={0} max={100} className="bg-white"
                  value={form[field]}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value === '' ? '' : Number(e.target.value) })} />
              </div>
            ))}
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
          <Button onClick={handleSubmit} disabled={mutation.isPending || !form.name || form.childLineageId === ''}>
            {mutation.isPending ? '保存中...' : isEdit ? '更新' : '登録'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
