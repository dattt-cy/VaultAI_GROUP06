import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FileText, ExternalLink, X } from 'lucide-react';
import type { Citation } from '../../hooks/useChatState';

interface CitationPopupProps {
  citation: Citation;
  anchorRect: DOMRect;
  sourceLine?: string;
  onNavigate: (c: Citation, sourceLine?: string) => void;
  onClose: () => void;
}

export const CitationPopup: React.FC<CitationPopupProps> = ({
  citation, anchorRect, sourceLine, onNavigate, onClose,
}) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({
    top: anchorRect.bottom + 6,
    left: Math.max(8, Math.min(anchorRect.left - 8, window.innerWidth - 416)),
  });

  useLayoutEffect(() => {
    if (!popupRef.current) return;
    const { height } = popupRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - anchorRect.bottom - 8;
    const top = spaceBelow >= height
      ? anchorRect.bottom + 6
      : Math.max(8, anchorRect.top - height - 6);
    const left = Math.max(8, Math.min(anchorRect.left - 8, window.innerWidth - 416));
    setPos({ top, left });
  }, [anchorRect]);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  const baseName = citation.sourceFile.replace(/\.[a-z]{2,5}$/i, '');
  const shortName = baseName.length > 36
    ? baseName.slice(0, 33) + '…'
    : baseName;

  // Strip markdown: **bold**, *italic*, - bullets, # headers
  const stripMd = (s: string) =>
    s.replace(/\*{1,3}(.*?)\*{1,3}/g, '$1')
     .replace(/^[-#]+\s*/gm, '')
     .replace(/\s+/g, ' ')
     .trim();

  // Câu trung tâm — thay đổi theo từng occurrence được click
  const citedText = sourceLine ? stripMd(sourceLine) : null;

  // Chunk content đầy đủ làm ngữ cảnh phía dưới
  const chunkText = stripMd(citation.excerpt);

  // Fuzzy match: thử giảm dần số từ cho đến khi tìm được vị trí trong chunk
  const getChunkParts = () => {
    if (!citedText || !chunkText) return { before: '', match: '', after: chunkText };

    const words = citedText.split(/\s+/).filter(w => w.length >= 3);
    let idx = -1;
    let needle = '';

    for (let n = Math.min(5, words.length); n >= 2; n--) {
      needle = words.slice(0, n).join(' ');
      idx = chunkText.toLowerCase().indexOf(needle.toLowerCase());
      if (idx !== -1) break;
    }

    // Match thất bại (LLM paraphrase) → show toàn bộ chunk
    if (idx === -1) return { before: '', match: '', after: chunkText };

    const matchEnd = Math.min(idx + Math.max(citedText.length, needle.length) + 10, chunkText.length);
    return {
      before: chunkText.slice(0, idx),
      match: chunkText.slice(idx, matchEnd),
      after: chunkText.slice(matchEnd),
    };
  };

  const { before, match, after } = getChunkParts();

  return (
    <div
      ref={popupRef}
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, width: 400 }}
      className="bg-surface border border-border rounded-xl shadow-xl overflow-hidden animate-fade-in"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-elevated border-b border-border/60">
        <FileText className="w-3.5 h-3.5 text-accent flex-shrink-0" />
        <span className="text-[12px] font-medium text-text-primary flex-1 truncate">{shortName}</span>
        <span className="text-[10px] text-text-muted flex-shrink-0 mr-1">Đoạn {citation.chunk_index + 1}</span>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Câu trung tâm — luôn thay đổi theo từng click */}
      {citedText && (
        <div className="mx-3 mt-2.5 px-2.5 py-2 rounded-lg bg-accent/10 border-l-2 border-accent/50">
          <p className="text-[12px] text-text-primary leading-relaxed font-medium">
            {citedText}
          </p>
        </div>
      )}

      {/* Ngữ cảnh chunk — đoạn dài từ tài liệu, có scroll */}
      {chunkText && (
        <div className="px-3 pt-2 pb-1">
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1 font-semibold">
            Ngữ cảnh trong tài liệu
          </p>
          <div className="max-h-64 overflow-y-auto pr-1">
            <p className="text-[12px] text-text-secondary leading-relaxed whitespace-pre-wrap">
              {match ? (
                <>
                  {before && <span className="opacity-60">{before}</span>}
                  <span className="bg-warning/25 text-text-primary px-0.5 rounded">{match}</span>
                  {after && <span className="opacity-60">{after}</span>}
                </>
              ) : (
                chunkText
              )}
            </p>
          </div>
        </div>
      )}

      {/* Navigate button */}
      <div className="px-3 pb-3">
        <button
          onClick={() => { onNavigate(citation, sourceLine); onClose(); }}
          className="flex items-center gap-1.5 text-[11px] text-accent hover:text-accent/80 font-medium transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Xem trong tài liệu
        </button>
      </div>
    </div>
  );
};
