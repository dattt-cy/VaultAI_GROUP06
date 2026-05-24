import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search, X, Eye, Trash2, RefreshCw, Upload,
  FolderOpen, Folder, Plus, Check, Loader2, Download, FolderInput,
} from 'lucide-react';
import { StatusBadge } from '../../components/admin/AdminTable';
import { cn } from '../../lib/utils';
import { useDocumentUpload } from '../../hooks/useDocumentUpload';
import { useDocumentContent } from '../../hooks/useDocumentContent';
import { UploadQueuePanel } from '../../components/admin/UploadQueuePanel';
import { apiGet, API_BASE } from '../../utils/apiClient';
import { PageHeader } from '../../components/admin/ui/PageHeader';
import { Skeleton } from '../../components/admin/ui/Skeleton';
import { EmptyState } from '../../components/admin/ui/EmptyState';
import { useToast } from '../../components/admin/ui/Toast';

interface AdminDoc {
  id: number; title: string; file_type: string; scope: string;
  category_id: number | null; category_name: string | null;
  ingestion_status: string; total_tokens: number;
}
interface AdminCat { id: number; name: string }

const DocumentsPage: React.FC = () => {
  const [allDocs, setAllDocs] = useState<AdminDoc[]>([]);
  const [categories, setCategories] = useState<AdminCat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const refetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [docsRes, catsRes] = await Promise.all([
        apiGet('/api/admin/documents?limit=500'),
        apiGet('/api/admin/categories'),
      ]);
      if (!docsRes.ok) throw new Error(`HTTP ${docsRes.status}`);
      const docsData = await docsRes.json();
      const catsData = catsRes.ok ? await catsRes.json() : [];
      setAllDocs(docsData.items ?? []);
      setCategories(Array.isArray(catsData) ? catsData : []);
    } catch (e: any) {
      setError(e.message ?? 'Lỗi tải dữ liệu');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const deleteDocument = useCallback(async (id: number) => {
    await fetch(`${API_BASE}/api/documents/${id}`, { method: 'DELETE', credentials: 'include' });
    await refetch(true);
  }, [refetch]);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState('');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Modals
  const [drawerDocTitle, setDrawerDocTitle] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const open = searchParams.get('open');
    if (open) {
      setDrawerDocTitle(open);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Upload form state
  const [uploadFiles_state, setUploadFiles_state] = useState<File[]>([]);
  const [uploadCategoryId, setUploadCategoryId] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (categories.length > 0 && uploadCategoryId === 0) {
      setUploadCategoryId(categories[0].id);
    }
  }, [categories, uploadCategoryId]);

  const { uploads, uploadFiles, dismiss, dismissAll } = useDocumentUpload({
    categoryId: uploadCategoryId || 1,
    scope: 'COMPANY',
    onSuccess: () => { refetch(); },
  });

  // Replace doc flow
  const [replaceDoc, setReplaceDoc] = useState<AdminDoc | null>(null);
  const [replacing, setReplacing] = useState(false);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  const { uploads: replaceUploads, uploadFiles: uploadReplaceFile, dismiss: dismissReplace, dismissAll: dismissAllReplace } = useDocumentUpload({
    categoryId: replaceDoc?.category_id ?? 1,
    scope: (replaceDoc?.scope as 'COMPANY' | 'PERSONAL') ?? 'COMPANY',
    onSuccess: () => { refetch(); setReplacing(false); },
  });

  const handleReplaceFileSelected = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0 || !replaceDoc) return;
    setReplacing(true);
    await deleteDocument(replaceDoc.id);
    uploadReplaceFile([files[0]]);
    setDrawerDocTitle(null);
    if (replaceFileInputRef.current) replaceFileInputRef.current.value = '';
  }, [replaceDoc, deleteDocument, uploadReplaceFile]);

  const { data: chunkData, loading: chunkLoading, error: chunkError } = useDocumentContent(drawerDocTitle);

  // Download
  const handleDownload = useCallback((doc: AdminDoc) => {
    const a = document.createElement('a');
    a.href = `${API_BASE}/api/documents/${doc.id}/download`;
    a.download = doc.title;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  // Move category
  const [movingDocId, setMovingDocId] = useState<number | null>(null);
  const [showBulkMove, setShowBulkMove] = useState(false);
  const [bulkMoveTargetId, setBulkMoveTargetId] = useState<number>(0);

  const handleMoveCategory = useCallback(async (docId: number, newCategoryId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/documents/${docId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_id: newCategoryId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refetch(true);
      toast.success('Đã chuyển danh mục');
    } catch (err) {
      toast.error('Chuyển danh mục thất bại', String(err));
    } finally {
      setMovingDocId(null);
    }
  }, [refetch, toast]);

  const bulkMove = useCallback(async () => {
    if (!bulkMoveTargetId) return;
    const count = selectedIds.size;
    try {
      await Promise.all([...selectedIds].map(id =>
        fetch(`${API_BASE}/api/documents/${id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category_id: bulkMoveTargetId }),
        })
      ));
      await refetch(true);
      setSelectedIds(new Set());
      setShowBulkMove(false);
      toast.success(`Đã chuyển ${count} tài liệu`);
    } catch (err) {
      toast.error('Chuyển hàng loạt thất bại', String(err));
    }
  }, [selectedIds, bulkMoveTargetId, refetch, toast]);

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
    const doc = allDocs.find(d => d.id === id);
    if (!window.confirm(`Xoá tài liệu "${doc?.title ?? id}"? Hành động này không thể hoàn tác.`)) return;
    try {
      await deleteDocument(id);
      setSelectedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
      toast.success('Đã xoá tài liệu');
    } catch (err) {
      toast.error('Xoá thất bại', String(err));
    }
  };

  const bulkDelete = async () => {
    const count = selectedIds.size;
    if (!window.confirm(`Xoá ${count} tài liệu đã chọn?`)) return;
    try {
      await Promise.all([...selectedIds].map(id => deleteDocument(id)));
      setSelectedIds(new Set());
      toast.success(`Đã xoá ${count} tài liệu`);
    } catch (err) {
      toast.error('Xoá hàng loạt thất bại', String(err));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f =>
      /\.(pdf|docx?|xlsx?|txt)$/i.test(f.name)
    );
    if (files.length) setUploadFiles_state(prev => [...prev, ...files]);
  };

  const submitUpload = () => {
    if (uploadFiles_state.length === 0) return;
    uploadFiles(uploadFiles_state);
    setShowUpload(false);
    setUploadFiles_state([]);
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

        <PageHeader
          title="Quản lý tài liệu"
          subtitle={
            loading
              ? 'Đang tải...'
              : `${filtered.length.toLocaleString('vi-VN')} / ${allDocs.length.toLocaleString('vi-VN')} tài liệu${
                  selectedCategoryId !== null ? ` · ${getCatName(selectedCategoryId)}` : ''
                }`
          }
          actions={
            <>
              <button
                onClick={() => refetch()}
                disabled={loading}
                aria-label="Làm mới"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-elevated border border-border text-text-secondary hover:text-text-primary text-[12px] font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
                <span className="hidden sm:inline">Làm mới</span>
              </button>
              <button
                onClick={() => { setShowUpload(true); setUploadFiles_state([]); setIsDragging(false); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-[13px] font-semibold transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Upload mới
              </button>
            </>
          }
        />

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

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="bg-elevated border border-border rounded-xl px-4 py-2.5 flex flex-wrap items-center gap-3 animate-fade-in">
            <span className="text-[13px] text-text-secondary">
              Đã chọn <span className="font-semibold text-text-primary">{selectedIds.size}</span> tài liệu
            </span>
            <div className="flex-1" />

            {/* Bulk Move */}
            {showBulkMove ? (
              <div className="flex items-center gap-2">
                <select
                  value={bulkMoveTargetId}
                  onChange={e => setBulkMoveTargetId(Number(e.target.value))}
                  className="input-base py-1 text-[12px]"
                >
                  <option value={0}>Chọn danh mục...</option>
                  {categories
                    .filter(c => c.id !== selectedCategoryId)
                    .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button
                  onClick={bulkMove}
                  disabled={!bulkMoveTargetId}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-[13px] font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  Xác nhận
                </button>
                <button onClick={() => setShowBulkMove(false)} className="btn-icon w-7 h-7">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setShowBulkMove(true); setBulkMoveTargetId(0); }}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-text-secondary text-[13px] rounded-lg hover:bg-hover transition-colors"
              >
                <FolderInput className="w-3.5 h-3.5" />
                Chuyển danh mục
              </button>
            )}

            <button
              onClick={bulkDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-danger/40 text-danger text-[13px] rounded-lg hover:bg-danger/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Xóa {selectedIds.size} mục
            </button>
            <button onClick={() => { setSelectedIds(new Set()); setShowBulkMove(false); }} className="btn-icon w-7 h-7">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

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
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skel-${i}`} className="border-b border-border last:border-0">
                  <td className="px-3 py-3"><Skeleton className="w-4 h-4" /></td>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-3 w-full" /></td>
                  ))}
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={search || filterStatus || selectedCategoryId !== null ? Search : Upload}
                      title="Không tìm thấy tài liệu"
                      description={search || filterStatus || selectedCategoryId !== null ? 'Thử bỏ bộ lọc để xem toàn bộ.' : 'Upload tài liệu để bắt đầu.'}
                      compact
                    />
                  </td>
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
                  <td className="px-4 py-3">
                    {movingDocId === doc.id ? (
                      <div className="flex items-center gap-1">
                        <select
                          autoFocus
                          defaultValue={doc.category_id ?? ''}
                          onChange={e => {
                            const val = Number(e.target.value);
                            if (val) handleMoveCategory(doc.id, val);
                            else setMovingDocId(null);
                          }}
                          className="input-base py-0.5 text-[12px] flex-1"
                        >
                          <option value="">-- Chọn --</option>
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        <button onClick={() => setMovingDocId(null)} className="btn-icon w-6 h-6 shrink-0">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setMovingDocId(doc.id)}
                        title="Click để chuyển danh mục"
                        className="text-[13px] text-text-secondary hover:text-accent hover:underline text-left"
                      >
                        {getCatName(doc.category_id)}
                      </button>
                    )}
                  </td>
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
                      {['COMPLETED', 'SUCCESS'].includes(doc.ingestion_status) ? (
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
                        onClick={() => handleDownload(doc)}
                        className="btn-icon w-7 h-7 hover:text-success hover:border-success/50"
                        title="Tải xuống"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
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

      </div>

      {/* ── Chunk Drawer ───────────────────────────────────────────────────── */}
      {/* Hidden file input for replace */}
      <input
        ref={replaceFileInputRef}
        type="file"
        accept=".pdf,.docx,.xlsx,.txt,.doc,.xls"
        className="hidden"
        onChange={e => handleReplaceFileSelected(e.target.files)}
      />

      {drawerDocTitle && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => setDrawerDocTitle(null)} />
          <div className="w-full max-w-lg bg-surface border-l border-border flex flex-col animate-slide-in">
            <div className="panel-header border-b border-border">
              <span className="truncate flex-1 min-w-0 mr-2">Chunks — {drawerDocTitle}</span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    const doc = allDocs.find(d => d.title === drawerDocTitle) ?? null;
                    setReplaceDoc(doc);
                    replaceFileInputRef.current?.click();
                  }}
                  disabled={replacing}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-warning/15 hover:bg-warning/25 text-warning border border-warning/30 rounded-lg text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Xóa tài liệu cũ và upload file mới thay thế"
                >
                  {replacing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                  Thay thế tài liệu
                </button>
                <button onClick={() => setDrawerDocTitle(null)} className="btn-icon w-6 h-6">
                  <X className="w-3 h-3" />
                </button>
              </div>
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
              <button onClick={() => { setShowUpload(false); setUploadFiles_state([]); }} className="btn-icon w-7 h-7">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Drop zone */}
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
                multiple
                className="hidden"
                onChange={e => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length) setUploadFiles_state(prev => [...prev, ...files]);
                  e.target.value = '';
                }}
              />
              <Upload className="w-6 h-6 text-accent mx-auto mb-2" />
              <p className="text-[13px] text-text-secondary">Kéo thả file vào đây hoặc <span className="text-accent font-semibold">chọn file</span></p>
              <p className="text-[11px] text-text-muted mt-1">PDF, DOCX, XLSX, TXT · Nhiều file cùng lúc</p>
            </div>

            {/* File list */}
            {uploadFiles_state.length > 0 && (
              <div className="mb-4 space-y-1.5 max-h-36 overflow-y-auto">
                {uploadFiles_state.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-elevated rounded-lg">
                    <Check className="w-3.5 h-3.5 text-success flex-shrink-0" />
                    <span className="text-[12px] text-text-primary truncate flex-1">{f.name}</span>
                    <button
                      onClick={e => { e.stopPropagation(); setUploadFiles_state(prev => prev.filter((_, j) => j !== i)); }}
                      className="text-text-muted hover:text-danger transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Category */}
            <div className="mb-5">
              <label className="text-[12px] font-semibold text-text-secondary block mb-1">Danh mục</label>
              <select
                value={uploadCategoryId}
                onChange={e => setUploadCategoryId(Number(e.target.value))}
                className="input-base w-full"
              >
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowUpload(false); setUploadFiles_state([]); }}
                className="px-4 py-1.5 text-[13px] border border-border text-text-secondary rounded-lg hover:bg-hover transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={submitUpload}
                disabled={uploadFiles_state.length === 0}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-1.5 text-[13px] font-semibold rounded-lg transition-colors',
                  uploadFiles_state.length === 0
                    ? 'bg-accent/40 text-white/60 cursor-not-allowed'
                    : 'bg-accent hover:bg-accent-hover text-white'
                )}
              >
                <Upload className="w-3.5 h-3.5" />
                Upload {uploadFiles_state.length > 1 ? `${uploadFiles_state.length} file` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Floating Upload Queue (Google Drive style) ─────────────────────── */}
      <UploadQueuePanel uploads={[...uploads, ...replaceUploads]} onDismiss={id => { dismiss(id); dismissReplace(id); }} onDismissAll={() => { dismissAll(); dismissAllReplace(); }} />
    </div>
  );
};

export default DocumentsPage;
