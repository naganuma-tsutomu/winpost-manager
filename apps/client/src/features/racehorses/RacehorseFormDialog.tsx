import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Racehorse, UpdateRacehorseDTO } from './api/useRacehorses.js';
import { useCreateRacehorse, useUpdateRacehorse, useAIAdvice } from './api/useRacehorses.js';
import { generateRuleBasedAdvice } from './utils/generateAdvice.js';
import { Sparkles, BrainCircuit, RefreshCw } from 'lucide-react';

interface DialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  horse: Racehorse | null;
}

export const RacehorseFormDialog: React.FC<DialogProps> = ({ isOpen, onOpenChange, horse }) => {
  const createMutation = useCreateRacehorse();
  const updateMutation = useUpdateRacehorse();
  const aiAdviceMutation = useAIAdvice();
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const { register, handleSubmit, reset, setValue, watch } = useForm<UpdateRacehorseDTO>({
    defaultValues: {
      gender: 'MALE',
      status: 'ACTIVE',
      spirit: 'NONE',
      health: 'NONE',
    }
  });

  const formValues = watch();

  useEffect(() => {
    if (isOpen) {
      if (horse) {
        reset(horse);
      } else {
        reset({
          name: '',
          birthYear: new Date().getFullYear() - 2, // 2歳デフォルト
          gender: 'MALE',
          status: 'ACTIVE',
          spirit: 'NONE',
          health: 'NONE',
          distanceMin: 1600,
          distanceMax: 2400,
        });
      }
    }
  }, [isOpen, horse, reset]);

  const onSubmit = async (data: UpdateRacehorseDTO) => {
    try {
      if (horse) {
        await updateMutation.mutateAsync({ id: horse.id, data });
      } else {
        await createMutation.mutateAsync(data as any);
      }
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      alert('保存に失敗しました');
    }
  };

  const handleGenerateRuleBased = () => {
    const advice = generateRuleBasedAdvice(formValues as any);
    setValue('autoComment', advice);
  };

  const handleGenerateAI = async () => {
    setIsGeneratingAI(true);
    try {
      const res = await aiAdviceMutation.mutateAsync(formValues);
      setValue('aiComment', res.advice);
    } catch (e) {
      console.error(e);
      alert('AIアドバイスの生成に失敗しました。Ollamaが起動しているか確認してください。');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{horse ? '現役馬の編集' : '現役馬の登録'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>馬名 <span className="text-red-500">*</span></Label>
              <Input {...register('name', { required: true })} placeholder="トウカイテイオー" />
            </div>
            
            <div className="space-y-2 flex flex-col justify-end">
              <Label className="mb-2">性別</Label>
              <select 
                {...register('gender')} 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="MALE">牡馬</option>
                <option value="FEMALE">牝馬</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>馬場適性</Label>
              <select {...register('surface')} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">不明</option>
                <option value="TURF">芝</option>
                <option value="DIRT">ダート</option>
                <option value="BOTH">万能</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>成長型</Label>
              <select {...register('growthType')} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">不明</option>
                <option value="SUPER_EARLY">超早熟</option>
                <option value="EARLY">早熟</option>
                <option value="NORMAL">普通</option>
                <option value="LATE">晩成</option>
                <option value="SUPER_LATE">超晩成</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>下限距離(m)</Label>
              <Input type="number" {...register('distanceMin', { valueAsNumber: true })} />
            </div>
            <div className="space-y-2">
              <Label>上限距離(m)</Label>
              <Input type="number" {...register('distanceMax', { valueAsNumber: true })} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>気性</Label>
              <select {...register('temperament')} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">不明</option>
                <option value="FIERCE">激</option>
                <option value="ROUGH">荒</option>
                <option value="NORMAL">普通</option>
                <option value="MILD">大人</option>
                <option value="SUPER_MILD">超</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>脚質</Label>
              <select {...register('runningStyle')} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">不明</option>
                <option value="GREAT_ESCAPE">大逃げ</option>
                <option value="ESCAPE">逃げ</option>
                <option value="LEADER">先行</option>
                <option value="CLOSER">差し</option>
                <option value="CHASER">追込</option>
                <option value="VERSATILE">自在</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>状態</Label>
              <select {...register('status')} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="ACTIVE">現役</option>
                <option value="RETIRED">引退</option>
              </select>
            </div>
          </div>

          {/* 成績 */}
          <div className="p-4 bg-muted/20 rounded-lg border space-y-3">
            <Label className="text-base font-semibold">成績</Label>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">出走数</Label>
                <Input type="number" min={0} {...register('starts', { valueAsNumber: true })} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">勝利数</Label>
                <Input type="number" min={0} {...register('wins', { valueAsNumber: true })} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">G1勝利数</Label>
                <Input type="number" min={0} {...register('g1Wins', { valueAsNumber: true })} placeholder="0" />
              </div>
            </div>
          </div>

          {/* 能力値 */}
          <div className="p-4 bg-muted/20 rounded-lg border space-y-3">
            <Label className="text-base font-semibold">能力値</Label>
            <div className="grid grid-cols-5 gap-3">
              {(['speed', 'stamina', 'power', 'guts', 'intelligence'] as const).map((field, i) => (
                <div key={field} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{['スピード', 'スタミナ', 'パワー', '根性', '賢さ'][i]}</Label>
                  <select {...register(field)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">-</option>
                    {['S', 'A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'E+', 'E', 'F'].map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-muted/30 rounded-lg border space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">育成アドバイス機能</Label>
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={handleGenerateRuleBased}
                  className="gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                  disabled={!formValues.growthType || !formValues.surface}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  自動生成 (ルール)
                </Button>
                <Button 
                  type="button" 
                  variant="secondary" 
                  size="sm" 
                  onClick={handleGenerateAI}
                  disabled={isGeneratingAI}
                  className="gap-1 bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                >
                  <BrainCircuit className="w-3.5 h-3.5" />
                  {isGeneratingAI ? 'AI生成中...' : 'AIで生成 (ローカルLLM)'}
                </Button>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Sparkles className="w-3 h-3" /> ルールベースコメント
                </Label>
                <textarea 
                  {...register('autoComment')} 
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm"
                  placeholder="自動生成ボタンを押すと、パラメータに応じた推奨ローテーションが出力されます。"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1 text-xs text-indigo-600/70">
                  <BrainCircuit className="w-3 h-3" /> AIコメント
                </Label>
                <textarea 
                  {...register('aiComment')} 
                  className="flex min-h-[80px] w-full rounded-md border border-indigo-100 bg-indigo-50/30 px-3 py-2 text-sm"
                  placeholder="AI生成ボタンを押すと、LLMが調教師としてアドバイスを出力します。"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>メモ</Label>
            <textarea 
              {...register('memo')} 
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              保存する
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
