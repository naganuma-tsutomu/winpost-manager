import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: api.settings.get,
  });

  const [ollamaUrl, setOllamaUrl] = useState('');
  const [ollamaModel, setOllamaModel] = useState('');
  const [saved, setSaved] = useState(false);

  // dataが読み込まれたら初期値をセット（一度だけ）
  const [initialized, setInitialized] = useState(false);
  if (data && !initialized) {
    setOllamaUrl(data.ollamaUrl);
    setOllamaModel(data.ollamaModel);
    setInitialized(true);
  }

  const mutation = useMutation({
    mutationFn: () => api.settings.update({ ollamaUrl, ollamaModel }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  if (isLoading) {
    return <div className="text-slate-500">読み込み中...</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">設定</h1>
        <p className="text-slate-500 mt-1 text-sm">アプリケーションの設定を変更します</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <h2 className="text-base font-semibold text-slate-800">Ollama 設定</h2>

        <div className="space-y-1">
          <label htmlFor="ollama-url" className="block text-sm font-medium text-slate-700">
            Ollama URL
          </label>
          <input
            id="ollama-url"
            type="text"
            value={ollamaUrl}
            onChange={(e) => setOllamaUrl(e.target.value)}
            placeholder="http://localhost:11434"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <p className="text-xs text-slate-400">OllamaサーバーのベースURL</p>
        </div>

        <div className="space-y-1">
          <label htmlFor="ollama-model" className="block text-sm font-medium text-slate-700">
            モデル名
          </label>
          <input
            id="ollama-model"
            type="text"
            value={ollamaModel}
            onChange={(e) => setOllamaModel(e.target.value)}
            placeholder="llama3"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <p className="text-xs text-slate-400">使用するOllamaモデル名（例: llama3, gemma3, qwen2.5）</p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {mutation.isPending ? '保存中...' : '保存'}
          </button>
          {saved && (
            <span className="text-sm text-green-600 font-medium">保存しました</span>
          )}
          {mutation.isError && (
            <span className="text-sm text-red-600">保存に失敗しました</span>
          )}
        </div>
      </div>
    </div>
  );
}
