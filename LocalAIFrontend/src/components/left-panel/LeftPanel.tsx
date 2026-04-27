import React, { useState, useCallback } from 'react';
import { ArrowLeft, ChevronsLeft, Search, UploadCloud, ChevronUp } from 'lucide-react';
import { FileExplorer } from './FileExplorer';
import { DropZone } from './DropZone';
import { useDocumentTree } from '../../hooks/useDocumentTree';
import { useAuth } from '../../contexts/AuthContext';

interface LeftPanelProps {
  onSelectFile: (name: string) => void;
  onSelectionChange: (ids: Set<number>, names: string[]) => void;
  onBackToDashboard: () => void;
  onCollapse?: () => void;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({
  onSelectFile, onSelectionChange, onBackToDashboard, onCollapse,
}) => {
  const { sharedDocs, privateDocs, categories, loading, error, refetch, deleteDocument } = useDocumentTree();

  const handleSelectionChange = useCallback((ids: Set<number>) => {
    const allDocs = [...sharedDocs, ...privateDocs];
    const names = Array.from(ids)
      .map(id => allDocs.find(d => d.id === id)?.title ?? '')
      .filter(Boolean);
    onSelectionChange(ids, names);
  }, [sharedDocs, privateDocs, onSelectionChange]);
  const { user, isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<'PERSONAL' | 'COMPANY'>('COMPANY');
  const [uploadOpen, setUploadOpen] = useState(false);

  // Có quyền upload vào kho chung nếu là admin hoặc có ít nhất 1 category can_upload
  const canUploadCompany = isAdmin || (user?.category_permissions ?? []).some(p => p.can_upload);

  return (
    <div className="flex flex-col h-full bg-surface border-r border-border overflow-hidden">

      {/* ── Top header ── */}
      <div className="flex items-center gap-3 px-3.5 py-3 border-b border-border bg-elevated flex-shrink-0">
        <button
          onClick={onBackToDashboard}
          className="w-7 h-7 flex items-center justify-center rounded bg-base border border-border text-text-muted hover:text-text-primary hover:border-accent/50 transition-colors"
          title="Trở về trang chính"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-[12px] font-bold text-text-primary tracking-wide flex-1">Nguồn tài liệu</span>
        {onCollapse && (
          <button
            onClick={onCollapse}
            className="w-6 h-6 flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-base/80 transition-colors"
            title="Ẩn panel"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── Scope tabs ── */}
      <div className="flex border-b border-border flex-shrink-0">
        <button
          onClick={() => setScope('PERSONAL')}
          className={`flex-1 py-2 text-[11px] font-semibold transition-colors border-b-2 ${
            scope === 'PERSONAL'
              ? 'border-warning text-warning bg-warning/5'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          Cá nhân
        </button>
        <button
          onClick={() => setScope('COMPANY')}
          className={`flex-1 py-2 text-[11px] font-semibold transition-colors border-b-2 ${
            scope === 'COMPANY'
              ? 'border-accent text-accent bg-accent/5'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          Chung
        </button>
      </div>

      {/* ── Search bar ── */}
      <div className="px-2.5 py-2 border-b border-border flex-shrink-0">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm tài liệu..."
            className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-elevated border border-border rounded-md
                       text-text-primary placeholder:text-text-muted outline-none
                       focus:border-accent/60 focus:ring-1 focus:ring-accent/10 transition-all"
          />
        </div>
      </div>

      {/* ── File Tree ── */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-base/30 pt-1">
        <FileExplorer
          onSelectFile={onSelectFile}
          onSelectionChange={handleSelectionChange}
          onDelete={deleteDocument}
          search={search}
          sharedDocs={sharedDocs}
          privateDocs={privateDocs}
          categories={categories}
          loading={loading}
          error={error}
          refetch={refetch}
          activeScope={scope}
        />
      </div>

      {/* ── Upload section — collapsed by default ── */}
      {(scope === 'PERSONAL' || canUploadCompany) && (
        <div className="border-t border-border flex-shrink-0">
          {uploadOpen && (
            <div className="p-2.5 border-b border-border/50 bg-elevated/30">
              <DropZone
                categories={categories}
                onSuccess={() => { refetch(); setUploadOpen(false); }}
                scope={scope}
              />
            </div>
          )}
          <button
            onClick={() => setUploadOpen(v => !v)}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold
                       text-text-muted hover:text-text-primary hover:bg-hover transition-colors"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>{uploadOpen ? 'Đóng' : 'Tải tài liệu lên'}</span>
            <ChevronUp className={`w-3 h-3 transition-transform duration-200 ${uploadOpen ? '' : 'rotate-180'}`} />
          </button>
        </div>
      )}

    </div>
  );
};
