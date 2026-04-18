import React, { useEffect, useRef } from 'react';
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

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  const shortName = citation.sourceFile.length > 36
    ? citation.sourceFile.slice(0, 33) + '…'
    : citation.sourceFile;

  // Strip markdown: **bold**, *italic*, - bullets, # headers
  const stripMd = (s: string) =>
    s.replace(/\*{1,3}(.*?)\*{1,3}/g, '$1')
     .replace(/^[-#]+\s*/gm, '')
     .replace(/\s+/g, ' ')
     .trim();

  // Câu được cite (thay đổi theo từng occurrence)
  const citedText = sourceLine ? stripMd(sourceLine) : null;

  // Chunk content làm ngữ cảnh — highlight vùng khớp với citedText
  const chunkText = stripMd(citation.excerpt);

  // Tách chunk thành before / match / after xung quanh citedText
  const getChunkParts = () => {
    if (!citedText || !chunkText) return { before: chunkText, match: '', after: '' };
    // Tìm vị trí khớp bằng cách so sánh các từ dài (>= 3 ký tự)
    const words = citedText.split(/\s+/).filter(w => w.length >= 3);
    const needle = words.slice(0, 4).join(' '); // dùng 4 từ đầu làm anchor
    const idx = needle ? chunkText.toLowerCase().indexOf(needle.toLowerCase()) : -1;
    if (idx === -1) return { before: chunkText, match: '', after: '' };
    // Mở rộng match ra toàn bộ citedText
    const matchEnd = Math.min(idx + citedText.length + 20, chunkText.length);
    return {
      before: chunkText.slice(0, idx),
      match: chunkText.slice(idx, matchEnd),
      after: chunkText.slice(matchEnd),
    };
  };

  const { before, match, after } = getChunkParts();

  const top = anchorRect.bottom + 6;
  const left = Math.max(8, Math.min(anchorRect.left - 8, window.innerWidth - 336));

  return (
    <div
      ref={popupRef}
      style={{ position: 'fixed', top, left, zIndex: 9999, width: 360 }}
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

      {/* Nội dung chunk với phần được cite nổi bật */}
      <div className="px-3 py-2.5 max-h-52 overflow-y-auto">
        <p className="text-[12px] text-text-secondary leading-relaxed whitespace-pre-wrap">
          {match ? (
            <>
              {before && <span className="opacity-70">{before}</span>}
              <span className="bg-warning/30 text-text-primary font-medium px-0.5 rounded">
                {match}
              </span>
              {after && <span className="opacity-70">{after}</span>}
            </>
          ) : (
            <span>{chunkText}</span>
          )}
        </p>
      </div>

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
