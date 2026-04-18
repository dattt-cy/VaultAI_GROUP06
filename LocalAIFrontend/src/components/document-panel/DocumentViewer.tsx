import React, { useEffect, useRef } from 'react';
import { FileText, AlertCircle, Loader2, Clock } from 'lucide-react';
import type { HighlightState } from '../../hooks/useDocumentHighlight';
import { useDocumentContent } from '../../hooks/useDocumentContent';

export const DocumentViewer: React.FC<{ highlight: HighlightState; filename?: string | null }> = ({ highlight, filename }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLElement | null>(null);
  const { data, loading, error } = useDocumentContent(filename);

  useEffect(() => {
    if (!loading && highlight.isVisible && highlight.citation && highlightRef.current && scrollContainerRef.current) {
      setTimeout(() => {
        const container = scrollContainerRef.current;
        const chunkTarget = highlightRef.current;
        if (!container || !chunkTarget) return;
        
        // Ưu tiên tìm chính xác dòng chữ được tô màu, nếu không thấy thì cuộn theo cả khối Chunk
        const target = chunkTarget.querySelector('.highlight-target-text') as HTMLElement || chunkTarget;
        
        const rect = target.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // Tính toán khoảng scroll tương đối để đưa target vào giữa container (Triệt tiêu lỗi giựt chéo màn hình của scrollIntoView)
        const scrollAmount = rect.top - containerRect.top - (container.clientHeight / 2) + (rect.height / 2);
        
        container.scrollBy({ top: scrollAmount, behavior: 'auto' });
      }, 100);
    }
  }, [highlight, loading, data]);

  // Hàm chuẩn hóa chuỗi để so khớp Highlight chính xác 100% không bị lệch dấu/xuống dòng
  const normalizeForMatch = (str: string) => str.replace(/[^\w\sà-ỹÀ-Ỹ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

  // Trạng thái đang xử lý (PROCESSING / PENDING)
  const isProcessing = !loading && !error && data &&
    (data.ingestion_status === 'PROCESSING' || data.ingestion_status === 'PENDING');

  return (
    <div ref={scrollContainerRef} className="h-full overflow-y-auto px-4 pt-3 pb-[50vh] select-none-all">
      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-text-muted">
          <Loader2 className="w-7 h-7 animate-spin text-accent" />
          <p className="text-[13px]">Đang tải nội dung...</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <AlertCircle className="w-8 h-8 text-danger" />
          <p className="text-[13px] text-danger text-center max-w-[240px]">{error}</p>
        </div>
      )}

      {/* PROCESSING / PENDING state */}
      {isProcessing && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Clock className="w-8 h-8 text-warning animate-pulse" />
          <p className="text-[13px] text-warning font-medium">Đang xử lý tài liệu...</p>
          <p className="text-[12px] text-text-muted text-center max-w-[200px]">Vui lòng chờ rồi thử lại.</p>
        </div>
      )}

      {/* Empty state — no filename selected */}
      {!loading && !error && !filename && (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-text-muted">
          <FileText className="w-8 h-8 opacity-40" />
          <p className="text-[13px] text-center">Chọn tài liệu để xem nội dung.</p>
        </div>
      )}

      {/* Empty state — no pages */}
      {!loading && !error && !isProcessing && filename && data && data.pages.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-text-muted">
          <FileText className="w-8 h-8 opacity-40" />
          <p className="text-[13px] text-center">Tài liệu không có nội dung văn bản.</p>
        </div>
      )}

      {/* Real content */}
      {!loading && !error && !isProcessing && data && data.pages.map((pg, pgIdx) => {
        const isHl = highlight.isVisible && highlight.citation?.page === pg.page;
        const nonEmptyLines = pg.lines.filter(l => l.trim() !== '');
        return (
          <div key={pg.page}>
            {/* Minimal chunk divider — only between chunks */}
            {pgIdx > 0 && (
              <div className="flex items-center gap-2 my-3">
                <div className="flex-1 h-px bg-border/50" />
                <span className="text-[10px] text-text-muted/40 tabular-nums">{pg.page}</span>
                <div className="flex-1 h-px bg-border/50" />
              </div>
            )}

            {pg.title && (
              <p className="text-[13px] font-semibold text-text-secondary mb-1.5">{pg.title}</p>
            )}

            <div
              ref={isHl ? highlightRef : undefined}
              className={`relative transition-all duration-300 ${
                isHl ? 'pl-3 border-l-2 border-warning/70' : 'pl-0'
              }`}
            >
              {nonEmptyLines.length > 0 ? nonEmptyLines.map((line, i) => {
                const spans = highlight.citation?.relevant_spans || [];
                let isLineRelevant = false;

                if (isHl) {
                  if (spans.length === 0) {
                    isLineRelevant = true;
                  } else {
                    const cleanLine = normalizeForMatch(line);
                    isLineRelevant = spans.some(s => {
                      const cleanS = normalizeForMatch(s);
                      if (cleanS.length < 5) return false;
                      return cleanLine.includes(cleanS) || cleanS.includes(cleanLine) ||
                        (cleanS.length > 20 && (cleanLine.includes(cleanS.slice(0, 15)) || cleanLine.includes(cleanS.slice(-15))));
                    });
                  }
                }

                return (
                  <p key={i} className={`leading-[1.75] text-[13px] mb-1 ${
                    line.includes('████')
                      ? 'text-danger font-mono'
                      : isLineRelevant
                        ? 'highlight-target-text bg-warning/20 text-text-primary px-1 rounded border-b border-warning/30 inline-block'
                        : 'text-text-primary'
                  }`}>
                    {line}
                  </p>
                );
              }) : (
                <p className="text-[12px] text-text-muted/50 italic">(Không có nội dung)</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

