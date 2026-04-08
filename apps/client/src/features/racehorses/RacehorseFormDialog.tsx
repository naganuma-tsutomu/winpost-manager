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

// ラジオボタングループ（ピル型）
function RadioGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T | ''; label: string }[];
  value: T | undefined | null;
  onChange: (v: T | undefined) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const selected = (value ?? '') === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value === '' ? undefined : (opt.value as T))}
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                selected
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-background text-muted-foreground border-input hover:border-blue-400 hover:text-blue-600'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// チェックボックスボタン（単一/複数対応）
function CheckboxGroup<T extends string>({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (v: T) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const checked = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onToggle(opt.value)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-sm border transition-colors ${
                checked
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-background text-muted-foreground border-input hover:border-emerald-400 hover:text-emerald-600'
              }`}
            >
              <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                checked ? 'bg-white border-white' : 'border-current'
              }`}>
                {checked && <span className="block w-2 h-2 bg-emerald-600 rounded-sm" />}
              </span>
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
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
  const surface = formValues.surface;
  const runningStyles = formValues.runningStyles ?? [];

  // 馬場適性チェックボックス状態
  const turfChecked = surface === 'TURF' || surface === 'BOTH';
  const dirtChecked = surface === 'DIRT' || surface === 'BOTH';

  const handleSurfaceToggle = (type: 'TURF' | 'DIRT') => {
    const newTurf = type === 'TURF' ? !turfChecked : turfChecked;
    const newDirt = type === 'DIRT' ? !dirtChecked : dirtChecked;
    if (newTurf && newDirt) setValue('surface', 'BOTH');
    else if (newTurf) setValue('surface', 'TURF');
    else if (newDirt) setValue('surface', 'DIRT');
    else setValue('surface', undefined);
  };

  // 脚質チェックボックス（複数選択可）
  const handleRunningStyleToggle = (val: string) => {
    const current = runningStyles as string[];
    setValue('runningStyles', current.includes(val) ? current.filter(v => v !== val) : [...current, val] as any);
  };

  useEffect(() => {
    if (isOpen) {
      if (horse) {
        reset(horse);
      } else {
        reset({
          name: '',
          birthYear: new Date().getFullYear() - 2,
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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* 馬名 */}
          <div className="space-y-2">
            <Label>馬名 <span className="text-red-500">*</span></Label>
            <Input {...register('name', { required: true })} placeholder="トウカイテイオー" />
          </div>

          {/* 性別・状態 */}
          <div className="grid grid-cols-2 gap-4">
            <RadioGroup
              label="性別"
              options={[
                { value: 'MALE', label: '牡' },
                { value: 'FEMALE', label: '牝' },
              ]}
              value={formValues.gender}
              onChange={(v) => setValue('gender', v ?? 'MALE')}
            />
            <RadioGroup
              label="状態"
              options={[
                { value: 'ACTIVE', label: '現役' },
                { value: 'RETIRED', label: '引退' },
              ]}
              value={formValues.status}
              onChange={(v) => setValue('status', v ?? 'ACTIVE')}
            />
          </div>

          {/* 成長型 */}
          <RadioGroup
            label="成長型"
            options={[
              { value: '', label: '不明' },
              { value: 'SUPER_EARLY', label: '超早熟' },
              { value: 'EARLY', label: '早熟' },
              { value: 'NORMAL', label: '普通' },
              { value: 'LATE', label: '晩成' },
              { value: 'SUPER_LATE', label: '超晩成' },
            ]}
            value={formValues.growthType}
            onChange={(v) => setValue('growthType', v as any)}
          />

          {/* 気性 */}
          <RadioGroup
            label="気性"
            options={[
              { value: '', label: '不明' },
              { value: 'FIERCE', label: '激' },
              { value: 'ROUGH', label: '荒' },
              { value: 'NORMAL', label: '普通' },
              { value: 'MILD', label: '大人' },
              { value: 'SUPER_MILD', label: '超大人' },
            ]}
            value={formValues.temperament}
            onChange={(v) => setValue('temperament', v as any)}
          />

          {/* 馬場適性 */}
          <CheckboxGroup
            label="馬場適性"
            options={[
              { value: 'TURF', label: '芝' },
              { value: 'DIRT', label: 'ダート' },
            ]}
            selected={[
              ...(turfChecked ? ['TURF' as const] : []),
              ...(dirtChecked ? ['DIRT' as const] : []),
            ]}
            onToggle={handleSurfaceToggle}
          />

          {/* 脚質 */}
          <CheckboxGroup
            label="脚質"
            options={[
              { value: 'GREAT_ESCAPE', label: '大逃げ' },
              { value: 'ESCAPE', label: '逃げ' },
              { value: 'LEADER', label: '先行' },
              { value: 'CLOSER', label: '差し' },
              { value: 'CHASER', label: '追込' },
              { value: 'VERSATILE', label: '自在' },
            ]}
            selected={runningStyles as any[]}
            onToggle={handleRunningStyleToggle}
          />

          {/* 距離 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>下限距離 (m)</Label>
              <Input type="number" {...register('distanceMin', { valueAsNumber: true })} />
            </div>
            <div className="space-y-2">
              <Label>上限距離 (m)</Label>
              <Input type="number" {...register('distanceMax', { valueAsNumber: true })} />
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

          {/* 育成アドバイス */}
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

          {/* メモ */}
          <div className="space-y-2">
            <Label>メモ</Label>
            <textarea
              {...register('memo')}
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
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
