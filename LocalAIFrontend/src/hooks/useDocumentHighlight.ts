import { useState, useCallback } from 'react';
import type { Citation } from './useChatState';

export interface HighlightState {
  citation: Citation | null;
  isVisible: boolean;
  highlightLine?: string;
}

export function useDocumentHighlight() {
  const [highlight, setHighlight] = useState<HighlightState>({ citation: null, isVisible: false });
  const [activeFile, setActiveFile] = useState<string | null>(null);

  const highlightCitation = useCallback((citation: Citation, highlightLine?: string) => {
    setActiveFile(citation.sourceFile);
    setHighlight({ citation, isVisible: true, highlightLine });
  }, []);

  const clearHighlight = useCallback(() => {
    setHighlight({ citation: null, isVisible: false });
  }, []);

  return { highlight, activeFile, highlightCitation, clearHighlight, setActiveFile };
}
