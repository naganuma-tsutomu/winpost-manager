import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Check, Trash2, Calendar as CalendarIcon, Info } from 'lucide-react';
import { api } from '../../lib/api';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const FIXED_EVENTS = [
  // システム・進行関連
  { month: 1, week: 2, title: '海外幼駒購入', type: 'system', details: '海外の有力な1歳馬（幼駒）を購入できるタイミング。お守りを利用して強力な基礎繁殖馬などを導入できます。' },
  { month: 4, week: 2, title: '幼駒誕生', type: 'system', details: '所有する繁殖牝馬から当歳の幼駒が誕生します。' },
  { month: 5, week: 1, title: '種付け', type: 'important', details: '来年産まれる幼駒のための種付けを開始します。配合理論による爆発力が重要です。' },
  { month: 8, week: 1, title: '幼駒セリ', type: 'important', details: '国内の当歳馬・1歳馬セリが開催されます。' },
  { month: 12, week: 3, title: '海外セリ', type: 'important', details: '海外の輸入繁殖牝馬などのセリが開催されます。' },
  { month: 12, week: 4, title: '年末処理', type: 'system', details: '引退馬の判断、種牡馬入り、繁殖入り、殿堂入り、翌年の所有馬引き継ぎなどを行います。' },

  // クラシック三冠
  { month: 4, week: 3, title: '皐月賞', type: 'race', tags: ['三冠', '芝2000m', '3歳'], details: '【クラシック第1戦】中山 芝2000m 右回り (3歳牡牝)\n「最も速い馬が勝つ」と言われるクラシック初戦。' },
  { month: 5, week: 4, title: '日本ダービー', type: 'race', tags: ['三冠', '芝2400m', '3歳'], details: '【クラシック第2戦】東京 芝2400m 左回り (3歳牡牝)\n「最も運のある馬が勝つ」競馬の祭典。すべての3歳馬の目標。' },
  { month: 10, week: 4, title: '菊花賞', type: 'race', tags: ['三冠', '芝3000m', '3歳'], details: '【クラシック第3戦】京都 芝3000m 右回り (3歳牡牝)\n「最も強い馬が勝つ」長距離クラシック。三冠最終関門。' },

  // 牝馬三冠
  { month: 4, week: 2, title: '桜花賞', type: 'race', tags: ['牝馬三冠', '芝1600m', '3歳牝'], details: '【牝馬クラシック第1戦】阪神 芝1600m 右回り (3歳牝)' },
  { month: 5, week: 3, title: 'オークス', type: 'race', tags: ['牝馬三冠', '芝2400m', '3歳牝'], details: '【牝馬クラシック第2戦】東京 芝2400m 左回り (3歳牝)\n3歳牝馬の頂点決定戦。距離適性が問われる。' },
  { month: 10, week: 3, title: '秋華賞', type: 'race', tags: ['牝馬三冠', '芝2000m', '3歳牝'], details: '【牝馬クラシック第3戦】京都 芝2000m 右回り (3歳牝)\n牝馬三冠の最終関門。' },

  // 古馬王道 (中長距離)
  { month: 3, week: 5, title: '大阪杯', type: 'race', tags: ['芝2000m', '4歳上'], details: '【春の中距離王決定戦】阪神 芝2000m 右回り (4歳上)' },
  { month: 4, week: 4, title: '天皇賞（春）', type: 'race', tags: ['芝3200m', '4歳上'], details: '【伝統の長距離王決定戦】京都 芝3200m 右回り (4歳上)' },
  { month: 6, week: 4, title: '宝塚記念', type: 'race', tags: ['芝2200m', '3歳上'], details: '【春のグランプリ】阪神 芝2200m 右回り (3歳上)\nファン投票によって出走馬が選出される。' },
  { month: 10, week: 5, title: '天皇賞（秋）', type: 'race', tags: ['芝2000m', '3歳上'], details: '【秋の中距離王決定戦】東京 芝2000m 左回り (3歳上)' },
  { month: 11, week: 4, title: 'ジャパンカップ', type: 'race', tags: ['芝2400m', '3歳上'], details: '【国際招待レース】東京 芝2400m 左回り (3歳上)\n国内外のトップホースが集う最高峰レースの一つ。' },
  { month: 12, week: 4, title: '有馬記念', type: 'race', tags: ['芝2500m', '3歳上'], details: '【年末のグランプリ】中山 芝2500m 右回り (3歳上)\nファン投票によって出走馬が選出。一年の総決算。' },

  // 短距離・マイル
  { month: 3, week: 4, title: '高松宮記念', type: 'race', tags: ['芝1200m', '4歳上'], details: '【春の短距離王決定戦】中京 芝1200m 左回り (4歳上)' },
  { month: 6, week: 1, title: '安田記念', type: 'race', tags: ['芝1600m', '3歳上'], details: '【春のマイル王決定戦】東京 芝1600m 左回り (3歳上)' },
  { month: 9, week: 4, title: 'スプリンターズS', type: 'race', tags: ['芝1200m', '3歳上'], details: '【秋の短距離王決定戦】中山 芝1200m 右回り (3歳上)' },
  { month: 11, week: 3, title: 'マイルCS', type: 'race', tags: ['芝1600m', '3歳上'], details: '【秋のマイル王決定戦】京都 芝1600m 右回り (3歳上)' },

  // ダート
  { month: 2, week: 3, title: 'フェブラリーS', type: 'race', tags: ['ダ1600m', '4歳上'], details: '【ダートG1幕開け】東京 ダート1600m 左回り (4歳上)' },
  { month: 6, week: 4, title: '帝王賞', type: 'race', tags: ['ダ2000m', '4歳上'], details: '【上半期ダート王決定戦】大井 ダート2000m 右回り (4歳上)' },
  { month: 12, week: 1, title: 'チャンピオンズC', type: 'race', tags: ['ダ1800m', '3歳上'], details: '【秋のダート王決定戦】中京 ダート1800m 左回り (3歳上)' },

  // 海外主要
  { month: 2, week: 4, title: 'サウジカップ', type: 'race', tags: ['海外', 'ダ1800m', '4歳上'], details: '【世界最高賞金レース】サウジアラビア ダート1800m 左回り (4歳上)' },
  { month: 3, week: 5, title: 'ドバイWCミーティング', type: 'race', tags: ['海外', '複数G1'], details: '【ドバイワールドカップデー】メイダン競馬場\nダート2000mの世界最高峰ドバイWCをはじめ、シーマクラシック(芝2400m)やターフ(芝1800m)などが同日開催される。' },
  { month: 10, week: 1, title: '凱旋門賞', type: 'race', tags: ['海外', '芝2400m', '3歳上'], details: '【欧州最高峰レース】仏 ロンシャン 芝2400m 右回り (3歳上牡牝)\n日本馬の悲願とされる世界最高峰の芝レース。' },
  { month: 11, week: 1, title: 'BCミーティング', type: 'race', tags: ['海外', '複数G1'], details: '【米国ブリーダーズカップ】持ち回り\nBCクラシック（ダート2000m）やBCターフ（芝2400m）など各カテゴリーの世界王者が一堂に集うダートの祭典。' },
  { month: 12, week: 2, title: '香港国際競走', type: 'race', tags: ['海外', '複数G1'], details: '【香港国際競走】シャティン競馬場\n香港カップ（芝2000m）、香港マイル（芝1600m）、香港ヴァーズ（芝2400m）、香港スプリント（芝1200m）が同日開催。' },
];

