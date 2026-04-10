import React, { useState, useCallback } from 'react';
import { ChevronRight, FileText, FileSpreadsheet, FileImage, Minus, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import type { RealDocument, RealCategory } from '../../hooks/useDocumentTree';

// ── File type icon ────────────────────────────────────────────────────────────
const FileIcon: React.FC<{ type: string }> = ({ type }) => {
  const t = type?.toLowerCase();
  if (t === 'pdf')  return <FileText       className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />;
  if (t === 'docx' || t === 'doc')
                    return <FileText       className="w-3.5 h-3.5 text-accent flex-shrink-0" />;
  if (t === 'xlsx' || t === 'xls')
                    return <FileSpreadsheet className="w-3.5 h-3.5 text-success flex-shrink-0" />;
  if (['jpg','jpeg','png','gif'].includes(t))
                    return <FileImage      className="w-3.5 h-3.5 text-warning flex-shrink-0" />;
  return                   <FileText      className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />;
};

// ── Ingestion status dot ──────────────────────────────────────────────────────
const StatusDot: React.FC<{ status: string }> = ({ status }) => {
  if (status === 'SUCCESS')    return <span className="w-1.5 h-1.5 rounded-full bg-success flex-shrink-0" title="Đã xử lý" />;
  if (status === 'PROCESSING') return <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse flex-shrink-0" title="Đang xử lý" />;
  if (status === 'FAILED')     return <span className="w-1.5 h-1.5 rounded-full bg-danger flex-shrink-0" title="Lỗi xử lý" />;
  return                              <span className="w-1.5 h-1.5 rounded-full bg-text-muted/40 flex-shrink-0" title="Chờ xử lý" />;
};

// ── Circular checkbox ─────────────────────────────────────────────────────────
interface NbCheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  accentColor?: string;
}
const NbCheckbox: React.FC<NbCheckboxProps> = ({ checked, indeterminate = false, onChange, accentColor = 'bg-accent' }) => {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate; }, [indeterminate]);

  return (
    <label
      className="relative flex items-center justify-center w-4 h-4 flex-shrink-0 cursor-pointer"
      onClick={e => e.stopPropagation()}
    >
      <input ref={ref} type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      <span
        className={`w-4 h-4 rounded-full border-2 transition-all duration-150 flex items-center justify-center
          ${checked || indeterminate
            ? `${accentColor} border-transparent shadow-sm`
            : 'border-border/60 bg-transparent hover:border-accent/60'}`}
      >
        {indeterminate && !checked
          ? <Minus className="w-2 h-2 text-white" strokeWidth={3} />
          : checked
            ? <svg className="w-2 h-2 text-white" viewBox="0 0 10 8" fill="none">
                <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            : null}
      </span>
    </label>
  );
};

// ── Document file row ─────────────────────────────────────────────────────────
interface DocRowProps {
  doc: RealDocument;
  checked: boolean;
  onToggle: (id: number) => void;
  onSelectFile: (name: string) => void;
  accentColor: string;
}
const DocRow: React.FC<DocRowProps> = ({ doc, checked, onToggle, onSelectFile, accentColor }) => (
  <div
    className={`flex items-center gap-2 w-full py-1.5 pl-9 pr-2.5 group
                transition-colors duration-100 hover:bg-hover
                ${checked ? 'bg-accent/5' : ''}`}
  >
    <button onClick={() => onSelectFile(doc.title)} className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer text-left">
      <FileIcon type={doc.file_type} />
      <span className={`text-[12px] truncate flex-1 text-left ${checked ? 'text-text-primary font-medium' : 'text-text-secondary'}`}>
        {doc.title}
      </span>
      <StatusDot status={doc.ingestion_status} />
    </button>
    <NbCheckbox
      checked={checked}
      onChange={e => { e.stopPropagation(); onToggle(doc.id); }}
      accentColor={accentColor}
    />
  </div>
);

