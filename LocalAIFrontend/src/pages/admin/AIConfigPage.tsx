import React, { useState, useEffect, useCallback } from 'react';
import { Check, Zap, FileText, Settings2 } from 'lucide-react';
import { apiGet, apiPut, apiPost } from '../../utils/apiClient';
import { PageHeader } from '../../components/admin/ui/PageHeader';
import { SkeletonPanel } from '../../components/admin/ui/Skeleton';
import { EmptyState } from '../../components/admin/ui/EmptyState';
import { useToast } from '../../components/admin/ui/Toast';

interface LlmConfig {
  id: number;
  model_name: string;
  temperature: number;
  context_window_limit: number;
  max_new_tokens: number;
  is_active: boolean;
}

interface SystemPrompt {
  id: number;
  version_name: string;
  description: string;
  prompt_content: string;
  is_active: boolean;
  created_at: string;
}

type Tab = 'llm' | 'prompts';

const AIConfigPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('llm');
  const [config, setConfig] = useState<LlmConfig | null>(null);
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [editPromptId, setEditPromptId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [savedConfig, setSavedConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();

  const fetchConfig = useCallback(async () => {
    try {
      const res = await apiGet('/api/admin/ai-config');
      const data = await res.json();
      if (data.active !== false) setConfig(data);
    } catch (err) {
      toast.error('Không tải được cấu hình AI', String(err));
    }
  }, []);

  const fetchPrompts = useCallback(async () => {
    try {
      const res = await apiGet('/api/admin/system-prompts');
      setPrompts(await res.json());
    } catch (err) {
      toast.error('Không tải được system prompts', String(err));
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchConfig(), fetchPrompts()]).finally(() => setIsLoading(false));
  }, [fetchConfig, fetchPrompts]);

  const testConnection = async () => {
    setTestResult('testing');
    try {
      const res = await apiPost('/api/admin/ai-config/test-connection');
      const data = await res.json();
      setTestResult(data.online ? 'ok' : 'fail');
      if (data.online) toast.success('Kết nối Ollama thành công');
      else toast.error('Không kết nối được Ollama');
    } catch {
      setTestResult('fail');
      toast.error('Test kết nối thất bại');
    }
  };

  const saveConfig = async () => {
    if (!config) return;
    setSavingConfig(true);
    try {
      await apiPut('/api/admin/ai-config', {
        model_name: config.model_name,
        temperature: config.temperature,
        context_window_limit: config.context_window_limit,
        max_new_tokens: config.max_new_tokens,
      });
      setSavedConfig(true);
      toast.success('Đã lưu cấu hình LLM');
    } catch (err) {
      toast.error('Lưu cấu hình thất bại', String(err));
    } finally {
      setSavingConfig(false);
    }
  };

  const activatePrompt = async (id: number) => {
    try {
      await apiPost(`/api/admin/system-prompts/${id}/activate`);
      toast.success('Đã kích hoạt prompt');
      fetchPrompts();
    } catch (err) {
      toast.error('Kích hoạt thất bại', String(err));
    }
  };

  const savePromptEdit = async () => {
    try {
      await apiPut(`/api/admin/system-prompts/${editPromptId}`, { prompt_content: editContent });
      setEditPromptId(null);
      toast.success('Đã lưu prompt');
      fetchPrompts();
    } catch (err) {
      toast.error('Lưu prompt thất bại', String(err));
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Cấu hình AI"
        subtitle="Cài đặt mô hình LLM và system prompts"
        icon={<Settings2 className="w-5 h-5 text-text-secondary" />}
      />

      <div className="flex gap-1 bg-surface border border-border rounded-xl p-1 w-fit">
        {[{ key: 'llm', label: 'LLM Config', icon: Zap }, { key: 'prompts', label: 'System Prompts', icon: FileText }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as Tab)} className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors flex items-center gap-1.5 ${tab === t.key ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary hover:bg-hover'}`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'llm' && config && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-elevated border border-border rounded-xl p-5 space-y-4">
            <p className="text-[14px] font-semibold text-text-primary">Cấu hình mô hình</p>

            <div>
              <label className="text-[12px] text-text-secondary mb-1.5 block">Tên mô hình (Ollama)</label>
              <input
                value={config.model_name}
                onChange={e => { setConfig(c => c ? { ...c, model_name: e.target.value } : c); setSavedConfig(false); }}
                className="input-base"
              />
            </div>

            <div>
              <label className="text-[12px] text-text-secondary mb-2 block">
                Temperature: <span className="text-accent font-semibold">{config.temperature}</span>
              </label>
              <input
                type="range" min="0" max="1" step="0.05"
                value={config.temperature}
                onChange={e => { setConfig(c => c ? { ...c, temperature: parseFloat(e.target.value) } : c); setSavedConfig(false); }}
                className="w-full accent-accent"
              />
              <div className="flex justify-between text-[11px] text-text-muted mt-1">
                <span>0 — Chính xác</span>
                <span>1 — Sáng tạo</span>
              </div>
            </div>

            <div>
              <label className="text-[12px] text-text-secondary mb-1.5 block">Context Window (tokens)</label>
              <input
                type="number"
                value={config.context_window_limit}
                onChange={e => { setConfig(c => c ? { ...c, context_window_limit: Number(e.target.value) } : c); setSavedConfig(false); }}
                className="input-base"
              />
            </div>

            <div>
              <label className="text-[12px] text-text-secondary mb-1.5 block">Max New Tokens</label>
              <input
                type="number"
                value={config.max_new_tokens}
                onChange={e => { setConfig(c => c ? { ...c, max_new_tokens: Number(e.target.value) } : c); setSavedConfig(false); }}
                className="input-base"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={testConnection} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-[13px] text-text-secondary hover:bg-hover transition-colors">
                {testResult === 'testing' ? <span className="w-3.5 h-3.5 border border-accent border-t-transparent rounded-full animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                {testResult === 'testing' ? 'Đang kiểm tra...' : testResult === 'ok' ? '✓ Kết nối OK' : testResult === 'fail' ? '✗ Lỗi kết nối' : 'Test kết nối'}
              </button>
              <button onClick={saveConfig} disabled={savingConfig} className="flex-1 py-1.5 rounded-lg bg-accent text-white text-[13px] font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50">
                {savingConfig ? 'Đang lưu...' : savedConfig ? '✓ Đã lưu' : 'Lưu cấu hình'}
              </button>
            </div>
          </div>

          <div className="bg-elevated border border-border rounded-xl p-5 space-y-4">
            <p className="text-[14px] font-semibold text-text-primary">Thông tin hệ thống</p>
            <div className="p-3 bg-base rounded-lg border border-border">
              <p className="text-[11px] text-text-muted uppercase tracking-wide mb-1">Model ID</p>
              <p className="text-[12px] font-mono text-text-secondary">{config.model_name}</p>
            </div>
            <div className="p-3 bg-base rounded-lg border border-border">
              <p className="text-[11px] text-text-muted uppercase tracking-wide mb-1">Tìm kiếm</p>
              <p className="text-[12px] text-text-secondary">Hybrid Search (ChromaDB semantic + SQLite FTS5)</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'llm' && isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SkeletonPanel rows={4} />
          <SkeletonPanel rows={2} />
        </div>
      )}

      {tab === 'llm' && !isLoading && !config && (
        <EmptyState
          icon={Zap}
          title="Chưa có cấu hình LLM"
          description="Backend chưa tạo bản ghi config — kiểm tra database."
        />
      )}

      {tab === 'prompts' && (
        <div className="space-y-4">
          {isLoading && <SkeletonPanel rows={3} />}
          {!isLoading && prompts.length === 0 && (
            <EmptyState icon={FileText} title="Chưa có system prompt nào" compact />
          )}
          {prompts.map(prompt => (
            <div key={prompt.id} className={`bg-elevated border rounded-xl overflow-hidden transition-colors ${prompt.is_active ? 'border-accent/40' : 'border-border'}`}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-3">
                  <p className="text-[14px] font-semibold text-text-primary">{prompt.version_name}</p>
                  <span className="text-[11px] text-text-muted">{prompt.created_at?.split('T')[0]}</span>
                  {prompt.is_active && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30 font-semibold">Đang dùng</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!prompt.is_active && (
                    <button onClick={() => activatePrompt(prompt.id)} className="text-[12px] px-2.5 py-1 rounded-lg border border-accent/40 text-accent hover:bg-accent/10 transition-colors font-medium">
                      Kích hoạt
                    </button>
                  )}
                  <button
                    onClick={() => { setEditPromptId(prompt.id); setEditContent(prompt.prompt_content); }}
                    className="text-[12px] px-2.5 py-1 rounded-lg border border-border text-text-secondary hover:bg-hover transition-colors"
                  >
                    Chỉnh sửa
                  </button>
                </div>
              </div>

              {editPromptId === prompt.id ? (
                <div className="p-4 space-y-3">
                  <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={5} className="input-base resize-none leading-relaxed" />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setEditPromptId(null)} className="px-3 py-1.5 border border-border rounded-lg text-[13px] text-text-secondary hover:bg-hover transition-colors">Hủy</button>
                    <button onClick={savePromptEdit} className="px-3 py-1.5 rounded-lg bg-accent text-white text-[13px] font-semibold hover:bg-accent-hover transition-colors flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Lưu</button>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-3">
                  <p className="text-[13px] text-text-secondary leading-relaxed whitespace-pre-wrap">{prompt.prompt_content}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AIConfigPage;
