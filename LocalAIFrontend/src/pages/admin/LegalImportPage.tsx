import React, { useState, useCallback, useEffect } from 'react';
import {
  Search, Download, ExternalLink, Loader2, CheckSquare, Square,
  FileText, AlertCircle, CheckCircle2, X, BookOpen, Building2,
  CalendarDays, Tag, ChevronRight,
} from 'lucide-react';
import { PageHeader } from '../../components/admin/ui/PageHeader';
import { useToast } from '../../components/admin/ui/Toast';
import { apiGet, apiPost } from '../../utils/apiClient';

interface LegalDoc {
  item_id: string;
  title: string;
  doc_type: string;
  issued_date: string;
  agency: string;
  url: string;
  abstract?: string;
}

interface Category {
  id: number;
  name: string;
  description?: string;
}

const MAX_SELECT = 10;

const LegalImportPage: React.FC = () => {
  const toast = useToast();
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<LegalDoc[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [preview, setPreview] = useState<LegalDoc | null>(null);

  // Fetch real categories on mount
  useEffect(() => {
    apiGet('/api/documents/categories')
      .then(r => r.json())
      .then(data => {
        const cats: Category[] = data.categories ?? [];
        setCategories(cats);
        if (cats.length > 0) setCategoryId(cats[0].id);
      })
      .catch(() => {});
  }, []);

  const handleSearch = useCallback(async () => {
    const q = keyword.trim();
    if (!q) return;
    setSearching(true);
    setSearchError('');
    setResults([]);
    setSelected(new Set());
    setImported(false);
    setPreview(null);
    try {
      const res = await apiGet(`/api/admin/legal-import/search?q=${encodeURIComponent(q)}&max=10`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setResults(data.results ?? []);
      if ((data.results ?? []).length === 0) {
        setSearchError('Không tìm thấy văn bản nào. Thử từ khóa khác.');
      }
    } catch (e: any) {
      setSearchError(e.message || 'Lỗi kết nối đến vbpl.vn');
    } finally {
      setSearching(false);
    }
  }, [keyword]);

  const toggleSelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_SELECT) {
        next.add(id);
      } else {
        toast.error(`Chỉ được chọn tối đa ${MAX_SELECT} văn bản`);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === results.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(results.slice(0, MAX_SELECT).map(r => r.item_id)));
    }
  };

  const handleImport = useCallback(async () => {
    if (selected.size === 0) return;
    if (!categoryId) {
      toast.error('Vui lòng chọn danh mục trước khi import');
      return;
    }
    setImporting(true);
    try {
      const res = await apiPost('/api/admin/legal-import/download', {
        item_ids: Array.from(selected),
        category_id: categoryId,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setImported(true);
      setSelected(new Set());
      toast.success(data.message || `Đang import ${selected.size} văn bản...`);
    } catch (e: any) {
      toast.error(e.message || 'Import thất bại');
    } finally {
      setImporting(false);
    }
  }, [selected, categoryId, toast]);

  const selectedCategory = categories.find(c => c.id === categoryId);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <PageHeader
        title="Import Văn bản Pháp luật"
        subtitle="Tìm kiếm và tải văn bản từ vbpl.vn (Cơ sở dữ liệu Quốc gia)"
      />

      {/* Search bar */}
      <div className="card p-4 space-y-3">
        <label className="text-[13px] font-medium text-text-secondary">Từ khóa tìm kiếm</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            <input
              type="text"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Ví dụ: Luật lao động, Nghị định 23/2021, Thông tư thuế..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-surface text-[14px] text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50 transition-colors"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !keyword.trim()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-white text-[14px] font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Tìm kiếm
          </button>
        </div>
        <p className="text-[12px] text-text-muted">
          Kết quả lấy từ{' '}
          <a href="https://vbpl.vn" target="_blank" rel="noreferrer" className="text-accent hover:underline">
            vbpl.vn
          </a>
          {' '}— Cơ sở dữ liệu Văn bản Pháp luật Quốc gia · Tối đa 10 kết quả
        </p>
      </div>

      {searchError && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-danger/30 bg-danger/8 text-[13px] text-danger">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {searchError}
        </div>
      )}

      {imported && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-success/30 bg-success/8 text-[13px] text-success">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          Đang import nền vào <strong className="mx-1">{selectedCategory?.name ?? 'danh mục đã chọn'}</strong>.
          Vào <strong className="mx-1">Tài liệu</strong> để theo dõi tiến trình.
        </div>
      )}

      {/* Results + Preview side-by-side */}
      {results.length > 0 && (
        <div className={`flex gap-4 items-start transition-all duration-200 ${preview ? '' : ''}`}>
          {/* Left: list */}
          <div className="flex-1 min-w-0 card overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/50 bg-surface/50">
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleAll}
                  className="flex items-center gap-1.5 text-[12px] text-text-secondary hover:text-accent transition-colors cursor-pointer"
                >
                  {selected.size === results.length
                    ? <CheckSquare className="w-4 h-4 text-accent" />
                    : <Square className="w-4 h-4" />}
                  {selected.size === results.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </button>
                <span className="text-[12px] text-text-muted">
                  Đã chọn <span className="font-semibold text-text-primary">{selected.size}</span> / {results.length}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Category selector — real data */}
                <select
                  value={categoryId}
                  onChange={e => setCategoryId(Number(e.target.value))}
                  className="px-2.5 py-1.5 rounded-lg border border-border bg-surface text-[12px] text-text-primary outline-none focus:border-accent/50 transition-colors cursor-pointer max-w-[180px]"
                >
                  {categories.length === 0 && (
                    <option value="">Đang tải danh mục...</option>
                  )}
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>

                <button
                  onClick={handleImport}
                  disabled={selected.size === 0 || importing || !categoryId}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-[13px] font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
                >
                  {importing
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Download className="w-3.5 h-3.5" />}
                  Import {selected.size > 0 ? `(${selected.size})` : ''}
                </button>
              </div>
            </div>

            {/* Doc list */}
            <ul className="divide-y divide-border/40">
              {results.map(doc => {
                const isSelected = selected.has(doc.item_id);
                const isPreviewing = preview?.item_id === doc.item_id;
                return (
                  <li
                    key={doc.item_id}
                    onClick={() => setPreview(isPreviewing ? null : doc)}
                    className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors group ${
                      isPreviewing
                        ? 'bg-accent/8 border-l-2 border-accent'
                        : isSelected
                          ? 'bg-accent/5 hover:bg-accent/8'
                          : 'hover:bg-hover/50'
                    }`}
                  >
                    {/* Checkbox — separate click target */}
                    <div
                      className="flex-shrink-0 mt-0.5 p-1 -m-1 rounded"
                      onClick={e => toggleSelect(e, doc.item_id)}
                    >
                      {isSelected
                        ? <CheckSquare className="w-4 h-4 text-accent" />
                        : <Square className="w-4 h-4 text-text-muted group-hover:text-text-secondary" />}
                    </div>

                    <FileText className="w-4 h-4 flex-shrink-0 mt-0.5 text-text-muted" />

                    <div className="flex-1 min-w-0 space-y-1">
                      <p className={`text-[13px] font-medium leading-snug ${isPreviewing ? 'text-accent' : isSelected ? 'text-accent/90' : 'text-text-primary'}`}>
                        {doc.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-text-muted">
                        {doc.doc_type && (
                          <span className="px-1.5 py-0.5 rounded bg-border/40 text-text-secondary font-medium">
                            {doc.doc_type}
                          </span>
                        )}
                        {doc.issued_date && <span>{doc.issued_date}</span>}
                        {doc.agency && <span className="truncate max-w-[160px]">{doc.agency}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isPreviewing ? 'rotate-90 text-accent' : 'text-text-muted/40 group-hover:text-text-muted'}`} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Right: Preview panel */}
          {preview && (
            <div className="w-80 flex-shrink-0 card overflow-hidden animate-fade-in">
              {/* Header */}
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/50 bg-surface/50">
                <div className="flex items-center gap-2 min-w-0">
                  <BookOpen className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                  <span className="text-[12px] font-semibold text-text-secondary truncate">Xem trước</span>
                </div>
                <button
                  onClick={() => setPreview(null)}
                  className="w-6 h-6 flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-elevated transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-4 space-y-4 overflow-y-auto max-h-[540px]">
                {/* Title */}
                <h3 className="text-[13px] font-semibold text-text-primary leading-snug">
                  {preview.title}
                </h3>

                {/* Meta */}
                <div className="space-y-2">
                  {preview.doc_type && (
                    <div className="flex items-start gap-2 text-[12px]">
                      <Tag className="w-3.5 h-3.5 text-text-muted flex-shrink-0 mt-0.5" />
                      <span className="text-text-secondary">{preview.doc_type}</span>
                    </div>
                  )}
                  {preview.issued_date && (
                    <div className="flex items-start gap-2 text-[12px]">
                      <CalendarDays className="w-3.5 h-3.5 text-text-muted flex-shrink-0 mt-0.5" />
                      <span className="text-text-secondary">{preview.issued_date}</span>
                    </div>
                  )}
                  {preview.agency && (
                    <div className="flex items-start gap-2 text-[12px]">
                      <Building2 className="w-3.5 h-3.5 text-text-muted flex-shrink-0 mt-0.5" />
                      <span className="text-text-secondary leading-relaxed">{preview.agency}</span>
                    </div>
                  )}
                </div>

                {/* Abstract */}
                {preview.abstract && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">Tóm tắt</p>
                    <p className="text-[12px] text-text-secondary leading-relaxed whitespace-pre-wrap">
                      {preview.abstract}
                    </p>
                  </div>
                )}

                {!preview.abstract && (
                  <p className="text-[12px] text-text-muted italic">Không có tóm tắt cho văn bản này.</p>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-2 pt-1">
                  <a
                    href={preview.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border text-[12px] text-text-secondary hover:text-accent hover:border-accent/40 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Xem trên vbpl.vn
                  </a>
                  <button
                    onClick={e => toggleSelect(e, preview.item_id)}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors ${
                      selected.has(preview.item_id)
                        ? 'bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20'
                        : 'bg-accent text-white hover:bg-accent-hover'
                    }`}
                  >
                    {selected.has(preview.item_id)
                      ? <><CheckSquare className="w-3.5 h-3.5" /> Đã chọn để import</>
                      : <><Download className="w-3.5 h-3.5" /> Chọn để import</>}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LegalImportPage;
