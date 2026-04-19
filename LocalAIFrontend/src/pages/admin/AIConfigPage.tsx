import React, { useState } from 'react';
import { Check, Zap, FileText } from 'lucide-react';
import { mockLlmConfig, mockSystemPrompts } from '../../mocks/adminMocks';

type Tab = 'llm' | 'prompts';

const AIConfigPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('llm');
  const [config, setConfig] = useState(mockLlmConfig);
  const [prompts, setPrompts] = useState(mockSystemPrompts);
  const [editPromptId, setEditPromptId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [savedConfig, setSavedConfig] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const testConnection = () => {
    setTestResult('testing');
    setTimeout(() => setTestResult('ok'), 1200);
  };

  const activatePrompt = (id: number) => {
    setPrompts(prev => prev.map(p => ({ ...p, is_active: p.id === id })));
  };

  const savePromptEdit = () => {
    setPrompts(prev => prev.map(p => p.id === editPromptId ? { ...p, content: editContent } : p));
    setEditPromptId(null);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-[20px] font-bold text-text-primary">Cấu hình AI</h1>
        <p className="text-[13px] text-text-muted mt-0.5">Cài đặt mô hình LLM và system prompts</p>
      </div>

      <div className="flex gap-1 bg-surface border border-border rounded-xl p-1 w-fit">
        {[{ key: 'llm', label: 'LLM Config', icon: Zap }, { key: 'prompts', label: 'System Prompts', icon: FileText }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as Tab)} className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors flex items-center gap-1.5 ${tab === t.key ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary hover:bg-hover'}`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'llm' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-elevated border border-border rounded-xl p-5 space-y-4">
            <p className="text-[14px] font-semibold text-text-primary">Cấu hình mô hình</p>

            <div>
              <label className="text-[12px] text-text-secondary mb-1.5 block">Tên mô hình (Ollama)</label>
              <input value={config.model_name} onChange={e => setConfig(c => ({ ...c, model_name: e.target.value }))} className="input-base" />
            </div>

            <div>
              <label className="text-[12px] text-text-secondary mb-1.5 block">Ollama Base URL</label>
              <input value={config.ollama_base_url} onChange={e => setConfig(c => ({ ...c, ollama_base_url: e.target.value }))} className="input-base font-mono text-[13px]" />
            </div>

            <div>
              <label className="text-[12px] text-text-secondary mb-2 block">
                Temperature: <span className="text-accent font-semibold">{config.temperature}</span>
              </label>
              <input
                type="range" min="0" max="1" step="0.05"
                value={config.temperature}
                onChange={e => setConfig(c => ({ ...c, temperature: parseFloat(e.target.value) }))}
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
                type="number" value={config.context_window}
                onChange={e => setConfig(c => ({ ...c, context_window: Number(e.target.value) }))}
                className="input-base"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={testConnection} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-[13px] text-text-secondary hover:bg-hover transition-colors">
                {testResult === 'testing' ? <span className="w-3.5 h-3.5 border border-accent border-t-transparent rounded-full animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                {testResult === 'testing' ? 'Đang kiểm tra...' : testResult === 'ok' ? '✓ Kết nối OK' : 'Test kết nối'}
              </button>
              <button onClick={() => setSavedConfig(true)} className="flex-1 py-1.5 rounded-lg bg-accent text-white text-[13px] font-semibold hover:bg-accent-hover transition-colors">
                {savedConfig ? '✓ Đã lưu' : 'Lưu cấu hình'}
              </button>
            </div>
          </div>

          <div className="bg-elevated border border-border rounded-xl p-5 space-y-4">
            <p className="text-[14px] font-semibold text-text-primary">Mô hình hỗ trợ</p>
            {[
              { label: 'Embedding Model', value: config.embedding_model },
              { label: 'Reranker Model', value: config.reranker_model },
            ].map(({ label, value }) => (
              <div key={label} className="p-3 bg-base rounded-lg border border-border">
                <p className="text-[11px] text-text-muted uppercase tracking-wide mb-1">{label}</p>
                <p className="text-[12px] font-mono text-text-secondary">{value}</p>
              </div>
            ))}
            <div className="p-3 bg-base rounded-lg border border-border">
              <p className="text-[11px] text-text-muted uppercase tracking-wide mb-1">Tìm kiếm</p>
              <p className="text-[12px] text-text-secondary">Hybrid Search (ChromaDB semantic + SQLite FTS5)</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'prompts' && (
        <div className="space-y-4">
          {prompts.map(prompt => (
            <div key={prompt.id} className={`bg-elevated border rounded-xl overflow-hidden transition-colors ${prompt.is_active ? 'border-accent/40' : 'border-border'}`}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-3">
                  <p className="text-[14px] font-semibold text-text-primary">{prompt.name}</p>
                  <span className="text-[11px] text-text-muted">v{prompt.version} · {prompt.created_at}</span>
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
                    onClick={() => { setEditPromptId(prompt.id); setEditContent(prompt.content); }}
                    className="text-[12px] px-2.5 py-1 rounded-lg border border-border text-text-secondary hover:bg-hover transition-colors"
                  >
                    Chỉnh sửa
                  </button>
                </div>
              </div>

              {editPromptId === prompt.id ? (
                <div className="p-4 space-y-3">
                  <textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    rows={5}
                    className="input-base resize-none leading-relaxed"
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setEditPromptId(null)} className="px-3 py-1.5 border border-border rounded-lg text-[13px] text-text-secondary hover:bg-hover transition-colors">Hủy</button>
                    <button onClick={savePromptEdit} className="px-3 py-1.5 rounded-lg bg-accent text-white text-[13px] font-semibold hover:bg-accent-hover transition-colors flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Lưu</button>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-3">
                  <p className="text-[13px] text-text-secondary leading-relaxed">{prompt.content}</p>
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
