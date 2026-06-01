import React, { useState, useEffect, useCallback } from 'react';
import { Cpu, Trash2, Download, CheckCircle, RefreshCw, X, ChevronRight } from 'lucide-react';
import { apiGet, apiPut, apiDelete, API_BASE } from '../../utils/apiClient';
import { PageHeader } from '../../components/admin/ui/PageHeader';
import { Skeleton } from '../../components/admin/ui/Skeleton';
import { EmptyState } from '../../components/admin/ui/EmptyState';
import { useToast } from '../../components/admin/ui/Toast';

interface OllamaModel {
  name: string;
  size_gb: number;
  modified_at: string;
  digest: string;
  details: { family?: string; parameter_size?: string; quantization_level?: string };
}

interface ActiveConfig {
  model_name: string;
}

const ModelManagementPage: React.FC = () => {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [activeModel, setActiveModel] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pull modal
  const [showPullModal, setShowPullModal] = useState(false);
  const [pullInput, setPullInput] = useState('');
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState<string>('');
  const [pullPercent, setPullPercent] = useState<number>(0);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [settingActive, setSettingActive] = useState<string | null>(null);
  const toast = useToast();

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') toast.success(msg); else toast.error(msg);
  };

  const fetchModels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [modelsRes, configRes] = await Promise.all([
        apiGet('/api/admin/ollama/models'),
        apiGet('/api/admin/ai-config'),
      ]);
      if (!modelsRes.ok) throw new Error('Không thể tải danh sách model');
      const modelsData = await modelsRes.json();
      const configData: ActiveConfig = await configRes.json();
      setModels(modelsData.models || []);
      setActiveModel(configData.model_name || '');
    } catch (e: any) {
      setError(e.message || 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchModels(); }, [fetchModels]);

  const handleSetActive = async (modelName: string) => {
    setSettingActive(modelName);
    try {
      const res = await apiGet('/api/admin/ai-config');
      const config = await res.json();
      const putRes = await apiPut('/api/admin/ai-config', { ...config, model_name: modelName });
      if (!putRes.ok) throw new Error('Không thể cập nhật model');
      setActiveModel(modelName);
      showToast(`Đã đặt '${modelName}' làm model đang dùng.`);
    } catch (e: any) {
      showToast(e.message || 'Lỗi khi cập nhật', 'error');
    } finally {
      setSettingActive(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await apiDelete(`/api/admin/ollama/models/${encodeURIComponent(deleteTarget)}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Lỗi khi xóa model');
      }
      showToast(`Đã xóa model '${deleteTarget}'.`);
      setDeleteTarget(null);
      fetchModels();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handlePull = async () => {
    if (!pullInput.trim()) return;
    setPulling(true);
    setPullProgress('Đang kết nối...');
    setPullPercent(0);
    try {
      const response = await fetch(`${API_BASE}/api/admin/ollama/models/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ model_name: pullInput.trim() }),
      });
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('Không thể đọc stream');
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          try {
            const json = JSON.parse(line.slice(6));
            if (json.error) throw new Error(json.error);
            if (json.status === 'done') {
              setPullProgress('Hoàn thành!');
              setPullPercent(100);
            } else {
              const status = json.status || '';
              const completed = json.completed || 0;
              const total = json.total || 0;
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
              setPullProgress(status);
              if (pct > 0) setPullPercent(pct);
            }
          } catch (parseErr: any) {
            if (parseErr.message && !parseErr.message.includes('JSON')) throw parseErr;
          }
        }
      }
      showToast(`Đã pull model '${pullInput.trim()}' thành công.`);
      setShowPullModal(false);
      setPullInput('');
      fetchModels();
    } catch (e: any) {
      showToast(e.message || 'Lỗi khi pull model', 'error');
    } finally {
      setPulling(false);
    }
  };

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
    catch { return iso; }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Quản lý Model"
        subtitle="Quản lý các model Ollama đã cài đặt trên hệ thống"
        icon={<Cpu className="w-5 h-5 text-text-secondary" />}
        actions={
          <>
            <button
              onClick={fetchModels}
              disabled={loading}
              aria-label="Làm mới danh sách model"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-elevated border border-border text-text-secondary hover:text-text-primary text-[12px] font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Làm mới</span>
            </button>
            <button
              onClick={() => { setShowPullModal(true); setPullProgress(''); setPullPercent(0); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-[13px] font-semibold transition-colors cursor-pointer"
            >
              <Download size={14} />
              Pull Model
            </button>
          </>
        }
      />

      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 text-[13px] text-danger flex items-center gap-2">
          <X className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Models Table */}
      <div className="bg-elevated border border-border rounded-xl overflow-hidden">
        {loading && models.length === 0 ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" rounded="lg" />
            ))}
          </div>
        ) : models.length === 0 ? (
          <EmptyState
            icon={Cpu}
            title="Chưa có model nào"
            description="Bấm 'Pull Model' để tải model Ollama đầu tiên."
            compact
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="text-left px-4 py-3 text-text-muted font-medium">Tên model</th>
                <th className="text-left px-4 py-3 text-text-muted font-medium">Kích thước</th>
                <th className="text-left px-4 py-3 text-text-muted font-medium">Thông số</th>
                <th className="text-left px-4 py-3 text-text-muted font-medium">Cập nhật</th>
                <th className="text-left px-4 py-3 text-text-muted font-medium">Trạng thái</th>
                <th className="text-right px-4 py-3 text-text-muted font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {models.map((model) => {
                const isActive = model.name === activeModel;
                return (
                  <tr key={model.name} className="border-b border-border last:border-0 hover:bg-surface/50">
                    <td className="px-4 py-3 font-mono text-text-primary text-xs">{model.name}</td>
                    <td className="px-4 py-3 text-text-secondary">{model.size_gb} GB</td>
                    <td className="px-4 py-3 text-text-muted text-xs">
                      {model.details.parameter_size && <span className="mr-2">{model.details.parameter_size}</span>}
                      {model.details.quantization_level && <span className="bg-border px-1.5 py-0.5 rounded text-[10px]">{model.details.quantization_level}</span>}
                    </td>
                    <td className="px-4 py-3 text-text-muted">{formatDate(model.modified_at)}</td>
                    <td className="px-4 py-3">
                      {isActive ? (
                        <span className="flex items-center gap-1 text-green-400 text-xs font-medium">
                          <CheckCircle size={12} /> Đang dùng
                        </span>
                      ) : (
                        <span className="text-text-muted text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {!isActive && (
                          <button
                            onClick={() => handleSetActive(model.name)}
                            disabled={settingActive === model.name}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-50"
                          >
                            {settingActive === model.name ? <RefreshCw size={11} className="animate-spin" /> : <ChevronRight size={11} />}
                            Dùng model này
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteTarget(model.name)}
                          disabled={isActive}
                          title={isActive ? 'Không thể xóa model đang dùng' : 'Xóa model'}
                          className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-400/10 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pull Modal */}
      {showPullModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">Pull Model mới</h2>
              <button onClick={() => !pulling && setShowPullModal(false)} className="text-text-muted hover:text-text-primary">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-text-muted mb-1">Tên model (VD: llama3.2:3b, qwen2.5:7b)</label>
                <input
                  type="text"
                  value={pullInput}
                  onChange={e => setPullInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !pulling && handlePull()}
                  placeholder="llama3.2:3b"
                  disabled={pulling}
                  className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent disabled:opacity-50"
                />
              </div>
              {pulling && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-text-muted">
                    <span>{pullProgress}</span>
                    <span>{pullPercent}%</span>
                  </div>
                  <div className="h-2 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all duration-300"
                      style={{ width: `${pullPercent}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => !pulling && setShowPullModal(false)}
                  disabled={pulling}
                  className="px-4 py-2 text-sm rounded-lg border border-border text-text-secondary hover:bg-elevated disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handlePull}
                  disabled={pulling || !pullInput.trim()}
                  className="px-4 py-2 text-sm rounded-lg bg-accent text-white font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                >
                  {pulling && <RefreshCw size={12} className="animate-spin" />}
                  {pulling ? 'Đang pull...' : 'Pull Model'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-semibold text-text-primary mb-2">Xác nhận xóa</h2>
            <p className="text-sm text-text-secondary mb-4">
              Bạn chắc chắn muốn xóa model <span className="font-mono text-text-primary">{deleteTarget}</span>? Hành động này không thể hoàn tác.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm rounded-lg border border-border text-text-secondary hover:bg-elevated"
              >
                Hủy
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {deleting && <RefreshCw size={12} className="animate-spin" />}
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelManagementPage;
