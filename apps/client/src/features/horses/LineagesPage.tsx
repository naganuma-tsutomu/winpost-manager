import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { ParentLineageWithChildren } from '@winpost/shared';
import { Plus, Trash2, GitBranch, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

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
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">系統管理</h1>
          <p className="text-slate-500 mt-1">親系統・子系統のマスタデータを管理します</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setShowParentModal(true)} variant="default">
            <Plus className="w-4 h-4 mr-2" /> 親系統を追加
          </Button>
          <Button onClick={() => setShowChildModal(true)} variant="secondary">
            <Plus className="w-4 h-4 mr-2" /> 子系統を追加
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20 text-slate-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
          読み込み中...
        </div>
      ) : parentLineages.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <GitBranch className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">系統が登録されていません</h3>
          <p className="text-slate-500 mb-6 max-w-sm mx-auto">
            まず親系統を追加し、その後に属する子系統を追加して系統図を構築してください。
          </p>
          <Button onClick={() => setShowParentModal(true)}>
            <Plus className="w-4 h-4 mr-2" /> 最初の親系統を追加
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {parentLineages.map((pl) => (
            <Card key={pl.id} className="border-slate-200 hover:shadow-md transition-shadow overflow-hidden flex flex-col h-full bg-slate-50/30">
              <CardHeader className="bg-white border-b border-slate-100 pb-4 px-5 pt-5 group relative">
                <CardTitle className="flex items-center gap-2.5 text-lg">
                  <div className="p-1.5 bg-blue-100 rounded-md">
                    <GitBranch className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="font-bold text-slate-800">{pl.name}</span>
                </CardTitle>
                <div className="absolute right-4 top-4 hover:bg-slate-100 rounded-md">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => {
                    if (confirm(`「${pl.name}」を削除しますか？子系統も全て削除されます。`)) deleteParent.mutate(pl.id);
                  }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-5">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">子系統</div>
                {pl.childLineages && pl.childLineages.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {pl.childLineages.map((cl) => (
                      <Badge key={cl.id} variant="secondary"
                        className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300 font-medium py-1 px-3 pr-2 cursor-pointer transition-colors shadow-sm"
                        onClick={() => {
                          if (confirm(`子系統「${cl.name}」を削除しますか？`)) deleteChild.mutate(cl.id);
                        }}>
                        {cl.name} 
                        <span className="ml-2 text-slate-400 hover:text-rose-500 rounded p-0.5 transition-colors">
                          <X className="w-3 h-3" />
                        </span>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-100/50 rounded-lg p-4 text-center border-2 border-dashed border-slate-200">
                    <p className="text-slate-400 text-sm">子系統が登録されていません</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showParentModal && <ParentLineageModal onClose={() => setShowParentModal(false)} />}
      {showChildModal && <ChildLineageModal parentLineages={parentLineages} onClose={() => setShowChildModal(false)} />}
    </div>
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
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>親系統を追加</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <div className="space-y-2">
            <Label htmlFor="parent-name">系統名 <span className="text-rose-500">*</span></Label>
            <Input id="parent-name" required value={name} placeholder="例: ノーザンダンサー系"
              onChange={(e) => setName(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>キャンセル</Button>
          <Button onClick={() => mutation.mutate({ name })} disabled={mutation.isPending || !name}>追加</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChildLineageModal({ parentLineages, onClose }: {
  parentLineages: ParentLineageWithChildren[];
  onClose: () => void;
}) {
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
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>子系統を追加</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-5">
          <div className="space-y-2">
            <Label>親系統 <span className="text-rose-500">*</span></Label>
            <Select value={parentLineageId} onValueChange={setParentLineageId}>
              <SelectTrigger>
                <SelectValue placeholder="選択してください" />
              </SelectTrigger>
              <SelectContent>
                {parentLineages.map((pl) => (
                  <SelectItem key={pl.id} value={pl.id.toString()}>{pl.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="child-name">子系統名 <span className="text-rose-500">*</span></Label>
            <Input id="child-name" required value={name} placeholder="例: サドラーズウェルズ系"
              onChange={(e) => setName(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>キャンセル</Button>
          <Button onClick={() => mutation.mutate({ name, parentLineageId: Number(parentLineageId) })} 
                  disabled={mutation.isPending || !name || !parentLineageId}>
            追加
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
