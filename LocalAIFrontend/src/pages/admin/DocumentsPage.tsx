import React, { useState, useRef } from 'react';
import { cva } from 'class-variance-authority';
import {
  Search, X, Eye, Pencil, Trash2, RefreshCw, Upload,
  FolderOpen, Folder, Plus, Check, ChevronDown, Loader2,
} from 'lucide-react';
import { StatusBadge } from '../../components/admin/AdminTable';
import { mockDocuments, mockCategories as initialCategories } from '../../mocks/adminMocks';
import { cn } from '../../lib/utils';

// ── CVA Variants ─────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────────────────

type Doc = typeof mockDocuments[0] & { ingestion_status: string };

type UploadStatus = 'idle' | 'uploading' | 'processing' | 'done';

// ── Mock chunks ───────────────────────────────────────────────────────────────

const mockChunks = [
  { chunk_index: 0, raw_content: 'Báo cáo tài chính quý 1 năm 2026. Doanh thu thuần: 45.2 tỷ đồng, tăng 12% so với cùng kỳ.', token_count: 42, vector_id: 'chroma-001' },
  { chunk_index: 1, raw_content: 'Chi phí hoạt động: 32.1 tỷ đồng. Lợi nhuận trước thuế: 13.1 tỷ đồng.', token_count: 36, vector_id: 'chroma-002' },
  { chunk_index: 2, raw_content: 'Tổng tài sản tính đến 31/03/2026: 210 tỷ đồng. Nợ phải trả: 85 tỷ đồng.', token_count: 38, vector_id: 'chroma-003' },
];

// ── Main Component ────────────────────────────────────────────────────────────

