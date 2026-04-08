import React, { useState } from 'react';
import { FileText, ZoomIn, ZoomOut, Shield, Lock, Search, ChevronRight } from 'lucide-react';
import { DocumentViewer } from './DocumentViewer';
import { SecurityOverlay } from './SecurityOverlay';
import type { HighlightState } from '../../hooks/useDocumentHighlight';

export const DocumentPanel: React.FC<{ highlight: HighlightState; activeFile?: string | null }> = ({ highlight, activeFile }) => {
  const [zoom, setZoom] = useState(100);

  return (
    <div className="flex flex-col h-full bg-surface border-l border-border overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-elevated flex-shrink-0">
        <FileText className="w-3.5 h-3.5 text-accent flex-shrink-0" />
        <span className="text-[12px] font-semibold text-text-secondary flex-1 truncate">
          {activeFile ?? 'Trình xem tài liệu'}
        </span>

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <button onClick={() => setZoom(z => Math.max(70, z - 10))}
            className="btn-icon w-6 h-6 text-sm">
            <ZoomOut className="w-3 h-3" />
          </button>
          <span className="text-[10px] text-text-muted w-9 text-center">{zoom}%</span>
          <button onClick={() => setZoom(z => Math.min(150, z + 10))}
            className="btn-icon w-6 h-6 text-sm">
            <ZoomIn className="w-3 h-3" />
          </button>
        </div>

        {/* Security badge */}
        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-danger/10 border border-danger/30">
          <Lock className="w-2.5 h-2.5 text-danger" />
          <span className="text-[9px] text-danger font-bold">BẢO MẬT</span>
        </div>
      </div>

      {/* Citation highlight banner */}
      {highlight.isVisible && highlight.citation && (
        <div className="flex items-center gap-2 px-3 py-2 bg-yellow-900/20 border-b border-yellow-700/30 flex-shrink-0 animate-fade-in">
          <Search className="w-3.5 h-3.5 text-warning flex-shrink-0" />
          <span className="text-[11px] text-warning flex-1 min-w-0 truncate">
            Trích dẫn từ <span className="font-semibold">{highlight.citation.sourceFile}</span> · Trang {highlight.citation.page}
          </span>
        </div>
      )}

      {/* Security notice bar */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-elevated border-b border-border flex-shrink-0">
        <Shield className="w-3 h-3 text-danger/70 flex-shrink-0" />
        <span className="text-[10px] text-text-muted">Thông tin cá nhân nhạy cảm đã che mờ · Sao chép bị khóa</span>
      </div>

      {/* Document content */}
      <div className="flex-1 min-h-0 overflow-hidden" style={{ fontSize: `${zoom}%` }}>
        <SecurityOverlay>
          <DocumentViewer highlight={highlight} filename={activeFile ?? undefined} />
        </SecurityOverlay>
      </div>
    </div>
  );
};
