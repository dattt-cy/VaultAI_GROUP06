import React from 'react';
import type { Citation } from '../../hooks/useChatState';

interface CitationTagProps { citation: Citation; index: number; onClick: (c: Citation) => void; }

export const CitationTag: React.FC<CitationTagProps> = ({ citation, index, onClick }) => (
  <button
    onClick={() => onClick(citation)}
    title={`${citation.sourceFile} (trang ${citation.page})`}
    className="inline-flex items-center justify-center w-[16px] h-[16px] rounded-full bg-accent/15 text-accent text-[10px] font-bold mx-[1px] align-super hover:bg-accent hover:text-white transition-colors cursor-pointer select-none border border-accent/20"
  >
    {index + 1}
  </button>
);
