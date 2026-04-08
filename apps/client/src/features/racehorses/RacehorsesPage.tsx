import React, { useState } from 'react';
import type { Racehorse } from './api/useRacehorses.js';
import { useRacehorses, useDeleteRacehorse } from './api/useRacehorses.js';

const CURRENT_YEAR = new Date().getFullYear();
const calcAge = (birthYear?: number) =>
  birthYear != null ? CURRENT_YEAR - birthYear : null;
import { RacehorseFormDialog } from './RacehorseFormDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PlusCircle, Trash2, Edit } from 'lucide-react';

function getGrowthTypeLabelLocal(type: string) {
  const map: Record<string, string> = {
    SUPER_EARLY: '超早熟', EARLY: '早熟', NORMAL: '普通', LATE: '晩成', SUPER_LATE: '超晩成'
  };
  return map[type] || type;
}

export const RacehorsesPage: React.FC = () => {
  const { data: racehorses, isLoading, isError } = useRacehorses();
  const deleteMutation = useDeleteRacehorse();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHorse, setEditingHorse] = useState<Racehorse | null>(null);

  const handleCreate = () => {
    setEditingHorse(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (horse: Racehorse) => {
    setEditingHorse(horse);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number, name: string) => {
    if (window.confirm(`${name}を削除してよろしいですか？`)) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">読み込み中...</div>;
  if (isError) return <div className="p-8 text-center text-red-500">取得に失敗しました</div>;

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center bg-card p-6 rounded-lg border shadow-sm">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            現役馬管理
          </h1>
          <p className="text-muted-foreground mt-2">
            所有している現役馬のパラメータを入力し、ローテーションや育成方針を確認します。
          </p>
        </div>
        <Button onClick={handleCreate} className="gap-2 bg-blue-600 hover:bg-blue-700">
          <PlusCircle className="w-4 h-4" />
          新規登録
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {racehorses?.map((horse) => (
          <Card key={horse.id} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow relative group">
            <CardHeader className="pb-3 border-b bg-muted/30">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl inline-flex items-center gap-2">
                    {horse.name}
                    {horse.gender === 'MALE' ? (
                      <span className="text-sm font-normal text-blue-500 bg-blue-50 px-2 rounded-full">牡</span>
                    ) : (
                      <span className="text-sm font-normal text-pink-500 bg-pink-50 px-2 rounded-full">牝</span>
                    )}
                    {calcAge(horse.birthYear) != null && (
                      <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2 rounded-full">
                        {calcAge(horse.birthYear)}歳
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {horse.surface ? (horse.surface === 'TURF' ? '芝' : horse.surface === 'DIRT' ? 'ダ' : '万能') : '未定'} / 
                    {horse.distanceMin || '?'}m ~ {horse.distanceMax || '?'}m
                  </CardDescription>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-600" onClick={() => handleEdit(horse)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600" onClick={() => handleDelete(horse.id, horse.name)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground block text-xs">成長型</span>
                  {horse.growthType ? getGrowthTypeLabelLocal(horse.growthType) : '-'}
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">気性・脚質</span>
                  {horse.temperament ? horse.temperament : '-'} / {horse.runningStyles?.length ? horse.runningStyles.join('・') : '-'}
                </div>
              </div>

              {(horse.starts != null || horse.wins != null || horse.g1Wins != null) && (
                <div className="grid grid-cols-3 gap-1 text-sm text-center bg-muted/30 rounded-md p-2">
                  <div>
                    <div className="text-xs text-muted-foreground">出走</div>
                    <div className="font-semibold">{horse.starts ?? '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">勝利</div>
                    <div className="font-semibold">{horse.wins ?? '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">G1</div>
                    <div className="font-semibold text-yellow-600">{horse.g1Wins ?? '-'}</div>
                  </div>
                </div>
              )}

              {(horse.speed || horse.guts || horse.acceleration || horse.power || horse.health || horse.intelligence || horse.spirit || horse.flexibility) && (
                <div className="grid grid-cols-4 gap-1 text-xs text-center">
                  {([
                    { label: 'SP', value: horse.speed },
                    { label: '根性', value: horse.guts },
                    { label: '瞬発', value: horse.acceleration },
                    { label: 'PW', value: horse.power },
                    { label: '健康', value: horse.health },
                    { label: '賢さ', value: horse.intelligence },
                    { label: '精神', value: horse.spirit },
                    { label: '柔軟', value: horse.flexibility },
                  ] as { label: string; value: string | undefined }[]).map(({ label, value }) => (
                    <div key={label} className="bg-slate-100 dark:bg-slate-800 rounded p-1">
                      <div className="text-muted-foreground">{label}</div>
                      <div className={`font-bold ${value === 'S' ? 'text-red-500' : value?.startsWith('A') ? 'text-orange-500' : value?.startsWith('B') ? 'text-yellow-600' : ''}`}>
                        {value ?? '-'}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {(horse.autoComment || horse.aiComment) && (
                <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-md border border-blue-100 dark:border-blue-900">
                  <h4 className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-1 flex items-center gap-1">
                    💡 育成アドバイス
                  </h4>
                  {horse.aiComment && (
                    <p className="text-sm text-blue-900/80 dark:text-blue-200/80 mb-2 whitespace-pre-wrap leading-relaxed">
                      【AI】 {horse.aiComment}
                    </p>
                  )}
                  {horse.autoComment && !horse.aiComment && (
                    <p className="text-sm text-blue-900/80 dark:text-blue-200/80 mb-1 leading-relaxed">
                      {horse.autoComment}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {racehorses?.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
            現役馬が登録されていません。「新規登録」から追加してください。
          </div>
        )}
      </div>

      <RacehorseFormDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        horse={editingHorse}
      />
    </div>
  );
};


