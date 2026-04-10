import React, { useState } from 'react';
import { Search, ArrowLeft } from 'lucide-react';
import { FileExplorer } from './FileExplorer';
import { DropZone } from './DropZone';
import { useDocumentTree } from '../../hooks/useDocumentTree';

interface LeftPanelProps {
  onSelectFile: (name: string) => void;
  onSelectionChange: (ids: Set<number>) => void;
  onBackToDashboard: () => void;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({
  onSelectFile, onSelectionChange, onBackToDashboard,
}) => {
  const { sharedDocs, privateDocs, categories, loading, error, refetch } = useDocumentTree(1);
  const [search, setSearch] = useState('');

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
        <span className="text-[12px] font-bold text-text-primary tracking-wide">Nguồn tài liệu</span>
      </div>

      {/* ── Search bar ── */}
      <div className="px-2.5 py-2 border-b border-border flex-shrink-0">
        <div className="relative mb-2">
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
        <DropZone onSuccess={refetch} />
      </div>

      {/* ── File Tree ── */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-base/30 pt-1">
        <FileExplorer
          onSelectFile={onSelectFile}
          onSelectionChange={onSelectionChange}
          search={search}
          sharedDocs={sharedDocs}
          privateDocs={privateDocs}
          categories={categories}
          loading={loading}
          error={error}
          refetch={refetch}
        />
      </div>

    </div>
  );
};
