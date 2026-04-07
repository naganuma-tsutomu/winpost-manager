import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Image as ImageIcon, Trash2, Calendar, Upload } from 'lucide-react';
import { api } from '../../lib/api';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function GalleryPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [form, setForm] = useState({
    title: '',
    content: '',
    eventDate: '', // ex: '2025年12月4週'
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['gallery'],
    queryFn: api.gallery.list,
  });

  const createMutation = useMutation({
    mutationFn: (formData: FormData) => api.gallery.create(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
      setShowModal(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.gallery.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gallery'] }),
  });

  const resetForm = () => {
    setForm({ title: '', content: '', eventDate: '' });
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = () => {
    const formData = new FormData();
    formData.append('title', form.title);
    formData.append('content', form.content);
    if (form.eventDate) formData.append('eventDate', form.eventDate);
    if (selectedFile) formData.append('image', selectedFile);

    createMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
        読み込み中...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">牧場史・ギャラリー</h1>
          <p className="text-slate-500 mt-1">ゲーム内のスクリーンショットと思い出を記録します。</p>
        </div>
        <Button onClick={() => setShowModal(true)} size="lg" className="shadow-sm">
          <Plus className="w-5 h-5 mr-2" /> 思い出を追加
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {entries.map((entry: any) => (
          <Card key={entry.id} className="overflow-hidden group hover:shadow-lg transition-all duration-300 border-slate-200">
            <div className="relative aspect-video bg-slate-900 overflow-hidden flex items-center justify-center">
              {entry.imageUrl ? (
                <img 
                  src={`http://localhost:3001${entry.imageUrl}`} 
                  alt={entry.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                />
              ) : (
                <ImageIcon className="w-12 h-12 text-slate-700" />
              )}
              {/* Overlay Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            
            <CardContent className="p-5 flex flex-col gap-3">
              <div className="flex justify-between items-start gap-2">
                <h3 className="font-bold text-lg text-slate-900 line-clamp-1 flex-1" title={entry.title}>
                  {entry.title}
                </h3>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-8 w-8 shrink-0 text-slate-400 hover:text-rose-500 hover:bg-rose-50 -mt-1 -mr-2"
                  onClick={() => {
                    if(confirm('削除しますか？')) deleteMutation.mutate(entry.id);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              
              {entry.eventDate && (
                <div className="flex items-center gap-1.5 text-sm text-slate-500 font-medium bg-slate-100 w-fit px-2 py-0.5 rounded-sm">
                  <Calendar className="w-3.5 h-3.5" />
                  {entry.eventDate}
                </div>
              )}
              
              <p className="text-slate-600 text-sm leading-relaxed max-h-20 overflow-y-auto scrollbar-thin">
                {entry.content}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-white rounded-xl border border-dashed border-slate-300">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <ImageIcon className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">まだ思い出がありません</h3>
          <p className="text-slate-500 max-w-sm mx-auto mb-6">
            印象に残ったレースのスクリーンショットや、名馬の記録を追加してギャラリーを作りましょう。
          </p>
          <Button variant="outline" onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4 mr-2" /> 最初の思い出を追加
          </Button>
        </div>
      )}

      {/* 追加モーダル */}
      <Dialog open={showModal} onOpenChange={(open) => {
        if (!open) resetForm();
        setShowModal(open);
      }}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="text-xl">思い出の追加</DialogTitle>
            <DialogDescription>
              スクリーンショットとテキストで、牧場の記録を残します。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-4">
            
            <div className="space-y-2">
              <Label htmlFor="title" className="text-slate-700">タイトル <span className="text-rose-500">*</span></Label>
              <Input 
                id="title"
                value={form.title} 
                onChange={e => setForm({...form, title: e.target.value})} 
                placeholder="例: 〇〇が三冠達成！" 
                className="bg-slate-50"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="date" className="text-slate-700">対象日付 (任意)</Label>
              <Input 
                id="date"
                value={form.eventDate} 
                onChange={e => setForm({...form, eventDate: e.target.value})} 
                placeholder="例: 2026年10月1週" 
                className="bg-slate-50"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700">画像 (任意)</Label>
              <div 
                className={`
                  border-2 border-dashed rounded-lg transition-colors overflow-hidden
                  ${previewUrl ? 'border-slate-200' : 'border-slate-300 hover:border-primary/50 bg-slate-50 relative'}
                `}
              >
                {previewUrl ? (
                  <div className="relative aspect-video bg-slate-900 group">
                    <img src={previewUrl} alt="プレビュー" className="w-full h-full object-contain" />
                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                        画像を変更
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 px-4 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-8 h-8 text-slate-400 mb-3" />
                    <p className="text-sm font-medium text-slate-700">クリックして画像をアップロード</p>
                    <p className="text-xs text-slate-500 mt-1">JPEG, PNG, WebPなどが対応しています</p>
                  </div>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content" className="text-slate-700">感想・記録 <span className="text-rose-500">*</span></Label>
              <textarea 
                id="content"
                className="flex min-h-[100px] w-full rounded-md border border-input bg-slate-50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={form.content} 
                onChange={e => setForm({...form, content: e.target.value})} 
                placeholder="圧倒的な強さだった。次は海外遠征を検討する。" 
              />
            </div>

          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowModal(false)}>キャンセル</Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!form.title || !form.content || createMutation.isPending}
            >
              保存する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