// ── Category group row ────────────────────────────────────────────────────────
interface CategoryGroupProps {
  category: RealCategory | null;  // null = "Không có danh mục"
  docs: RealDocument[];
  checkedIds: Set<number>;
  onToggleIds: (ids: number[]) => void;
  onSelectFile: (name: string) => void;
  search: string;
  accentColor: string;
}
const CategoryGroup: React.FC<CategoryGroupProps> = ({
  category, docs, checkedIds, onToggleIds, onSelectFile, search, accentColor,
}) => {
  const [open, setOpen] = useState(true);

  const filtered = search
    ? docs.filter(d => d.title.toLowerCase().includes(search.toLowerCase()))
    : docs;

  if (filtered.length === 0) return null;

  const allIds = filtered.map(d => d.id);
  const checkedCount = allIds.filter(id => checkedIds.has(id)).length;
  const isAll = checkedCount === allIds.length;
  const isPartial = checkedCount > 0 && !isAll;

  const toggleAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onToggleIds(allIds);
  };

  return (
    <div>
      {/* Category header */}
      <div className="flex items-center gap-1.5 px-3 pr-2.5 py-1 hover:bg-hover/40 transition-colors">
        <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer text-left">
          <ChevronRight className={`w-3 h-3 text-text-muted flex-shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
          <span className="text-[11px] font-semibold text-text-secondary truncate flex-1 text-left">
            {category ? category.name : 'Chung'}
          </span>
          {checkedCount > 0 && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${accentColor} text-white mr-1`}>
              {checkedCount}
            </span>
          )}
        </button>
        <NbCheckbox
          checked={isAll}
          indeterminate={isPartial}
          onChange={toggleAll}
          accentColor={accentColor}
        />
      </div>

      {/* Doc rows */}
      <div className={`overflow-hidden transition-all duration-200 ${open || search ? 'max-h-96' : 'max-h-0'}`}>
        {filtered.map(doc => (
          <DocRow
            key={doc.id}
            doc={doc}
            checked={checkedIds.has(doc.id)}
            onToggle={id => onToggleIds([id])}
            onSelectFile={onSelectFile}
            accentColor={accentColor}
          />
        ))}
      </div>
    </div>
  );
};

