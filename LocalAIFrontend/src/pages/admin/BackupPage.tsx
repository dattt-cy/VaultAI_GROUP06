import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HardDrive, Download, Trash2, RefreshCw, Upload, X, AlertTriangle, Info } from 'lucide-react';
import { apiGet, apiDelete, API_BASE } from '../../utils/apiClient';
import { PageHeader } from '../../components/admin/ui/PageHeader';
import { Skeleton } from '../../components/admin/ui/Skeleton';
import { EmptyState } from '../../components/admin/ui/EmptyState';
import { useToast } from '../../components/admin/ui/Toast';

interface BackupFile {
  filename: string;
  size_mb: number;
  created_at: string;
}

const BackupPage: React.FC = () => {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') toast.success(msg); else toast.error(msg);
  };

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet('/api/admin/backups');
      if (!res.ok) throw new Error('Không thể tải danh sách backup');
      const data = await res.json();
      setBackups(data.backups || []);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBackups(); }, [fetchBackups]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/backup`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || 'Lỗi tạo backup');
      }
      const data = await res.json();
      showToast(`Backup tạo thành công: ${data.filename} (${data.size_mb} MB)`);
      fetchBackups();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = (filename: string) => {
    const a = document.createElement('a');
    a.href = `${API_BASE}/api/admin/backups/${encodeURIComponent(filename)}/download`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await apiDelete(`/api/admin/backups/${encodeURIComponent(deleteTarget)}`);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || 'Lỗi xóa backup');
      }
      showToast(`Đã xóa backup '${deleteTarget}'.`);
      setDeleteTarget(null);
      fetchBackups();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreFile) return;
    setRestoring(true);
    try {
      const formData = new FormData();
      formData.append('file', restoreFile);
      const res = await fetch(`${API_BASE}/api/admin/restore`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Lỗi khôi phục');
      showToast(data.message || 'Khôi phục thành công.');
      setRestoreFile(null);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setRestoring(false);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return iso; }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Sao lưu & Phục hồi"
        subtitle="Backup database và vector store, khôi phục khi cần"
        icon={<HardDrive className="w-5 h-5 text-text-secondary" />}
        actions={
          <>
            <button
              onClick={fetchBackups}
              disabled={loading}
              aria-label="Làm mới"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-elevated border border-border text-text-secondary hover:text-text-primary text-[12px] font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Làm mới</span>
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              {creating ? <RefreshCw size={14} className="animate-spin" /> : <HardDrive size={14} />}
              {creating ? 'Đang tạo...' : 'Tạo backup ngay'}
            </button>
          </>
        }
      />

      {/* Info box */}
      <div className="bg-accent/8 border border-accent/25 rounded-lg p-3 text-[13px] text-accent flex items-start gap-2">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold mb-0.5">Nội dung backup bao gồm:</p>
          <ul className="list-disc list-inside space-y-0.5 text-accent/80">
            <li>Database SQL dump (localai)</li>
            <li>ChromaDB vector store snapshot</li>
            <li>Metadata thời gian và trạng thái</li>
          </ul>
        </div>
      </div>

      {/* Backup List */}
      <div className="bg-elevated border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">Danh sách backup</h2>
          <span className="text-xs text-text-muted">{backups.length} file</span>
        </div>
        {loading && backups.length === 0 ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" rounded="lg" />)}
          </div>
        ) : backups.length === 0 ? (
          <EmptyState icon={HardDrive} title="Chưa có backup nào" description="Bấm 'Tạo backup ngay' để tạo bản đầu tiên." compact />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="text-left px-4 py-3 text-text-muted font-medium">Tên file</th>
                <th className="text-left px-4 py-3 text-text-muted font-medium">Kích thước</th>
                <th className="text-left px-4 py-3 text-text-muted font-medium">Thời gian tạo</th>
                <th className="text-right px-4 py-3 text-text-muted font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {backups.map(b => (
                <tr key={b.filename} className="border-b border-border last:border-0 hover:bg-surface/50">
                  <td className="px-4 py-3 font-mono text-xs text-text-primary">{b.filename}</td>
                  <td className="px-4 py-3 text-text-secondary">{b.size_mb} MB</td>
                  <td className="px-4 py-3 text-text-muted">{formatDate(b.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleDownload(b.filename)}
                        className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10"
                        title="Tải xuống"
                      >
                        <Download size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(b.filename)}
                        className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-400/10"
                        title="Xóa"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Restore Section */}
      <div className="bg-elevated border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <Upload size={16} className="text-accent" />
          <h2 className="text-sm font-semibold text-text-primary">Khôi phục từ backup</h2>
        </div>
        <div className="flex items-start gap-2.5 bg-warning/10 border border-warning/30 rounded-lg p-3 text-[12px] text-warning">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>Khôi phục sẽ ghi đè ChromaDB hiện tại. Database SQL cần restore thủ công. Hãy chắc chắn đã backup trước.</span>
        </div>
        <div
          className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-accent/50 transition-colors"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f?.name.endsWith('.zip')) setRestoreFile(f);
          }}
        >
          {restoreFile ? (
            <div className="flex items-center justify-center gap-3">
              <HardDrive size={18} className="text-accent" />
              <span className="text-sm text-text-primary font-medium">{restoreFile.name}</span>
              <button
                onClick={e => { e.stopPropagation(); setRestoreFile(null); }}
                className="text-text-muted hover:text-text-primary"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              <Upload size={24} className="mx-auto text-text-muted opacity-50" />
              <p className="text-sm text-text-muted">Kéo thả hoặc click để chọn file backup (.zip)</p>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) setRestoreFile(f);
          }}
        />
        {restoreFile && (
          <div className="flex justify-end">
            <button
              onClick={handleRestore}
              disabled={restoring}
              className="flex items-center gap-2 px-4 py-2 text-[13px] rounded-lg bg-warning text-white font-semibold hover:bg-warning/85 disabled:opacity-50 cursor-pointer"
            >
              {restoring && <RefreshCw size={12} className="animate-spin" />}
              {restoring ? 'Đang khôi phục...' : 'Bắt đầu khôi phục'}
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirm */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
            <h2 className="text-[15px] font-semibold text-text-primary mb-2">Xác nhận xoá</h2>
            <p className="text-[13px] text-text-secondary mb-4">
              Xoá file <span className="font-mono text-text-primary text-[12px]">{deleteTarget}</span>? Hành động không thể hoàn tác.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="px-4 py-2 text-[13px] rounded-lg border border-border text-text-secondary hover:bg-hover transition-colors cursor-pointer">Huỷ</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-[13px] rounded-lg bg-danger text-white font-semibold hover:bg-danger/85 disabled:opacity-50 flex items-center gap-2 cursor-pointer">
                {deleting && <RefreshCw size={12} className="animate-spin" />}
                Xoá
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackupPage;
