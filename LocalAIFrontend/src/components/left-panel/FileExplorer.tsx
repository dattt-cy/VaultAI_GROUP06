import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronRight, FileText, FileSpreadsheet, FileImage, Minus, Loader2, AlertCircle, RefreshCw, Trash2, X, Check } from 'lucide-react';
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

// ── Ingestion status indicator ────────────────────────────────────────────────
const StatusDot: React.FC<{ status: string; errorMessage?: string }> = ({ status, errorMessage }) => {
  if (status === 'SUCCESS' || status === 'COMPLETED') return null;
  if (status === 'PROCESSING')
    return <Loader2 className="w-3 h-3 text-warning animate-spin flex-shrink-0" title="Đang xử lý..." />;
  if (status === 'FAILED')
    return <AlertCircle className="w-3 h-3 text-danger flex-shrink-0" title={errorMessage ? `Lỗi: ${errorMessage}` : 'Xử lý thất bại'} />;
  return <span className="w-1.5 h-1.5 rounded-full bg-text-muted/40 flex-shrink-0" title="Chờ xử lý" />;
};

// ── Circular checkbox ─────────────────────────────────────────────────────────
interface NbCheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  accentColor?: string;
  className?: string;
}
const NbCheckbox: React.FC<NbCheckboxProps> = ({ checked, indeterminate = false, onChange, accentColor = 'bg-accent', className = '' }) => {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate; }, [indeterminate]);

  return (
    <label
      className={`relative flex items-center justify-center w-4 h-4 flex-shrink-0 cursor-pointer ${className}`}
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
  onDelete: (id: number) => Promise<void>;
  accentColor: string;
}
const DocRow: React.FC<DocRowProps> = ({ doc, checked, onToggle, onSelectFile, onDelete, accentColor }) => {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete(doc.id);
    setDeleting(false);
    setConfirming(false);
  };

  const isProcessing = doc.ingestion_status === 'PROCESSING' || doc.ingestion_status === 'PENDING';

  if (isProcessing) {
    return (
      <div className="flex items-center gap-2 w-full py-1.5 pl-9 pr-2 opacity-60">
        <FileIcon type={doc.file_type} />
        <span className="text-[12px] truncate flex-1 text-text-muted italic">
          {doc.title}
        </span>
        <Loader2 className="w-3.5 h-3.5 text-warning animate-spin flex-shrink-0" />
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 w-full py-1.5 pl-9 pr-2 group
                  transition-colors duration-100 hover:bg-hover
                  ${checked ? 'bg-accent/5' : ''}`}
    >
      {confirming ? (
        /* Inline delete confirm */
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="text-[11px] text-danger truncate flex-1">Xóa tài liệu?</span>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center justify-center w-5 h-5 rounded bg-danger/20 hover:bg-danger/40 text-danger transition-colors"
            title="Xác nhận xóa"
          >
            {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="flex items-center justify-center w-5 h-5 rounded bg-border/30 hover:bg-border/60 text-text-muted transition-colors"
            title="Hủy"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <>
          <button onClick={() => onSelectFile(doc.title)} className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer text-left">
            <FileIcon type={doc.file_type} />
            <span className={`text-[12px] truncate flex-1 text-left ${
              doc.ingestion_status === 'FAILED' ? 'text-danger/70 line-through' :
              checked ? 'text-text-primary font-medium' : 'text-text-secondary'
            }`}>
              {doc.title}
            </span>
            <StatusDot status={doc.ingestion_status} />
          </button>
          {/* Delete button — visible on hover */}
          <button
            onClick={e => { e.stopPropagation(); setConfirming(true); }}
            className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-5 h-5 rounded hover:bg-danger/20 text-text-muted hover:text-danger transition-all duration-100 flex-shrink-0"
            title="Xóa tài liệu"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          <NbCheckbox
            checked={checked}
            onChange={e => { e.stopPropagation(); onToggle(doc.id); }}
            accentColor={accentColor}
            className={checked ? '' : 'opacity-0 group-hover:opacity-100 transition-opacity duration-100'}
          />
        </>
      )}
    </div>
  );
};

// ── Collapsible wrapper (grid trick — no max-h cutoff) ────────────────────────
const Collapsible: React.FC<{ open: boolean; children: React.ReactNode }> = ({ open, children }) => (
  <div className={`grid transition-all duration-200 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
    <div className="overflow-hidden">{children}</div>
  </div>
);

// ── Category group row ────────────────────────────────────────────────────────
interface CategoryGroupProps {
  category: RealCategory | null;
  docs: RealDocument[];
  checkedIds: Set<number>;
  onToggleIds: (ids: number[]) => void;
  onSelectFile: (name: string) => void;
  onDelete: (id: number) => Promise<void>;
  search: string;
  accentColor: string;
}
const CategoryGroup: React.FC<CategoryGroupProps> = ({
  category, docs, checkedIds, onToggleIds, onSelectFile, onDelete, search, accentColor,
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
      <div className="group flex items-center gap-1.5 px-3 pr-2.5 py-1 hover:bg-hover/40 transition-colors">
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
          className={isAll || isPartial ? '' : 'opacity-0 group-hover:opacity-100 transition-opacity duration-100'}
        />
      </div>

      <Collapsible open={open || !!search}>
        {filtered.map(doc => (
          <DocRow
            key={doc.id}
            doc={doc}
            checked={checkedIds.has(doc.id)}
            onToggle={id => onToggleIds([id])}
            onSelectFile={onSelectFile}
            onDelete={onDelete}
            accentColor={accentColor}
          />
        ))}
      </Collapsible>
    </div>
  );
};

// ── Section header (Kho dùng chung / Kho cá nhân) ────────────────────────────
interface SectionHeaderProps {
  dotColor: string;
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  checkedCount: number;
  isAllChecked: boolean;
  isIndeterminate: boolean;
  onToggleAll: (e: React.ChangeEvent<HTMLInputElement>) => void;
  accentColor: string;
}
const SectionHeader: React.FC<SectionHeaderProps> = ({
  dotColor, label, count, open, onToggle, checkedCount,
  isAllChecked, isIndeterminate, onToggleAll, accentColor,
}) => (
  <div className="group flex items-center gap-1.5 px-3 pr-2.5 py-1.5 hover:bg-hover/50 transition-colors">
    <button onClick={onToggle} className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer text-left">
      <span className={`w-2 h-2 rounded-full ${dotColor} flex-shrink-0`} />
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider flex-1 text-left">{label}</span>
      <span className="text-[10px] text-text-muted/60 mr-1">{count}</span>
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
      className={isAllChecked || isIndeterminate ? '' : 'opacity-0 group-hover:opacity-100 transition-opacity duration-100'}
    />
  </div>
);

// ── Build catMap helper ───────────────────────────────────────────────────────
function buildCatMap(docs: RealDocument[]): Map<number | null, RealDocument[]> {
  const map = new Map<number | null, RealDocument[]>();
  for (const doc of docs) {
    const key = doc.category_id;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(doc);
  }
  return map;
}

// ── Main FileExplorer ─────────────────────────────────────────────────────────
interface FileExplorerProps {
  onSelectFile: (name: string) => void;
  onSelectionChange: (checkedIds: Set<number>) => void;
  onDelete: (id: number) => Promise<void>;
  search?: string;
  sharedDocs: RealDocument[];
  privateDocs: RealDocument[];
  categories: RealCategory[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  activeScope?: 'PERSONAL' | 'COMPANY';
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  onSelectFile, onSelectionChange, onDelete, search = '',
  sharedDocs, privateDocs, categories, loading, error, refetch,
  activeScope = 'COMPANY',
}) => {
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [sharedOpen, setSharedOpen] = useState(true);
  const [privateOpen, setPrivateOpen] = useState(true);

  const update = useCallback((next: Set<number>) => {
    setCheckedIds(next);
    onSelectionChange(next);
  }, [onSelectionChange]);

  // Auto-select personal docs khi ingestion hoàn thành
  const knownReadyIdsRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    const readyDocs = privateDocs.filter(
      d => d.ingestion_status === 'SUCCESS' || d.ingestion_status === 'COMPLETED'
    );
    const newIds = readyDocs
      .map(d => d.id)
      .filter(id => !knownReadyIdsRef.current.has(id));
    if (newIds.length > 0) {
      newIds.forEach(id => knownReadyIdsRef.current.add(id));
      setCheckedIds(prev => {
        const next = new Set([...prev, ...newIds]);
        onSelectionChange(next);
        return next;
      });
    }
  }, [privateDocs, onSelectionChange]);

  const toggleIds = (ids: number[]) => {
    const next = new Set(checkedIds);
    const allChecked = ids.every(id => next.has(id));
    ids.forEach(id => allChecked ? next.delete(id) : next.add(id));
    update(next);
  };

  const sharedCatMap = buildCatMap(sharedDocs);
  const privateCatMap = buildCatMap(privateDocs);

  const allSharedIds = sharedDocs.map(d => d.id);
  const sharedChecked = allSharedIds.filter(id => checkedIds.has(id));
  const isSharedAll = sharedChecked.length === allSharedIds.length && allSharedIds.length > 0;
  const isSharedPartial = sharedChecked.length > 0 && !isSharedAll;

  const allPrivateIds = privateDocs.map(d => d.id);
  const privateChecked = allPrivateIds.filter(id => checkedIds.has(id));
  const isPrivateAll = privateChecked.length === allPrivateIds.length && allPrivateIds.length > 0;
  const isPrivatePartial = privateChecked.length > 0 && !isPrivateAll;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-text-muted">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-[12px]">Đang tải tài liệu...</span>
      </div>
    );
  }

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

  const activeDocs = activeScope === 'PERSONAL' ? privateDocs : sharedDocs;

  if (activeDocs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
        <span className="text-[12px] text-text-muted leading-relaxed">
          {activeScope === 'PERSONAL'
            ? 'Chưa có tài liệu cá nhân.\nHãy upload để bắt đầu.'
            : 'Chưa có tài liệu chung.\nHãy upload để bắt đầu.'}
        </span>
      </div>
    );
  }

  if (activeScope === 'PERSONAL') {
    const filteredPrivate = search
      ? privateDocs.filter(d => d.title.toLowerCase().includes(search.toLowerCase()))
      : privateDocs;
    return (
      <div className="py-1">
        <SectionHeader
          dotColor="bg-warning"
          label="Kho cá nhân"
          count={filteredPrivate.length}
          open={privateOpen}
          onToggle={() => setPrivateOpen(o => !o)}
          checkedCount={privateChecked.length}
          isAllChecked={isPrivateAll}
          isIndeterminate={isPrivatePartial}
          onToggleAll={e => { e.stopPropagation(); toggleIds(allPrivateIds); }}
          accentColor="bg-warning"
        />
        <Collapsible open={privateOpen}>
          {filteredPrivate.map(doc => (
            <DocRow
              key={doc.id}
              doc={doc}
              checked={checkedIds.has(doc.id)}
              onToggle={id => toggleIds([id])}
              onSelectFile={onSelectFile}
              onDelete={onDelete}
              accentColor="bg-warning"
            />
          ))}
        </Collapsible>
      </div>
    );
  }

  return (
    <div className="py-1">
      <SectionHeader
        dotColor="bg-accent"
        label="Kho dùng chung"
        count={sharedDocs.length}
        open={sharedOpen}
        onToggle={() => setSharedOpen(o => !o)}
        checkedCount={sharedChecked.length}
        isAllChecked={isSharedAll}
        isIndeterminate={isSharedPartial}
        onToggleAll={e => { e.stopPropagation(); toggleIds(allSharedIds); }}
        accentColor="bg-accent"
      />
      <Collapsible open={sharedOpen}>
        {Array.from(sharedCatMap.entries()).map(([catId, docs]) => {
          const category = categories.find(c => c.id === catId) ?? null;
          return (
            <CategoryGroup
              key={catId ?? 'uncategorized'}
              category={category}
              docs={docs}
              checkedIds={checkedIds}
              onToggleIds={toggleIds}
              onSelectFile={onSelectFile}
              onDelete={onDelete}
              search={search}
              accentColor="bg-accent"
            />
          );
        })}
      </Collapsible>
    </div>
  );
};