// ── Section header (Kho dùng chung / Kho cá nhân) ────────────────────────────
interface SectionHeaderProps {
  dotColor: string;
  label: string;
  open: boolean;
  onToggle: () => void;
  checkedCount: number;
  isAllChecked: boolean;
  isIndeterminate: boolean;
  onToggleAll: (e: React.ChangeEvent<HTMLInputElement>) => void;
  accentColor: string;
}
const SectionHeader: React.FC<SectionHeaderProps> = ({
  dotColor, label, open, onToggle, checkedCount,
  isAllChecked, isIndeterminate, onToggleAll, accentColor,
}) => (
  <div className="flex items-center gap-1.5 px-3 pr-2.5 py-1.5 hover:bg-hover/50 transition-colors">
    <button onClick={onToggle} className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer text-left">
      <span className={`w-2 h-2 rounded-full ${dotColor} flex-shrink-0`} />
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider flex-1 text-left">{label}</span>
      {checkedCount > 0 && (
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${accentColor} text-white mr-1`}>
          {checkedCount}
        </span>
      )}
      <ChevronRight className={`w-3 h-3 text-text-muted transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
    </button>
    <NbCheckbox
      checked={isAllChecked}
      indeterminate={isIndeterminate}
      onChange={onToggleAll}
      accentColor={accentColor}
    />
  </div>
);

// ── Main FileExplorer ─────────────────────────────────────────────────────────
interface FileExplorerProps {
  onSelectFile: (name: string) => void;
  onSelectionChange: (checkedIds: Set<number>) => void;
  search?: string;
  sharedDocs: RealDocument[];
  privateDocs: RealDocument[];
  categories: RealCategory[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ 
  onSelectFile, onSelectionChange, search = '',
  sharedDocs, privateDocs, categories, loading, error, refetch
}) => {
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [sharedOpen, setSharedOpen] = useState(true);
  const [privateOpen, setPrivateOpen] = useState(true);

  const update = useCallback((next: Set<number>) => {
    setCheckedIds(next);
    onSelectionChange(next);
  }, [onSelectionChange]);

  const toggleIds = (ids: number[]) => {
    const next = new Set(checkedIds);
    const allChecked = ids.every(id => next.has(id));
    ids.forEach(id => allChecked ? next.delete(id) : next.add(id));
    update(next);
  };

  // Group shared docs by category
  const catMap = new Map<number | null, RealDocument[]>();
  for (const doc of sharedDocs) {
    const key = doc.category_id;
    if (!catMap.has(key)) catMap.set(key, []);
    catMap.get(key)!.push(doc);
  }

  // Section-level helpers
  const allSharedIds = sharedDocs.map(d => d.id);
  const sharedChecked = allSharedIds.filter(id => checkedIds.has(id));
  const isSharedAll = sharedChecked.length === allSharedIds.length && allSharedIds.length > 0;
  const isSharedPartial = sharedChecked.length > 0 && !isSharedAll;

  const allPrivateIds = privateDocs.map(d => d.id);
  const privateChecked = allPrivateIds.filter(id => checkedIds.has(id));
  const isPrivateAll = privateChecked.length === allPrivateIds.length && allPrivateIds.length > 0;
  const isPrivatePartial = privateChecked.length > 0 && !isPrivateAll;

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-text-muted">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-[12px]">Đang tải tài liệu...</span>
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 px-4">
        <AlertCircle className="w-5 h-5 text-danger" />
        <span className="text-[12px] text-danger text-center">Không kết nối được backend</span>
        <button
          onClick={refetch}
          className="flex items-center gap-1.5 text-[11px] text-accent hover:underline cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" /> Thử lại
        </button>
      </div>
    );
  }

  // ── Empty state ──
  if (sharedDocs.length === 0 && privateDocs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
        <span className="text-[12px] text-text-muted leading-relaxed">
          Chưa có tài liệu nào.<br />Hãy upload tài liệu để bắt đầu.
        </span>
      </div>
    );
  }

  return (
    <div className="py-1">

      {/* ── Kho dùng chung ── */}
      {sharedDocs.length > 0 && (
        <div className="mb-0.5">
          <SectionHeader
            dotColor="bg-accent"
            label="Kho dùng chung"
            open={sharedOpen}
            onToggle={() => setSharedOpen(o => !o)}
            checkedCount={sharedChecked.length}
            isAllChecked={isSharedAll}
            isIndeterminate={isSharedPartial}
            onToggleAll={e => { e.stopPropagation(); toggleIds(allSharedIds); }}
            accentColor="bg-accent"
          />
          <div className={`overflow-hidden transition-all duration-200 ${sharedOpen ? 'max-h-[600px]' : 'max-h-0'}`}>
            {/* Grouped by category */}
            {Array.from(catMap.entries()).map(([catId, docs]) => {
              const category = categories.find(c => c.id === catId) ?? null;
              return (
                <CategoryGroup
                  key={catId ?? 'uncategorized'}
                  category={category}
                  docs={docs}
                  checkedIds={checkedIds}
                  onToggleIds={toggleIds}
                  onSelectFile={onSelectFile}
                  search={search}
                  accentColor="bg-accent"
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── Kho cá nhân ── */}
      {privateDocs.length > 0 && (
        <div className={sharedDocs.length > 0 ? 'border-t border-border/50 pt-0.5' : ''}>
          <SectionHeader
            dotColor="bg-warning"
            label="Kho cá nhân"
            open={privateOpen}
            onToggle={() => setPrivateOpen(o => !o)}
            checkedCount={privateChecked.length}
            isAllChecked={isPrivateAll}
            isIndeterminate={isPrivatePartial}
            onToggleAll={e => { e.stopPropagation(); toggleIds(allPrivateIds); }}
            accentColor="bg-warning"
          />
          <div className={`overflow-hidden transition-all duration-200 ${privateOpen ? 'max-h-[300px]' : 'max-h-0'}`}>
            {privateDocs
              .filter(d => !search || d.title.toLowerCase().includes(search.toLowerCase()))
              .map(doc => (
                <DocRow
                  key={doc.id}
                  doc={doc}
                  checked={checkedIds.has(doc.id)}
                  onToggle={id => toggleIds([id])}
                  onSelectFile={onSelectFile}
                  accentColor="bg-warning"
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );
};
