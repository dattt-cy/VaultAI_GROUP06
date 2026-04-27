import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Search, X, Eye, Trash2, RefreshCw, Upload,
  FolderOpen, Folder, Plus, Check, Loader2,
} from 'lucide-react';
import { StatusBadge } from '../../components/admin/AdminTable';
import { cn } from '../../lib/utils';
import { useDocumentTree } from '../../hooks/useDocumentTree';
import { useDocumentUpload } from '../../hooks/useDocumentUpload';
import { useDocumentContent } from '../../hooks/useDocumentContent';

const DocumentsPage: React.FC = () => {
  const { sharedDocs, privateDocs, categories, loading, error, refetch, deleteDocument } = useDocumentTree();
  const allDocs = useMemo(() => [...sharedDocs, ...privateDocs], [sharedDocs, privateDocs]);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState('');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Modals
  const [drawerDocTitle, setDrawerDocTitle] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategoryId, setUploadCategoryId] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (categories.length > 0 && uploadCategoryId === 0) {
      setUploadCategoryId(categories[0].id);
    }
  }, [categories, uploadCategoryId]);

  const { uploads, uploadFiles } = useDocumentUpload({
    categoryId: uploadCategoryId || 1,
    scope: 'COMPANY',
    onSuccess: () => {
      refetch();
      setTimeout(() => { setShowUpload(false); setUploadFile(null); }, 800);
    },
  });

  const activeUpload = useMemo(
    () => uploads.find(u => uploadFile && u.filename === uploadFile.name),
    [uploads, uploadFile]
  );

  const { data: chunkData, loading: chunkLoading, error: chunkError } = useDocumentContent(drawerDocTitle);

  const getCatName = (id: number | null) => categories.find(c => c.id === id)?.name ?? '—';

  const filtered = useMemo(() => allDocs.filter(d => {
    const q = search.toLowerCase();
    const matchQ = !q || d.title.toLowerCase().includes(q);
    const matchCat = selectedCategoryId === null || d.category_id === selectedCategoryId;
    const matchStatus = !filterStatus || d.ingestion_status === filterStatus;
    return matchQ && matchCat && matchStatus;
  }), [allDocs, search, selectedCategoryId, filterStatus]);

  const allChecked = filtered.length > 0 && filtered.every(d => selectedIds.has(d.id));
  const someChecked = filtered.some(d => selectedIds.has(d.id));

  const toggleAll = () => {
    if (allChecked) {
      setSelectedIds(prev => { const s = new Set(prev); filtered.forEach(d => s.delete(d.id)); return s; });
    } else {
      setSelectedIds(prev => { const s = new Set(prev); filtered.forEach(d => s.add(d.id)); return s; });
    }
  };

  const toggleOne = (id: number) => {
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  const handleDelete = async (id: number) => {
    await deleteDocument(id);
    setSelectedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
  };

  const bulkDelete = async () => {
    await Promise.all([...selectedIds].map(id => deleteDocument(id)));
    setSelectedIds(new Set());
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) setUploadFile(file);
  };

  const submitUpload = () => {
    if (!uploadFile) return;
    uploadFiles([uploadFile]);
  };

  const catDocCount = (catId: number) => allDocs.filter(d => d.category_id === catId).length;

  return (
    <div className="flex gap-0 h-full animate-fade-in">

      {/* ── Sidebar Folder Tree ────────────────────────────────────────────── */}
      <aside className="w-48 shrink-0 border-r border-border flex flex-col py-3 pr-2">
        <p className="px-3 pb-2 text-[11px] font-semibold text-text-muted uppercase tracking-wide">Danh mục</p>

        <button
          onClick={() => setSelectedCategoryId(null)}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] transition-colors text-left w-full mb-0.5',
            selectedCategoryId === null
              ? 'bg-accent/15 text-accent font-semibold'
              : 'text-text-secondary hover:bg-hover hover:text-text-primary'
          )}
        >
          <Folder className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 truncate">Tất cả</span>
          <span className="text-[11px] font-mono text-text-muted">{allDocs.length}</span>
        </button>

        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategoryId(cat.id)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] transition-colors text-left w-full mb-0.5',
              selectedCategoryId === cat.id
                ? 'bg-accent/15 text-accent font-semibold'
                : 'text-text-secondary hover:bg-hover hover:text-text-primary'
            )}
          >
            <FolderOpen className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 truncate">{cat.name}</span>
            <span className="text-[11px] font-mono text-text-muted">{catDocCount(cat.id)}</span>
          </button>
        ))}
      </aside>

      {/* ── Main Area ──────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col space-y-4 pl-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-bold text-text-primary">Quản lý tài liệu</h1>
            <p className="text-[13px] text-text-muted mt-0.5">
              {loading ? 'Đang tải...' : `${filtered.length} / ${allDocs.length} tài liệu`}
              {selectedCategoryId !== null && (
                <span className="ml-1 text-accent">· {getCatName(selectedCategoryId)}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refetch} className="btn-icon w-8 h-8" title="Làm mới">
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </button>
            <button
              onClick={() => { setShowUpload(true); setUploadFile(null); setIsDragging(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-[13px] font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" /> Upload mới
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 text-[13px] text-danger">
            Lỗi tải dữ liệu: {error}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2.5">
          <div className="relative flex-1 min-w-44">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm tên tài liệu..."
              className="input-base pl-9 py-2 w-full"
            />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input-base w-auto py-2">
            <option value="">Tất cả trạng thái</option>
            {['COMPLETED', 'PROCESSING', 'PENDING', 'FAILED'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-border flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface">
                <th className="px-3 py-2.5 border-b border-border w-8">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={el => { if (el) el.indeterminate = !allChecked && someChecked; }}
                    onChange={toggleAll}
                    className="accent-accent cursor-pointer"
                  />
                </th>
                {['Tên tài liệu', 'Danh mục', 'Scope', 'Trạng thái', 'Tokens', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-[11px] font-semibold text-text-secondary uppercase tracking-wide border-b border-border">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="text-center py-10">
                    <Loader2 className="w-5 h-5 animate-spin text-accent mx-auto" />
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-[13px] text-text-muted">Không tìm thấy tài liệu</td>
                </tr>
              )}
              {!loading && filtered.map(doc => (
                <tr key={doc.id} className={cn(
                  'border-b border-border last:border-0 transition-colors',
                  selectedIds.has(doc.id) ? 'bg-accent/5' : 'hover:bg-surface/50'
                )}>
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(doc.id)}
                      onChange={() => toggleOne(doc.id)}
                      className="accent-accent cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-text-primary text-[13px]">{doc.title}</span>
                    {doc.file_type && (
                      <span className="ml-1.5 text-[10px] text-text-muted font-mono uppercase">{doc.file_type}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-text-secondary">{getCatName(doc.category_id)}</td>
                  <td className="px-4 py-3 text-[12px] font-mono text-text-muted">{doc.scope}</td>
                  <td className="px-4 py-3">
                    {doc.ingestion_status === 'PROCESSING'
                      ? <span className="flex items-center gap-1 text-[11px] text-warning"><Loader2 className="w-3 h-3 animate-spin" />PROCESSING</span>
                      : <StatusBadge status={doc.ingestion_status} />
                    }
                  </td>
                  <td className="px-4 py-3 text-[13px] text-text-secondary">
                    {doc.total_tokens > 0 ? doc.total_tokens.toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {doc.ingestion_status === 'COMPLETED' ? (
                        <button
                          onClick={() => setDrawerDocTitle(doc.title)}
                          className="btn-icon w-7 h-7 hover:text-accent hover:border-accent/50"
                          title="Xem chunks"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      ) : doc.ingestion_status === 'PROCESSING' ? (
                        <button disabled className="btn-icon w-7 h-7 opacity-40 cursor-not-allowed" title="Đang xử lý">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        </button>
                      ) : (
                        <button
                          onClick={refetch}
                          className="btn-icon w-7 h-7 hover:text-warning hover:border-warning/50"
                          title="Làm mới trạng thái"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="btn-icon w-7 h-7 hover:text-danger hover:border-danger/50"
                        title="Xóa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="bg-elevated border border-border rounded-xl px-4 py-2.5 flex items-center gap-3 animate-fade-in">
            <span className="text-[13px] text-text-secondary">
              Đã chọn <span className="font-semibold text-text-primary">{selectedIds.size}</span> tài liệu
            </span>
            <div className="flex-1" />
            <button
              onClick={bulkDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-danger/40 text-danger text-[13px] rounded-lg hover:bg-danger/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Xóa {selectedIds.size} mục
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="btn-icon w-7 h-7">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ── Chunk Drawer ───────────────────────────────────────────────────── */}
      {drawerDocTitle && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => setDrawerDocTitle(null)} />
          <div className="w-full max-w-lg bg-surface border-l border-border flex flex-col animate-slide-in">
            <div className="panel-header border-b border-border">
              <span>Chunks — {drawerDocTitle}</span>
              <button onClick={() => setDrawerDocTitle(null)} className="btn-icon w-6 h-6">
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chunkLoading && (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-accent" />
                </div>
              )}
              {chunkError && (
                <p className="text-[13px] text-danger text-center py-8">{chunkError}</p>
              )}
              {!chunkLoading && !chunkError && chunkData && chunkData.pages.length === 0 && (
                <p className="text-[13px] text-text-muted text-center py-8">Chưa có chunks</p>
              )}
              {!chunkLoading && chunkData?.pages.map(page => (
                <div key={page.page} className="bg-elevated border border-border rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-accent">
                      {page.title ?? `Chunk #${page.chunk_index ?? page.page}`}
                    </span>
                    {page.token_count !== undefined && (
                      <span className="text-[11px] text-text-muted">{page.token_count} tokens</span>
                    )}
                  </div>
                  <p className="text-[13px] text-text-secondary leading-relaxed whitespace-pre-wrap">
                    {page.lines.join('\n')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Upload Modal ───────────────────────────────────────────────────── */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[16px] font-bold text-text-primary">Upload tài liệu</h2>
              <button onClick={() => setShowUpload(false)} className="btn-icon w-7 h-7">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors mb-4',
                isDragging ? 'border-accent bg-accent/10' : 'border-accent/40 bg-elevated hover:border-accent/70 hover:bg-accent/5'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.xlsx,.txt,.doc,.xls"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) setUploadFile(f); }}
              />
              {uploadFile ? (
                <div className="flex items-center justify-center gap-2 text-[13px] text-text-primary">
                  <Check className="w-4 h-4 text-success" />
                  <span className="font-medium truncate max-w-[260px]">{uploadFile.name}</span>
                </div>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-accent mx-auto mb-2" />
                  <p className="text-[13px] text-text-secondary">Kéo thả file vào đây hoặc <span className="text-accent font-semibold">chọn file</span></p>
                  <p className="text-[11px] text-text-muted mt-1">PDF, DOCX, XLSX, TXT</p>
                </>
              )}
            </div>

            <div className="space-y-3 mb-5">
              <div>
                <label className="text-[12px] font-semibold text-text-secondary block mb-1">Danh mục</label>
                <select
                  value={uploadCategoryId}
                  onChange={e => setUploadCategoryId(Number(e.target.value))}
                  className="input-base w-full"
                >
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            {activeUpload?.status === 'uploading' && (
              <div className="flex items-center gap-2 text-[13px] text-text-secondary mb-4 animate-fade-in">
                <Loader2 className="w-4 h-4 animate-spin text-accent" />
                Đang upload... {activeUpload.progress}%
              </div>
            )}
            {activeUpload?.status === 'processing' && (
              <div className="flex items-center gap-2 text-[13px] text-text-secondary mb-4 animate-fade-in">
                <Loader2 className="w-4 h-4 animate-spin text-warning" />
                Đang xử lý & tạo vector...
              </div>
            )}
            {activeUpload?.status === 'done' && (
              <div className="flex items-center gap-2 text-[13px] text-success mb-4 animate-fade-in">
                <Check className="w-4 h-4" />
                Upload thành công!
              </div>
            )}
            {activeUpload?.status === 'error' && (
              <div className="flex items-center gap-2 text-[13px] text-danger mb-4 animate-fade-in">
                <X className="w-4 h-4" />
                Lỗi: {activeUpload.error}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowUpload(false)}
                className="px-4 py-1.5 text-[13px] border border-border text-text-secondary rounded-lg hover:bg-hover transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={submitUpload}
                disabled={!uploadFile || activeUpload?.status === 'uploading' || activeUpload?.status === 'processing'}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-1.5 text-[13px] font-semibold rounded-lg transition-colors',
                  !uploadFile || activeUpload?.status === 'uploading' || activeUpload?.status === 'processing'
                    ? 'bg-accent/40 text-white/60 cursor-not-allowed'
                    : 'bg-accent hover:bg-accent-hover text-white'
                )}
              >
                <Upload className="w-3.5 h-3.5" /> Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentsPage;
