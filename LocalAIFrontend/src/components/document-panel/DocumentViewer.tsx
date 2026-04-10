import React, { useEffect, useRef } from 'react';
import { Shield, FileText, AlertCircle, Loader2, Clock, CheckCircle2 } from 'lucide-react';
import type { HighlightState } from '../../hooks/useDocumentHighlight';
import { useDocumentContent } from '../../hooks/useDocumentContent';

export const DocumentViewer: React.FC<{ highlight: HighlightState; filename?: string | null }> = ({ highlight, filename }) => {
  const highlightRef = useRef<HTMLDivElement>(null);
  const { data, loading, error } = useDocumentContent(filename);

  useEffect(() => {
    if (highlight.isVisible && highlight.citation)
      highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlight]);

  // Trạng thái đang xử lý (PROCESSING / PENDING)
  const isProcessing = !loading && !error && data &&
    (data.ingestion_status === 'PROCESSING' || data.ingestion_status === 'PENDING');

  return (
    <div className="h-full overflow-y-auto px-5 py-4 select-none-all text-[14px]">
      {/* Doc header */}
      <div className="text-center mb-5 pb-4 border-b border-border">
        <p className="text-[14px] text-text-muted uppercase tracking-wider mb-1">Đang xem</p>
        <p className="font-semibold text-text-primary truncate">{filename ?? 'Chưa chọn tài liệu'}</p>
        {/* Summary bar */}
        {data && data.ingestion_status === 'SUCCESS' && (
          <div className="flex items-center justify-center gap-4 mt-2">
            <span className="flex items-center gap-1 text-[11px] text-success">
              <CheckCircle2 className="w-3 h-3" /> Đã xử lý
            </span>
            {data.total_chunks != null && (
              <span className="text-[11px] text-text-muted">{data.total_chunks} đoạn</span>
            )}
            {data.total_tokens != null && (
              <span className="text-[11px] text-text-muted">~{data.total_tokens.toLocaleString()} tokens</span>
            )}
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-text-muted">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
          <p className="text-[13px]">Đang tải nội dung tài liệu...</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-danger" />
          </div>
          <p className="text-[13px] text-danger text-center max-w-[240px]">{error}</p>
        </div>
      )}

      {/* PROCESSING / PENDING state */}
      {isProcessing && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-14 h-14 rounded-full bg-warning/10 border border-warning/30 flex items-center justify-center">
            <Clock className="w-7 h-7 text-warning animate-pulse" />
          </div>
          <p className="text-[13px] text-warning font-medium">Đang xử lý tài liệu...</p>
          <p className="text-[12px] text-text-muted text-center max-w-[220px]">
            Hệ thống đang đọc và phân tích nội dung.<br />Vui lòng chờ rồi thử lại.
          </p>
        </div>
      )}

      {/* Empty state — no filename selected */}
      {!loading && !error && !filename && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-text-muted">
          <div className="w-14 h-14 rounded-full bg-elevated border border-border flex items-center justify-center">
            <FileText className="w-7 h-7" />
          </div>
          <p className="text-[13px] text-center">Chọn một tài liệu từ danh sách bên trái để xem nội dung.</p>
        </div>
      )}

      {/* Empty state — SUCCESS but no pages */}
      {!loading && !error && !isProcessing && filename && data && data.pages.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-text-muted">
          <div className="w-14 h-14 rounded-full bg-elevated border border-border flex items-center justify-center">
            <FileText className="w-7 h-7" />
          </div>
          <p className="text-[13px] text-center">Tài liệu không có nội dung văn bản để hiển thị.</p>
        </div>
      )}

      {/* Real content from API */}
      {!loading && !error && !isProcessing && data && data.pages.map(pg => {
        const isHl = highlight.isVisible && highlight.citation?.page === pg.page;
        const nonEmptyLines = pg.lines.filter(l => l.trim() !== '');
        return (
          <div key={pg.page} className="mb-7">
            {/* Page / Chunk marker */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[14px] font-bold text-text-muted bg-elevated border border-border px-2 py-0.5 rounded uppercase tracking-wider flex-shrink-0">
                Đoạn {pg.page}
              </span>
              {pg.token_count != null && (
                <span className="text-[10px] text-text-muted/60 flex-shrink-0">{pg.token_count} tokens</span>
              )}
              <div className="flex-1 h-px bg-border" />
            </div>

            {pg.title && (
              <p className="text-[15px] font-semibold text-text-secondary mb-2">{pg.title}</p>
            )}

            <div
              ref={isHl ? highlightRef : undefined}
              className={`p-3.5 rounded-lg border transition-all duration-500 ${
                isHl
                  ? 'border-yellow-600/60 animate-highlight'
                  : 'bg-elevated border-border'
              }`}
              style={isHl ? { backgroundColor: 'rgba(187,128,9,0.2)', border: '1.5px solid rgba(187,128,9,0.6)' } : {}}
            >
              {nonEmptyLines.length > 0 ? nonEmptyLines.map((line, i) => (
                <p key={i} className={`leading-7 text-[13px] ${line.includes('████') ? 'text-danger font-mono' : 'text-text-primary'}`}>
                  {line}
                </p>
              )) : (
                <p className="text-[13px] text-text-muted italic">(Đoạn không có nội dung)</p>
              )}
              {isHl && (
                <div className="mt-2 pt-2 border-t border-yellow-600/30 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-warning" />
                  <span className="text-[14px] text-warning font-semibold">Đoạn văn bản được trích dẫn</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