export function CalendarPage() {
  const queryClient = useQueryClient();
  const [selectedYear, setSelectedYear] = useState<number>(2025);
  const [showModal, setShowModal] = useState(false);
  const [viewEventModal, setViewEventModal] = useState<{title: string, details: string, month: number, week: number} | null>(null);
  
  const [form, setForm] = useState({
    targetMonth: '1',
    targetWeek: '1',
    title: '',
    description: '',
  });

  const { data: dbEvents = [], isLoading } = useQuery({
    queryKey: ['calendar_events'],
    queryFn: api.calendar.events.list,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.calendar.events.create({ 
      ...data, 
      targetMonth: Number(data.targetMonth),
      targetWeek: Number(data.targetWeek),
      targetYear: selectedYear 
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar_events'] });
      setShowModal(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.calendar.events.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar_events'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.calendar.events.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar_events'] }),
  });

  // 1年分(12ヶ月)のデータを構築
  const yearlyCalendar = Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
    return {
      month,
      weeks: Array.from({ length: 4 }, (_, i) => i + 1).map((week) => {
        // その月週のイベントをマージ
        const weekEvents = [];
        const fixed = FIXED_EVENTS.filter(e => e.month === month && e.week === week);
        if (fixed.length > 0) {
          weekEvents.push(...fixed.map(f => ({ ...f, isFixed: true, id: `fixed-${f.title}` })));
        }

        const custom = dbEvents.filter(e => 
          e.targetMonth === month && 
          e.targetWeek === week && 
          (e.targetYear === null || e.targetYear === selectedYear)
        );
        if (custom.length > 0) {
          weekEvents.push(...custom.map(c => ({ ...c, isFixed: false })));
        }

        // 3月, 5月, 10月は5週がある場合を考慮
        if ((month === 3 || month === 5 || month === 10) && week === 4) {
          const w5fixed = FIXED_EVENTS.filter(e => e.month === month && e.week === 5);
          if (w5fixed.length > 0) weekEvents.push(...w5fixed.map(f => ({ ...f, isFixed: true, id: `fixed-${f.title}` })));
        }

        return { week, events: weekEvents };
      })
    };
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
        読み込み中...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">進行カレンダー・TODO</h1>
          <p className="text-slate-500 text-sm mt-1">ゲーム内のイベントとユーザー作成のTODOを年別に管理します。</p>
        </div>
        
        <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
          <CalendarIcon className="text-slate-400 w-5 h-5" />
          <div className="flex items-center">
            <input 
              type="number"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent border-none text-xl font-bold w-20 text-center focus:outline-none focus:ring-0 text-slate-800"
            />
            <span className="font-semibold text-slate-500">年</span>
          </div>
          <Button onClick={() => {
            setForm({ targetMonth: '1', targetWeek: '1', title: '', description: '' });
            setShowModal(true);
          }} className="ml-2">
            <Plus className="w-4 h-4 mr-2" /> TODO追加
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {yearlyCalendar.map((m) => (
          <Card key={m.month} className="shadow-sm border-slate-200 hover:shadow-md transition-shadow">
            <CardHeader className="bg-slate-50/50 pb-4 border-b border-slate-100">
              <CardTitle className="text-center text-xl text-slate-800">
                {m.month} <span className="text-sm text-slate-500 font-normal">月</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-3 space-y-3">
              {m.weeks.map(w => (
                <div key={w.week} className="flex gap-3">
                  <div className="w-8 shrink-0 text-center font-bold text-slate-400 text-sm pt-1.5">
                    {w.week}週
                  </div>
                  <div className="flex-1 space-y-2">
                    {w.events.length === 0 ? (
                      <div className="h-8 rounded-md border border-dashed border-slate-200 flex items-center justify-center opacity-50">
                        <span className="text-xs text-slate-400">-</span>
                      </div>
                    ) : (
                      w.events.map(e => (
                        <div 
                          key={e.id} 
                          onClick={() => {
                            if (e.details || e.description) {
                              setViewEventModal({
                                title: e.title,
                                details: e.details || e.description || '',
                                month: e.targetMonth || e.month,
                                week: e.targetWeek || e.week,
                              });
                            }
                          }}
                          className={`
                            relative group p-2.5 rounded-lg text-sm flex flex-col gap-1 transition-all
                            ${(e.details || e.description) ? 'cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-slate-300' : ''}
                            ${e.type === 'race' ? 'bg-blue-50 text-blue-800 border border-blue-100' : 
                              e.isFixed ? 'bg-slate-100 text-slate-800 border border-slate-200' : 
                              (e.isCompleted ? 'bg-slate-50 text-slate-400 border border-slate-200' : 'bg-amber-50 text-amber-800 border border-amber-200 shadow-sm')}
                          `}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className={`font-medium flex items-center gap-1.5 leading-tight ${e.isCompleted ? 'line-through' : ''}`}>
                              {e.type === 'important' && <span className="text-rose-500 font-bold">!</span>}
                              {e.type === 'race' && <span>🏆</span>}
                              {e.title}
                            </span>
                            
                            {!e.isFixed && (
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className={`h-6 w-6 ${e.isCompleted ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-100' : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100'}`}
                                  onClick={(evt) => {
                                    evt.stopPropagation();
                                    updateMutation.mutate({ 
                                      id: e.id, 
                                      data: { ...e, isCompleted: !e.isCompleted } 
                                    });
                                  }}
                                  title={e.isCompleted ? "未完了に戻す" : "完了にする"}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-6 w-6 text-rose-500 hover:text-rose-600 hover:bg-rose-100"
                                  onClick={(evt) => {
                                    evt.stopPropagation();
                                    if(confirm('削除しますか？')) deleteMutation.mutate(e.id);
                                  }}
                                  title="削除"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                          
                          {e.tags && e.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {e.tags.map((tag: string) => (
                                <span key={tag} className={`px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${
                                  tag.includes('芝') ? 'bg-emerald-100 text-emerald-800' :
                                  tag.includes('ダ') ? 'bg-amber-100/80 text-amber-900' :
                                  tag.includes('牝') ? 'bg-rose-100 text-rose-800' :
                                  'bg-white/60 text-slate-700'
                                }`}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          {(e.details || e.description) && (
                            <div className="text-xs opacity-70 flex items-center gap-1 mt-0.5">
                              <Info className="w-3 h-3" /> 詳細あり
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* TODO作成モーダル */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>TODOの追加</DialogTitle>
            <DialogDescription>
              カレンダーに新しい進行メモやTODOを追加します。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="month">対象月</Label>
                <Select value={form.targetMonth} onValueChange={(v) => setForm({...form, targetMonth: v})}>
                  <SelectTrigger id="month">
                    <SelectValue placeholder="月を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({length: 12}, (_, i) => i+1).map(m => (
                      <SelectItem key={m} value={m.toString()}>{m}月</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="week">対象週</Label>
                <Select value={form.targetWeek} onValueChange={(v) => setForm({...form, targetWeek: v})}>
                  <SelectTrigger id="week">
                    <SelectValue placeholder="週を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5].map(w => (
                      <SelectItem key={w} value={w.toString()}>{w}週</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="title">タイトル</Label>
              <Input 
                id="title"
                value={form.title} 
                onChange={e => setForm({...form, title: e.target.value})} 
                placeholder="例: ○○を凱旋門賞に登録" 
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">詳細・メモ内容 (任意)</Label>
              <textarea 
                id="desc"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={form.description} 
                onChange={e => setForm({...form, description: e.target.value})} 
                rows={3} 
                placeholder="例: 直前の週に放牧を挟む" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>キャンセル</Button>
            <Button 
              onClick={() => createMutation.mutate(form)} 
              disabled={!form.title || createMutation.isPending}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* イベント詳細モーダル */}
      <Dialog open={!!viewEventModal} onOpenChange={() => setViewEventModal(null)}>
        <DialogContent className="sm:max-w-[425px]">
          {viewEventModal && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  {viewEventModal.title}
                </DialogTitle>
                <DialogDescription>
                  {viewEventModal.month}月 {viewEventModal.week}週 のイベント
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-slate-700 leading-relaxed whitespace-pre-wrap text-sm">
                  {viewEventModal.details}
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => setViewEventModal(null)} className="w-full sm:w-auto">
                  閉じる
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
