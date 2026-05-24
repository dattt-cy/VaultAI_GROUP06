import React, { useEffect, useRef } from 'react';
import { FileText, AlertCircle, Loader2, Clock } from 'lucide-react';
import type { HighlightState } from '../../hooks/useDocumentHighlight';
import { useDocumentContent } from '../../hooks/useDocumentContent';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const cleanMd = (s: string) =>
  s.replace(/\*{1,3}|_{1,3}|`|#+|-\s*/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

const isHeaderLine = (line: string) => {
  const t = line.trim();
  // Numbered heading: "1.", "4.2.", "4.2.1 Tiêu đề"
  if (/^\d+(\.\d+)*\.?\s+\S/.test(t) && t.length < 120) return true;
  // ALL-CAPS Vietnamese heading (≥4 words or ≥10 chars, no lowercase)
  if (t.length >= 8 && t === t.toUpperCase() && /[A-ZĐÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂẮẶẸẺẼẾỀ]/.test(t)) return true;
  return false;
};

const isBulletLine = (line: string) => /^\s*[-•*]\s+/.test(line);
const isNumberedListLine = (line: string) => /^\s*\d+[.)]\s+/.test(line);

type LineGroup =
  | { kind: 'header'; text: string }
  | { kind: 'bullet'; items: string[] }
  | { kind: 'numbered'; items: string[] }
  | { kind: 'para'; lines: string[] };

function groupLines(lines: string[]): LineGroup[] {
  const groups: LineGroup[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (isHeaderLine(line)) {
      groups.push({ kind: 'header', text: line.trim() });
      i++;
      continue;
    }

    if (isBulletLine(line)) {
      const items: string[] = [];
      while (i < lines.length && (isBulletLine(lines[i]) || (!isHeaderLine(lines[i]) && !isNumberedListLine(lines[i]) && lines[i].trim() === ''))) {
        if (lines[i].trim()) items.push(lines[i].replace(/^\s*[-•*]\s+/, '').trim());
        i++;
      }
      if (items.length) groups.push({ kind: 'bullet', items });
      continue;
    }

    if (isNumberedListLine(line)) {
      const items: string[] = [];
      while (i < lines.length && (isNumberedListLine(lines[i]) || (!isHeaderLine(lines[i]) && !isBulletLine(lines[i]) && lines[i].trim() === ''))) {
        if (lines[i].trim()) items.push(lines[i].replace(/^\s*\d+[.)]\s+/, '').trim());
        i++;
      }
      if (items.length) groups.push({ kind: 'numbered', items });
      continue;
    }

    // Regular paragraph: accumulate until header/list/blank-then-header
    const paraLines: string[] = [];
    while (i < lines.length) {
      const l = lines[i];
      if (isHeaderLine(l) || isBulletLine(l) || isNumberedListLine(l)) break;
      if (!l.trim()) {
        // Peek ahead: if next non-empty is a header, break paragraph
        let j = i + 1;
        while (j < lines.length && !lines[j].trim()) j++;
        if (j < lines.length && (isHeaderLine(lines[j]) || isBulletLine(lines[j]) || isNumberedListLine(lines[j]))) break;
        // Otherwise soft-break within paragraph
        if (paraLines.length) { i++; break; }
      }
      if (l.trim()) paraLines.push(l.trim());
      i++;
    }
    if (paraLines.length) groups.push({ kind: 'para', lines: paraLines });
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Score helper for citation highlight
// ---------------------------------------------------------------------------

function scoreLineMatch(docLine: string, highlightLine: string): number {
  if (!highlightLine) return 0;
  const src = cleanMd(highlightLine);
  const doc = cleanMd(docLine);
  const srcTokens = src.split(/\s+/).filter(w => w.length >= 2);
  const docSet = new Set(doc.split(/\s+/).filter(w => w.length >= 2));
  if (srcTokens.length === 0) return 0;
  return srcTokens.filter(w => docSet.has(w)).length / srcTokens.length;
}

// ---------------------------------------------------------------------------
// Sub-renderers
// ---------------------------------------------------------------------------

interface GroupProps {
  group: LineGroup;
  isHl: boolean;
  highlightLine: string;
  maxScore: number;
  scoreThreshold: number;
  allLines: string[];
  lineOffset: number;
}

const hlClass = 'bg-warning/25 text-text-primary rounded px-1';
const baseTextClass = 'text-text-primary';

const renderText = (text: string, shouldHl: boolean) =>
  text.includes('████')
    ? <span className="text-danger font-mono tracking-widest">{text}</span>
    : <span className={shouldHl ? hlClass : ''}>{text}</span>;

const GroupBlock: React.FC<GroupProps> = ({ group, isHl, highlightLine, maxScore, scoreThreshold, allLines, lineOffset }) => {
  const needsHl = (text: string) => {
    if (!isHl || !highlightLine) return false;
    const score = scoreLineMatch(text, highlightLine);
    return score >= scoreThreshold && maxScore >= 0.3;
  };

  if (group.kind === 'header') {
    const hl = needsHl(group.text);
    // Detect level: 1. → h2, 1.1. → h3, 1.1.1 → h4, ALL CAPS → h2
    const level = /^\d+\.\d+\.\d+/.test(group.text) ? 'h4'
      : /^\d+\.\d+/.test(group.text) ? 'h3'
      : 'h2';
    const sizeClass = level === 'h2'
      ? 'text-[14px] font-bold text-text-primary mt-4 mb-1.5'
      : level === 'h3'
        ? 'text-[13px] font-semibold text-text-secondary mt-3 mb-1'
        : 'text-[12px] font-semibold text-text-muted mt-2 mb-0.5';
    return (
      <p className={`${sizeClass} leading-snug ${hl ? 'bg-warning/20 px-1 rounded' : ''}`}>
        {group.text}
      </p>
    );
  }

  if (group.kind === 'bullet') {
    return (
      <ul className="list-none pl-0 mb-2 space-y-0.5">
        {group.items.map((item, i) => {
          const hl = needsHl(item);
          return (
            <li key={i} className={`flex gap-2 text-[13px] leading-[1.7] ${baseTextClass}`}>
              <span className="text-accent mt-[3px] flex-shrink-0">•</span>
              <span className={hl ? hlClass : ''}>{item}</span>
            </li>
          );
        })}
      </ul>
    );
  }

  if (group.kind === 'numbered') {
    return (
      <ol className="list-none pl-0 mb-2 space-y-0.5">
        {group.items.map((item, i) => {
          const hl = needsHl(item);
          return (
            <li key={i} className={`flex gap-2 text-[13px] leading-[1.7] ${baseTextClass}`}>
              <span className="text-text-muted tabular-nums flex-shrink-0 w-5 text-right">{i + 1}.</span>
              <span className={hl ? hlClass : ''}>{item}</span>
            </li>
          );
        })}
      </ol>
    );
  }

  // paragraph
  return (
    <p className={`text-[13px] leading-[1.8] mb-2 ${baseTextClass}`}>
      {group.lines.map((line, i) => (
        <React.Fragment key={i}>
          {renderText(line, needsHl(line))}
          {i < group.lines.length - 1 && ' '}
        </React.Fragment>
      ))}
    </p>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

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

  const isProcessing = !loading && !error && data &&
    (data.ingestion_status === 'PROCESSING' || data.ingestion_status === 'PENDING');

  return (
    <div className="h-full overflow-y-auto px-5 pt-4 pb-[50vh] select-none-all">
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-text-muted">
          <Loader2 className="w-7 h-7 animate-spin text-accent" />
          <p className="text-[13px]">Đang tải nội dung...</p>
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <AlertCircle className="w-8 h-8 text-danger" />
          <p className="text-[13px] text-danger text-center max-w-[240px]">{error}</p>
        </div>
      )}

      {isProcessing && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Clock className="w-8 h-8 text-warning animate-pulse" />
          <p className="text-[13px] text-warning font-medium">Đang xử lý tài liệu...</p>
          <p className="text-[12px] text-text-muted text-center max-w-[200px]">Vui lòng chờ rồi thử lại.</p>
        </div>
      )}

      {!loading && !error && !filename && (
        <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-elevated border border-border flex items-center justify-center">
            <FileText className="w-6 h-6 text-text-muted opacity-50" />
          </div>
          <div>
            <p className="text-[13px] text-text-secondary font-medium mb-1">Chưa chọn tài liệu</p>
            <p className="text-[12px] text-text-muted leading-relaxed">
              Click vào <span className="font-mono text-citation bg-citation/10 px-1 rounded">[1]</span> trong câu trả lời để xem đoạn trích dẫn nguồn tại đây.
            </p>
          </div>
        </div>
      )}

      {!loading && !error && !isProcessing && filename && data && data.pages.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-text-muted">
          <FileText className="w-8 h-8 opacity-40" />
          <p className="text-[13px] text-center">Tài liệu không có nội dung văn bản.</p>
        </div>
      )}

      {!loading && !error && !isProcessing && data && data.pages.map((pg, pgIdx) => {
        const isHl = highlight.isVisible &&
          highlight.citation != null &&
          pg.chunk_index != null &&
          highlight.citation.chunk_index === pg.chunk_index;

        const highlightLine = highlight.highlightLine ?? '';
        const nonEmptyLines = pg.lines.filter(l => l.trim() !== '');
        const groups = groupLines(nonEmptyLines);

        // Pre-compute score range for this chunk
        const allScores = isHl && highlightLine
          ? nonEmptyLines.map(l => scoreLineMatch(l, highlightLine))
          : null;
        const maxScore = allScores ? Math.max(0, ...allScores) : 0;
        const scoreThreshold = highlightLine ? Math.max(0.35, maxScore * 0.8) : 0;

        return (
          <div key={pg.chunk_index ?? pg.page} className="mb-1">
            {/* Page separator */}
            {pgIdx > 0 && (
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-border/40" />
                <span className="text-[10px] font-medium text-text-muted/50 bg-elevated border border-border/50 px-2 py-0.5 rounded-full tabular-nums">
                  Trang {pg.page}
                </span>
                <div className="flex-1 h-px bg-border/40" />
              </div>
            )}

            {/* Section title from chunk metadata */}
            {pg.title && !isHeaderLine(pg.title) && (
              <p className="text-[13px] font-semibold text-text-secondary mb-2">{pg.title}</p>
            )}

            {/* Highlighted chunk border */}
            <div
              ref={isHl ? highlightRef : undefined}
              className={`transition-all duration-300 ${
                isHl
                  ? 'pl-3 border-l-2 border-warning/60 bg-warning/5 rounded-r pr-2 py-1'
                  : ''
              }`}
            >
              {groups.length > 0 ? groups.map((group, gi) => (
                <GroupBlock
                  key={gi}
                  group={group}
                  isHl={isHl}
                  highlightLine={highlightLine}
                  maxScore={maxScore}
                  scoreThreshold={scoreThreshold}
                  allLines={nonEmptyLines}
                  lineOffset={0}
                />
              )) : (
                <p className="text-[12px] text-text-muted/50 italic">(Không có nội dung)</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