const DocumentsPage: React.FC = () => {
  const [docs, setDocs] = useState<Doc[]>(mockDocuments as Doc[]);
  const [categories, setCategories] = useState(initialCategories);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Modals
  const [drawerDoc, setDrawerDoc] = useState<Doc | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [editDoc, setEditDoc] = useState<Doc | null>(null);

  // Bulk move dropdown
  const [showBulkMove, setShowBulkMove] = useState(false);

  // New folder form
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCat, setUploadCat] = useState(initialCategories[0]?.name ?? '');
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit form state
  const [editForm, setEditForm] = useState({ filename: '', category: '' });

  // ── Derived ─────────────────────────────────────────────────────────────────

  const filtered = docs.filter(d => {
    if (d.scope !== 'COMPANY') return false;
    const q = search.toLowerCase();
    const matchQ = !q || d.filename.toLowerCase().includes(q) || d.uploader.toLowerCase().includes(q);
    const matchCat = !selectedCategory || d.category === selectedCategory;
    const matchStatus = !filterStatus || d.ingestion_status === filterStatus;
    return matchQ && matchCat && matchStatus;
  });

  const allChecked = filtered.length > 0 && filtered.every(d => selectedIds.has(d.id));
  const someChecked = filtered.some(d => selectedIds.has(d.id));

  // ── Handlers ─────────────────────────────────────────────────────────────────

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

  const deleteDoc = (id: number) => setDocs(prev => prev.filter(d => d.id !== id));

  const bulkDelete = () => {
    setDocs(prev => prev.filter(d => !selectedIds.has(d.id)));
    setSelectedIds(new Set());
  };

  const bulkMove = (category: string) => {
    setDocs(prev => prev.map(d => selectedIds.has(d.id) ? { ...d, category } : d));
    setSelectedIds(new Set());
    setShowBulkMove(false);
  };

  const retryDoc = (id: number) => {
    setDocs(prev => prev.map(d => d.id === id ? { ...d, ingestion_status: 'PROCESSING' } : d));
    setTimeout(() => {
      setDocs(prev => prev.map(d => d.id === id ? { ...d, ingestion_status: 'COMPLETED', chunk_count: Math.floor(Math.random() * 40) + 10 } : d));
    }, 1500);
  };

  const openEdit = (doc: Doc) => {
    setEditDoc(doc);
    setEditForm({ filename: doc.filename, category: doc.category });
  };

  const saveEdit = () => {
    if (!editDoc) return;
    setDocs(prev => prev.map(d => d.id === editDoc.id ? { ...d, ...editForm } : d));
    setEditDoc(null);
  };

  const handleUploadFile = (file: File) => {
    setUploadFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUploadFile(file);
  };

  const submitUpload = () => {
    if (!uploadFile) return;
    setUploadStatus('uploading');
    const newDoc: Doc = {
      id: Date.now(),
      filename: uploadFile.name,
      category: uploadCat,
      scope: 'COMPANY',
      uploader: 'admin',
      ingestion_status: 'PROCESSING',
      chunk_count: 0,
      file_size: uploadFile.size > 1024 * 1024
        ? `${(uploadFile.size / 1024 / 1024).toFixed(1)} MB`
        : `${(uploadFile.size / 1024).toFixed(0)} KB`,
      created_at: new Date().toISOString(),
    };
    setTimeout(() => {
      setDocs(prev => [newDoc, ...prev]);
      setUploadStatus('processing');
      setTimeout(() => {
        setDocs(prev => prev.map(d => d.id === newDoc.id
          ? { ...d, ingestion_status: 'COMPLETED', chunk_count: Math.floor(Math.random() * 40) + 10 }
          : d
        ));
        setUploadStatus('done');
        setTimeout(() => {
          setShowUpload(false);
          setUploadFile(null);
          setUploadStatus('idle');
        }, 800);
      }, 1500);
    }, 600);
  };

  const resetUpload = () => {
    setUploadFile(null);
    setUploadStatus('idle');
    setIsDragging(false);
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('vi-VN');

  const catDocCount = (name: string) => docs.filter(d => d.category === name).length;

  const createFolder = () => {
    const name = newFolderName.trim();
    if (!name || categories.some(c => c.name === name)) return;
    setCategories(prev => [...prev, { id: Date.now(), name, description: '', document_count: 0, created_at: new Date().toISOString().split('T')[0] }]);
    setSelectedCategory(name);
    setNewFolderName('');
    setShowNewFolder(false);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex gap-0 h-full animate-fade-in">

      {/* ── Sidebar Folder Tree ─────────────────────────────────────────────── */}
      <aside className="w-48 shrink-0 border-r border-border flex flex-col py-3 pr-2">
        <p className="px-3 pb-2 text-[11px] font-semibold text-text-muted uppercase tracking-wide">Danh mục</p>

        {/* All */}
        <button
          onClick={() => setSelectedCategory(null)}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] transition-colors text-left w-full mb-0.5',
            selectedCategory === null
              ? 'bg-accent/15 text-accent font-semibold'
              : 'text-text-secondary hover:bg-hover hover:text-text-primary'
          )}
        >
          <Folder className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 truncate">Tất cả</span>
          <span className="text-[11px] font-mono text-text-muted">{docs.length}</span>
        </button>

        {/* Categories */}
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.name)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] transition-colors text-left w-full mb-0.5',
              selectedCategory === cat.name
                ? 'bg-accent/15 text-accent font-semibold'
                : 'text-text-secondary hover:bg-hover hover:text-text-primary'
            )}
          >
            <FolderOpen className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 truncate">{cat.name}</span>
            <span className="text-[11px] font-mono text-text-muted">{catDocCount(cat.name)}</span>
          </button>
        ))}

        {/* New folder inline form */}
        <div className="mt-auto pt-2 border-t border-border">
          {showNewFolder ? (
            <div className="px-2 space-y-1.5 animate-fade-in">
              <input
                autoFocus
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderName(''); } }}
                placeholder="Tên danh mục..."
                className="input-base w-full py-1 text-[12px]"
              />
              <div className="flex gap-1">
                <button
                  onClick={createFolder}
                  disabled={!newFolderName.trim()}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1 py-1 text-[12px] rounded-lg transition-colors',
                    newFolderName.trim()
                      ? 'bg-accent hover:bg-accent-hover text-white'
                      : 'bg-accent/30 text-white/50 cursor-not-allowed'
                  )}
                >
                  <Check className="w-3 h-3" /> Tạo
                </button>
                <button
                  onClick={() => { setShowNewFolder(false); setNewFolderName(''); }}
                  className="btn-icon w-7 h-7 hover:text-danger hover:border-danger/50"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNewFolder(true)}
              className="flex items-center gap-1.5 w-full px-3 py-1.5 text-[12px] text-text-muted hover:text-accent hover:bg-accent/5 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm danh mục
            </button>
          )}
        </div>
      </aside>

      {/* ── Main Area ───────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col space-y-4 pl-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-bold text-text-primary">Quản lý tài liệu</h1>
            <p className="text-[13px] text-text-muted mt-0.5">
              {filtered.length} / {docs.length} tài liệu
              {selectedCategory && <span className="ml-1 text-accent">· {selectedCategory}</span>}
            </p>
          </div>
          <button
            onClick={() => { setShowUpload(true); resetUpload(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-[13px] font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" /> Upload mới
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2.5">
          <div className="relative flex-1 min-w-44">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm tên file, người upload..."
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
                {['Tên file', 'Danh mục', 'Người upload', 'Trạng thái', 'Chunks', 'Kích thước', 'Ngày tạo', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-[11px] font-semibold text-text-secondary uppercase tracking-wide border-b border-border">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-[13px] text-text-muted">Không tìm thấy tài liệu</td>
                </tr>
              )}
              {filtered.map(doc => (
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
                    <span className="font-medium text-text-primary text-[13px]">{doc.filename}</span>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-text-secondary">{doc.category}</td>
                  <td className="px-4 py-3 text-[12px] font-mono text-text-muted">{doc.uploader}</td>
                  <td className="px-4 py-3">
                    {doc.ingestion_status === 'PROCESSING'
                      ? <span className="flex items-center gap-1 text-[11px] text-warning"><Loader2 className="w-3 h-3 animate-spin" />PROCESSING</span>
                      : <StatusBadge status={doc.ingestion_status} />
                    }
                  </td>
                  <td className="px-4 py-3 text-[13px] text-text-secondary">{doc.chunk_count}</td>
                  <td className="px-4 py-3 text-[12px] text-text-muted">{doc.file_size}</td>
                  <td className="px-4 py-3 text-[12px] text-text-muted">{formatDate(doc.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {/* Edit */}
                      <button
                        onClick={() => openEdit(doc)}
                        className="btn-icon w-7 h-7 hover:text-accent hover:border-accent/50"
                        title="Sửa"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {/* Eye or Retry */}
                      {doc.ingestion_status === 'COMPLETED' ? (
                        <button
                          onClick={() => setDrawerDoc(doc)}
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
                          onClick={() => retryDoc(doc.id)}
                          className="btn-icon w-7 h-7 hover:text-warning hover:border-warning/50"
                          title="Thử lại ingestion"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {/* Delete */}
                      <button
                        onClick={() => deleteDoc(doc.id)}
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
            <span className="text-[13px] text-text-secondary">Đã chọn <span className="font-semibold text-text-primary">{selectedIds.size}</span> tài liệu</span>
            <div className="flex-1" />
            {/* Bulk move */}
            <div className="relative">
              <button
                onClick={() => setShowBulkMove(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-[13px] text-text-secondary rounded-lg hover:bg-hover transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Chuyển danh mục
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {showBulkMove && (
                <div className="absolute bottom-full mb-1 right-0 bg-surface border border-border rounded-xl shadow-2xl py-1 min-w-36 z-20 animate-fade-in">
                  {categories.map(c => (
                    <button
                      key={c.id}
                      onClick={() => bulkMove(c.name)}
                      className="w-full text-left px-3 py-1.5 text-[13px] text-text-secondary hover:bg-hover hover:text-text-primary transition-colors"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Bulk delete */}
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

      {/* ── Chunk Drawer ────────────────────────────────────────────────────── */}
      {drawerDoc && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => setDrawerDoc(null)} />
          <div className="w-full max-w-lg bg-surface border-l border-border flex flex-col animate-slide-in">
            <div className="panel-header border-b border-border">
              <span>Chunks — {drawerDoc.filename}</span>
              <button onClick={() => setDrawerDoc(null)} className="btn-icon w-6 h-6"><X className="w-3 h-3" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {drawerDoc.chunk_count === 0 ? (
                <p className="text-[13px] text-text-muted text-center py-8">Chưa có chunks</p>
              ) : mockChunks.map(chunk => (
                <div key={chunk.chunk_index} className="bg-elevated border border-border rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-accent">Chunk #{chunk.chunk_index}</span>
                    <div className="flex gap-3 text-[11px] text-text-muted">
                      <span>{chunk.token_count} tokens</span>
                      <span className="font-mono text-[10px]">{chunk.vector_id}</span>
                    </div>
                  </div>
                  <p className="text-[13px] text-text-secondary leading-relaxed">{chunk.raw_content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Upload Modal ────────────────────────────────────────────────────── */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[16px] font-bold text-text-primary">Upload tài liệu</h2>
              <button onClick={() => setShowUpload(false)} className="btn-icon w-7 h-7"><X className="w-3.5 h-3.5" /></button>
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
                accept=".pdf,.docx,.xlsx,.txt,.png,.jpg"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadFile(f); }}
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
                  <p className="text-[11px] text-text-muted mt-1">PDF, DOCX, XLSX, TXT, PNG, JPG</p>
                </>
              )}
            </div>

            {/* Fields */}
            <div className="space-y-3 mb-5">
              <div>
                <label className="text-[12px] font-semibold text-text-secondary block mb-1">Danh mục</label>
                <select
                  value={uploadCat}
                  onChange={e => setUploadCat(e.target.value)}
                  className="input-base w-full"
                >
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
            </div>

            {/* Status feedback */}
            {uploadStatus === 'uploading' && (
              <div className="flex items-center gap-2 text-[13px] text-text-secondary mb-4 animate-fade-in">
                <Loader2 className="w-4 h-4 animate-spin text-accent" />
                Đang upload...
              </div>
            )}
            {uploadStatus === 'processing' && (
              <div className="flex items-center gap-2 text-[13px] text-text-secondary mb-4 animate-fade-in">
                <Loader2 className="w-4 h-4 animate-spin text-warning" />
                Đang xử lý & tạo vector...
              </div>
            )}
            {uploadStatus === 'done' && (
              <div className="flex items-center gap-2 text-[13px] text-success mb-4 animate-fade-in">
                <Check className="w-4 h-4" />
                Upload thành công!
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowUpload(false)}
                className="px-4 py-1.5 text-[13px] border border-border text-text-secondary rounded-lg hover:bg-hover transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={submitUpload}
                disabled={!uploadFile || uploadStatus !== 'idle'}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-1.5 text-[13px] font-semibold rounded-lg transition-colors',
                  !uploadFile || uploadStatus !== 'idle'
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

      {/* ── Edit Modal ──────────────────────────────────────────────────────── */}
      {editDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[16px] font-bold text-text-primary">Sửa tài liệu</h2>
              <button onClick={() => setEditDoc(null)} className="btn-icon w-7 h-7"><X className="w-3.5 h-3.5" /></button>
            </div>

            <div className="space-y-3 mb-5">
              <div>
                <label className="text-[12px] font-semibold text-text-secondary block mb-1">Tên file</label>
                <input
                  value={editForm.filename}
                  onChange={e => setEditForm(f => ({ ...f, filename: e.target.value }))}
                  className="input-base w-full"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-text-secondary block mb-1">Danh mục</label>
                <select
                  value={editForm.category}
                  onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                  className="input-base w-full"
                >
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditDoc(null)}
                className="px-4 py-1.5 text-[13px] border border-border text-text-secondary rounded-lg hover:bg-hover transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={saveEdit}
                className="flex items-center gap-1.5 px-4 py-1.5 text-[13px] font-semibold bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
              >
                <Check className="w-3.5 h-3.5" /> Lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentsPage;
