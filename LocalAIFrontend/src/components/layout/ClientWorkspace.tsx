import React, { useState } from 'react';
import { TopHeader } from './TopHeader';
import { LeftPanel } from '../left-panel/LeftPanel';
import { ChatPanel } from '../chat-panel/ChatPanel';
import { DocumentPanel } from '../document-panel/DocumentPanel';
import { useChatState } from '../../hooks/useChatState';
import { useDocumentHighlight } from '../../hooks/useDocumentHighlight';
import type { Citation } from '../../hooks/useChatState';

export const ClientWorkspace: React.FC = () => {
  const [role, setRole] = useState('Pháp chế');
  const [activeFile, setActiveFile] = useState<string>('Quy chế nội bộ 2024.pdf');
  const [prefill, setPrefill] = useState<string | undefined>();

  const {
    messages, sessions, activeSessionId, isGenerating,
    sendMessage, setFeedback, newSession, setActiveSessionId,
  } = useChatState();

  const { highlight, highlightCitation } = useDocumentHighlight();

  const handleCitationClick = (c: Citation) => {
    setActiveFile(c.sourceFile);
    highlightCitation(c);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <TopHeader role={role} />

      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '280px 1fr 360px',
        overflow: 'hidden',
        minHeight: 0,
      }}>
        {/* LEFT: Source management */}
        <LeftPanel
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={setActiveSessionId}
          onNewSession={newSession}
          onSelectFile={setActiveFile}
          onSelectQuestion={(q) => setPrefill(q)}
          role={role}
          onRoleChange={setRole}
        />

        {/* CENTER: Chatbot */}
        <ChatPanel
          messages={messages}
          isGenerating={isGenerating}
          onSend={sendMessage}
          onCitationClick={handleCitationClick}
          onFeedback={setFeedback}
          prefill={prefill}
          onPrefillConsumed={() => setPrefill(undefined)}
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
