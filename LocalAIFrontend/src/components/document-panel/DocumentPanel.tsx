import React, { useState } from 'react';
import { ChevronsRight, FileText, ZoomIn, ZoomOut, Lock, Search } from 'lucide-react';
import { DocumentViewer } from './DocumentViewer';
import { SecurityOverlay } from './SecurityOverlay';
import type { HighlightState } from '../../hooks/useDocumentHighlight';

export const DocumentPanel: React.FC<{ highlight: HighlightState; activeFile?: string | null; onCollapse?: () => void }> = ({ highlight, activeFile, onCollapse }) => {
  const [zoom, setZoom] = useState(100);

  return (
    <div className="flex flex-col h-full bg-surface border-l border-border overflow-hidden">
      {/* Toolbar — single compact row */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-elevated flex-shrink-0">
        {onCollapse && (
          <button
            onClick={onCollapse}
            className="w-6 h-6 flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-base/80 transition-colors flex-shrink-0"
            title="Ẩn panel"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        )}
        <FileText className="w-3.5 h-3.5 text-accent flex-shrink-0" />
        <span className="text-[13px] font-medium text-text-secondary flex-1 truncate min-w-0">
          {activeFile ?? 'Trình xem tài liệu'}
        </span>

        {/* Zoom */}
        <div className="flex items-center gap-0.5">
          <button onClick={() => setZoom(z => Math.max(70, z - 10))} className="btn-icon w-6 h-6">
            <ZoomOut className="w-3 h-3" />
          </button>
          <span className="text-[12px] text-text-muted w-8 text-center tabular-nums">{zoom}%</span>
          <button onClick={() => setZoom(z => Math.min(150, z + 10))} className="btn-icon w-6 h-6">
            <ZoomIn className="w-3 h-3" />
          </button>
        </div>

        {/* Security badge — compact icon+text */}
        <div title="Thông tin nhạy cảm đã che mờ · Sao chép bị khóa"
          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-danger/10 border border-danger/20 cursor-default">
          <Lock className="w-2.5 h-2.5 text-danger" />
          <span className="text-[11px] text-danger font-semibold">BẢO MẬT</span>
        </div>
      </div>

      {/* Citation banner — only when active */}
      {highlight.isVisible && highlight.citation && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-warning/10 border-b border-warning/25 flex-shrink-0 animate-fade-in">
          <Search className="w-3 h-3 text-warning flex-shrink-0" />
          <span className="text-[12px] text-warning/90 flex-1 min-w-0 truncate">
            Đoạn {highlight.citation.page} · <span className="font-medium">{highlight.citation.sourceFile}</span>
          </span>
        </div>
      )}

      {/* Document content */}
      <div className="flex-1 min-h-0 overflow-hidden" style={{ fontSize: `${zoom}%` }}>
        <SecurityOverlay>
          <DocumentViewer highlight={highlight} filename={activeFile ?? undefined} />
        </SecurityOverlay>
      </div>
    </div>
  );
};
