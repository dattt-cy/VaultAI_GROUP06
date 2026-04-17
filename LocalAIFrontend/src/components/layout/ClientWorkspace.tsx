import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopHeader } from './TopHeader';
import { LeftPanel } from '../left-panel/LeftPanel';
import { ChatPanel } from '../chat-panel/ChatPanel';
import { DocumentPanel } from '../document-panel/DocumentPanel';
import { useChatState } from '../../hooks/useChatState';
import { useDocumentHighlight } from '../../hooks/useDocumentHighlight';
import type { Citation } from '../../hooks/useChatState';

export const ClientWorkspace: React.FC = () => {
  const navigate = useNavigate();
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<string | undefined>();
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());

  const {
    messages, isGenerating, cancelledQuestion,
    sendMessage, cancelMessage, setFeedback
  } = useChatState();

  const { highlight, highlightCitation } = useDocumentHighlight();

  const handleCitationClick = (c: Citation) => {
    setActiveFile(c.sourceFile);
    highlightCitation(c);
  };

  const handleSelectionChange = useCallback((ids: Set<number>) => {
    setCheckedIds(new Set(ids));
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <TopHeader role="Sổ tay AI" />

      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '320px 1fr 360px',
        overflow: 'hidden',
        minHeight: 0,
      }}>
        {/* LEFT: Source management */}
        <LeftPanel
          onSelectFile={setActiveFile}
          onSelectionChange={handleSelectionChange}
          onBackToDashboard={() => navigate('/dashboard')}
        />

        {/* CENTER: Chatbot */}
        <ChatPanel
          messages={messages}
          isGenerating={isGenerating}
          onSend={(text) => sendMessage(text, Array.from(checkedIds))}
          onCancel={cancelMessage}
          onCitationClick={handleCitationClick}
          onFeedback={setFeedback}
          prefill={prefill || cancelledQuestion || undefined}
          onPrefillConsumed={() => setPrefill(undefined)}
          checkedCount={checkedIds.size}
          totalCount={-1}
        />

        {/* RIGHT: Document viewer */}
        <DocumentPanel
          highlight={highlight}
          activeFile={activeFile}
        />
      </div>
    </div>
  );
};
