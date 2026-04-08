import React from 'react';
import { FileText } from 'lucide-react';
import type { Citation } from '../../hooks/useChatState';

interface CitationTagProps { citation: Citation; index: number; onClick: (c: Citation) => void; }

export const CitationTag: React.FC<CitationTagProps> = ({ citation, index, onClick }) => (
  <button
    onClick={() => onClick(citation)}
    title={`Xem nguồn: ${citation.sourceFile}, trang ${citation.page}\n"${citation.excerpt}"`}
    className="citation-tag mx-0.5 hover:-translate-y-px active:translate-y-0"
  >
    <FileText className="w-2.5 h-2.5" />
    <span className="font-bold">{index + 1}</span>
    <span className="text-citation/60 text-[10px] max-w-[100px] truncate">
      {citation.sourceFile.replace(/\.(pdf|docx|xlsx)$/i, '')} tr.{citation.page}
    </span>
  </button>
);
