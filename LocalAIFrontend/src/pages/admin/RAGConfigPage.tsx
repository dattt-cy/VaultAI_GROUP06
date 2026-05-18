import React, { useState, useEffect, useCallback } from 'react';
import { Sliders, Save, RefreshCw, AlertTriangle } from 'lucide-react';
import { apiGet, apiPut } from '../../utils/apiClient';
import { PageHeader } from '../../components/admin/ui/PageHeader';
import { SkeletonPanel } from '../../components/admin/ui/Skeleton';
import { useToast } from '../../components/admin/ui/Toast';

interface RAGConfig {
  parent_chunk_size: number;
  parent_chunk_overlap: number;
  child_chunk_size: number;
  child_chunk_overlap: number;
  embedding_model: string;
  reranker_model: string;
  top_k_retrieval: number;
  hybrid_search_alpha: number;
}

const RAGConfigPage: React.FC = () => {
  const [config, setConfig] = useState<RAGConfig | null>(null);
  const [form, setForm] = useState<RAGConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [chunkChanged, setChunkChanged] = useState(false);
  const toast = useToast();

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') toast.success(msg); else toast.error(msg);
  };

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet('/api/admin/rag-config');
      if (!res.ok) throw new Error('Không thể tải cấu hình RAG');
      const data: RAGConfig = await res.json();
      setConfig(data);
      setForm(data);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleChange = (key: keyof RAGConfig, value: string | number) => {
    if (!form) return;
    const updated = { ...form, [key]: value };
    setForm(updated);
    if (config && (
      key === 'parent_chunk_size' || key === 'parent_chunk_overlap' ||
      key === 'child_chunk_size' || key === 'child_chunk_overlap' ||
      key === 'embedding_model'
    )) {
      const chunkKeys: (keyof RAGConfig)[] = ['parent_chunk_size', 'parent_chunk_overlap', 'child_chunk_size', 'child_chunk_overlap', 'embedding_model'];
      const anyChanged = chunkKeys.some(k => k === key ? value !== config[k] : (updated[k] !== config[k]));
      setChunkChanged(anyChanged);
    }
  };

  const handleSave = async () => {
    if (!form || !config) return;
    setSaving(true);
    try {
      const changes: Partial<RAGConfig> = {};
      (Object.keys(form) as (keyof RAGConfig)[]).forEach(k => {
        if (form[k] !== config[k]) (changes as any)[k] = form[k];
      });
      if (Object.keys(changes).length === 0) {
        showToast('Không có thay đổi nào.', 'error');
        return;
      }
      const res = await apiPut('/api/admin/rag-config', changes);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Lỗi khi lưu');
      }
      setConfig(form);
      setChunkChanged(false);
      showToast('Cấu hình RAG đã được lưu thành công.');
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) {
    return (
      <div className="space-y-5 animate-fade-in">
        <PageHeader
          title="Cấu hình RAG"
          subtitle="Điều chỉnh chunking, embedding và retrieval"
          icon={<Sliders className="w-5 h-5 text-text-secondary" />}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SkeletonPanel rows={4} />
          <SkeletonPanel rows={4} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Cấu hình RAG"
        subtitle="Điều chỉnh chunking, embedding và retrieval"
        icon={<Sliders className="w-5 h-5 text-text-secondary" />}
        actions={
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            Lưu cấu hình
          </button>
        }
      />

      {chunkChanged && (
        <div className="flex items-start gap-3 bg-warning/10 border border-warning/30 rounded-lg p-4 text-[13px] text-warning">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Lưu ý quan trọng</p>
            <p className="text-warning/80 mt-0.5">Thay đổi chunk size hoặc embedding model yêu cầu reindex lại toàn bộ tài liệu. Chất lượng tìm kiếm sẽ bị ảnh hưởng cho đến khi reindex hoàn tất.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Chunking Settings */}
        <div className="bg-elevated border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Sliders size={16} className="text-accent" />
            <h2 className="text-sm font-semibold text-text-primary">Cài đặt Chunking</h2>
          </div>

          <NumberField
            label="Parent chunk size (tokens)"
            hint="Đưa vào LLM context — ngữ cảnh đầy đủ"
            value={form.parent_chunk_size}
            onChange={v => handleChange('parent_chunk_size', v)}
            min={100} max={4000}
          />
          <NumberField
            label="Parent chunk overlap (tokens)"
            value={form.parent_chunk_overlap}
            onChange={v => handleChange('parent_chunk_overlap', v)}
            min={0} max={500}
          />
          <NumberField
            label="Child chunk size (tokens)"
            hint="Dùng để embed + retrieval — tìm kiếm chính xác"
            value={form.child_chunk_size}
            onChange={v => handleChange('child_chunk_size', v)}
            min={50} max={1000}
          />
          <NumberField
            label="Child chunk overlap (tokens)"
            value={form.child_chunk_overlap}
            onChange={v => handleChange('child_chunk_overlap', v)}
            min={0} max={200}
          />
        </div>

        {/* Retrieval & Model Settings */}
        <div className="space-y-4">
          <div className="bg-elevated border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Sliders size={16} className="text-accent" />
              <h2 className="text-sm font-semibold text-text-primary">Cài đặt Retrieval</h2>
            </div>
            <NumberField
              label="Top K retrieval"
              hint="Số chunk lấy ra trước khi rerank"
              value={form.top_k_retrieval}
              onChange={v => handleChange('top_k_retrieval', v)}
              min={1} max={50}
            />
            <div>
              <label className="block text-xs text-text-muted mb-1">
                Hybrid search alpha
                <span className="ml-1 text-text-muted/60">(0 = BM25 thuần, 1 = Semantic thuần)</span>
              </label>
              <input
                type="range"
                min={0} max={1} step={0.05}
                value={form.hybrid_search_alpha}
                onChange={e => handleChange('hybrid_search_alpha', parseFloat(e.target.value))}
                className="w-full accent-accent"
              />
              <div className="flex justify-between text-[10px] text-text-muted mt-1">
                <span>0 — BM25 (từ khóa)</span>
                <span className="font-medium text-text-primary">{form.hybrid_search_alpha}</span>
                <span>1 — Semantic</span>
              </div>
            </div>
          </div>

          <div className="bg-elevated border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Sliders size={16} className="text-accent" />
              <h2 className="text-sm font-semibold text-text-primary">Model AI</h2>
            </div>
            <TextField
              label="Embedding model"
              hint="Model encode văn bản thành vector"
              value={form.embedding_model}
              onChange={v => handleChange('embedding_model', v)}
            />
            <TextField
              label="Reranker model"
              hint="Cross-encoder sắp xếp lại kết quả tìm kiếm"
              value={form.reranker_model}
              onChange={v => handleChange('reranker_model', v)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const NumberField: React.FC<{
  label: string; hint?: string; value: number;
  onChange: (v: number) => void; min?: number; max?: number;
}> = ({ label, hint, value, onChange, min, max }) => (
  <div>
    <label className="block text-xs text-text-muted mb-1">
      {label}
      {hint && <span className="ml-1 text-text-muted/60">— {hint}</span>}
    </label>
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={e => onChange(parseInt(e.target.value) || 0)}
      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
    />
  </div>
);

const TextField: React.FC<{
  label: string; hint?: string; value: string; onChange: (v: string) => void;
}> = ({ label, hint, value, onChange }) => (
  <div>
    <label className="block text-xs text-text-muted mb-1">
      {label}
      {hint && <span className="ml-1 text-text-muted/60">— {hint}</span>}
    </label>
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
    />
  </div>
);

export default RAGConfigPage;
