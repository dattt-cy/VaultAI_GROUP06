import React, { useState, useCallback } from 'react';
import { Search, Download, ExternalLink, Loader2, CheckSquare, Square, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
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

const MAX_SELECT = 10;

const LegalImportPage: React.FC = () => {
  const toast = useToast();
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<LegalDoc[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [categoryId, setCategoryId] = useState(1);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [searchError, setSearchError] = useState('');

  const handleSearch = useCallback(async () => {
    const q = keyword.trim();
    if (!q) return;
    setSearching(true);
    setSearchError('');
    setResults([]);
    setSelected(new Set());
    setImported(false);
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

  const toggleSelect = (id: string) => {
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

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
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

      {/* Error */}
      {searchError && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-danger/30 bg-danger/8 text-[13px] text-danger">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {searchError}
        </div>
      )}

      {/* Imported success banner */}
      {imported && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-success/30 bg-success/8 text-[13px] text-success">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          Đang import nền. Vào <strong className="mx-1">Tài liệu</strong> để theo dõi tiến trình.
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="card overflow-hidden">
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
                Đã chọn <span className="font-semibold text-text-primary">{selected.size}</span> / {results.length} văn bản
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Category selector */}
              <select
                value={categoryId}
                onChange={e => setCategoryId(Number(e.target.value))}
                className="px-2.5 py-1.5 rounded-lg border border-border bg-surface text-[12px] text-text-primary outline-none focus:border-accent/50 transition-colors cursor-pointer"
              >
                <option value={1}>Danh mục mặc định</option>
                <option value={2}>Pháp luật – Hành chính</option>
                <option value={3}>Quy định nội bộ</option>
              </select>

              <button
                onClick={handleImport}
                disabled={selected.size === 0 || importing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-[13px] font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
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
              return (
                <li
                  key={doc.item_id}
                  onClick={() => toggleSelect(doc.item_id)}
                  className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors ${
                    isSelected ? 'bg-accent/5' : 'hover:bg-hover/50'
                  }`}
                >
                  {/* Checkbox */}
                  <div className="flex-shrink-0 mt-0.5">
                    {isSelected
                      ? <CheckSquare className="w-4.5 h-4.5 text-accent" />
                      : <Square className="w-4.5 h-4.5 text-text-muted" />}
                  </div>

                  {/* Icon */}
                  <FileText className="w-4 h-4 flex-shrink-0 mt-0.5 text-text-muted" />

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className={`text-[13px] font-medium leading-snug ${isSelected ? 'text-accent' : 'text-text-primary'}`}>
                      {doc.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-text-muted">
                      {doc.doc_type && (
                        <span className="px-1.5 py-0.5 rounded bg-border/40 text-text-secondary font-medium">
                          {doc.doc_type}
                        </span>
                      )}
                      {doc.issued_date && <span>{doc.issued_date}</span>}
                      {doc.agency && <span>{doc.agency}</span>}
                    </div>
                  </div>

                  {/* Link */}
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    title="Xem trên vbpl.vn"
                    className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:text-accent hover:bg-elevated transition-colors mt-0.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default LegalImportPage;
