import React, { useEffect, useRef } from 'react';
import { FileText, AlertCircle, Loader2, Clock } from 'lucide-react';
import type { HighlightState } from '../../hooks/useDocumentHighlight';
import { useDocumentContent } from '../../hooks/useDocumentContent';

export const DocumentViewer: React.FC<{ highlight: HighlightState; filename?: string | null }> = ({ highlight, filename }) => {
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const { data, loading, error } = useDocumentContent(filename);

  useEffect(() => {
    if (!loading && highlight.isVisible && highlight.citation && highlightRef.current) {
      requestAnimationFrame(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }, [highlight, loading, data]);

  // Trạng thái đang xử lý (PROCESSING / PENDING)
  const isProcessing = !loading && !error && data &&
    (data.ingestion_status === 'PROCESSING' || data.ingestion_status === 'PENDING');

  return (
    <div className="h-full overflow-y-auto px-4 pt-3 pb-[50vh] select-none-all">
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
        const isHl = highlight.isVisible &&
          highlight.citation != null &&
          pg.chunk_index != null &&
          highlight.citation.chunk_index === pg.chunk_index;

        const highlightLine = highlight.highlightLine ?? '';

        // Strip markdown and normalise for Vietnamese word-overlap matching
        const cleanMd = (s: string) =>
          s.replace(/\*{1,3}|_{1,3}|`|#+|-\s*/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

        const scoreLineMatch = (docLine: string): number => {
          if (!highlightLine) return 0;
          const src = cleanMd(highlightLine);
          const doc = cleanMd(docLine);
          // Use 2-char minimum — Vietnamese syllables are typically 2–5 chars
          const srcTokens = src.split(/\s+/).filter(w => w.length >= 2);
          const docSet = new Set(doc.split(/\s+/).filter(w => w.length >= 2));
          if (srcTokens.length === 0) return 0;
          const matched = srcTokens.filter(w => docSet.has(w)).length;
          return matched / srcTokens.length;
        };

        const nonEmptyLines = pg.lines.filter(l => l.trim() !== '');

        const lineScores = isHl ? nonEmptyLines.map(l => scoreLineMatch(l)) : null;
        const maxScore = lineScores ? Math.max(...lineScores) : 0;
        // Highlight only lines within 80% of the best score, and at least 35% overlap
        const scoreThreshold = highlightLine ? Math.max(0.35, maxScore * 0.8) : 0;

        return (
          <div key={pg.chunk_index ?? pg.page}>
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
                const score = lineScores?.[i] ?? 0;
                const spanHl = isHl && (highlightLine
                  ? score >= scoreThreshold && maxScore >= 0.3
                  : true);
                return (
                  <p key={i} className={`leading-[1.75] text-[13px] mb-1 ${
                    line.includes('████')
                      ? 'text-danger font-mono'
                      : spanHl
                        ? 'bg-warning/20 text-text-primary px-1 rounded'
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

