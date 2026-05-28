import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { TopHeader } from './TopHeader';
import { LeftPanel } from '../left-panel/LeftPanel';
import { ChatPanel } from '../chat-panel/ChatPanel';
import { DocumentPanel } from '../document-panel/DocumentPanel';
import { useChatState } from '../../hooks/useChatState';
import { useDocumentHighlight } from '../../hooks/useDocumentHighlight';
import { useDocumentTree } from '../../hooks/useDocumentTree';
import type { Citation } from '../../hooks/useChatState';

interface ClientWorkspaceProps {
  initialSessionId?: number | null;
}

export const ClientWorkspace: React.FC<ClientWorkspaceProps> = ({ initialSessionId }) => {
  const navigate = useNavigate();
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<string | undefined>();
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [selectedDocNames, setSelectedDocNames] = useState<string[]>([]);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  const {
    messages, isGenerating, cancelledQuestion, currentSessionId, sessionTitle,
    sendMessage, cancelMessage, setFeedback, reportMessage, loadSession,
    renameSession, regenerateLast, editAndResend,
  } = useChatState();

  const { sharedDocs, privateDocs } = useDocumentTree(currentSessionId);
  const allDocs = [...sharedDocs, ...privateDocs]
    .filter(d => !['PENDING', 'PROCESSING', 'FAILED'].includes(d.ingestion_status))
    .map(d => ({ id: d.id, name: d.title }));

  // Load session từ URL param khi workspace mở
  useEffect(() => {
    if (initialSessionId) loadSession(initialSessionId);
  }, [initialSessionId]); // eslint-disable-line

  // Đồng bộ URL với session hiện tại để refresh không mất lịch sử
  useEffect(() => {
    if (currentSessionId) {
      navigate(`/workspace?id=${currentSessionId}`, { replace: true });
    }
  }, [currentSessionId, navigate]);

  const { highlight, highlightCitation } = useDocumentHighlight();

  const handleCitationClick = (c: Citation, sourceLine?: string) => {
    setActiveFile(c.sourceFile);
    highlightCitation(c, sourceLine);
  };

  const handleSelectionChange = useCallback((ids: Set<number>, names: string[]) => {
    setCheckedIds(new Set(ids));
    setSelectedDocNames(names);
  }, []);

  const leftWidth = leftOpen ? '320px' : '0px';
  const rightWidth = rightOpen ? '360px' : '0px';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <TopHeader
        sessionTitle={sessionTitle}
        onRenameSession={currentSessionId ? (t) => renameSession(currentSessionId, t) : undefined}
      />

      {/* Wrapper relative để đặt toggle buttons lên trên grid */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'grid',
          gridTemplateColumns: `${leftWidth} 1fr ${rightWidth}`,
          transition: 'grid-template-columns 200ms ease',
          overflow: 'hidden',
        }}>
          {/* LEFT: Source management */}
          <div style={{ overflow: 'hidden', minWidth: 0 }}>
            <LeftPanel
              onSelectFile={setActiveFile}
              onSelectionChange={handleSelectionChange}
              onBackToDashboard={() => navigate('/dashboard')}
              onCollapse={() => setLeftOpen(false)}
              currentSessionId={currentSessionId}
            />
          </div>

          {/* CENTER: Chatbot */}
          <ChatPanel
            messages={messages}
            isGenerating={isGenerating}
            onSend={(text, taggedDocIds) => sendMessage(text, taggedDocIds ?? Array.from(checkedIds))}
            onCancel={cancelMessage}
            onRegenerate={() => regenerateLast(Array.from(checkedIds))}
            onEditUserMessage={(id, text) => editAndResend(id, text, Array.from(checkedIds))}
            onCitationClick={handleCitationClick}
            onFeedback={setFeedback}
            onReport={reportMessage}
            prefill={prefill || cancelledQuestion || undefined}
            onPrefillConsumed={() => setPrefill(undefined)}
            checkedCount={checkedIds.size}
            checkedIds={checkedIds}
            selectedDocNames={selectedDocNames}
            availableDocs={allDocs}
          />

          {/* RIGHT: Document viewer */}
          <div style={{ overflow: 'hidden', minWidth: 0 }}>
            <DocumentPanel
              highlight={highlight}
              activeFile={activeFile}
              onCollapse={() => setRightOpen(false)}
            />
          </div>
        </div>

        {/* Re-open tabs — chỉ hiện khi panel đang đóng */}
        {!leftOpen && (
          <button
            onClick={() => setLeftOpen(true)}
            style={{ position: 'absolute', top: '40px', left: 0, zIndex: 30 }}
            className="w-5 h-9 flex items-center justify-center bg-elevated border border-border border-l-0 rounded-r-md text-text-muted hover:text-text-primary hover:bg-hover transition-colors shadow-sm"
            title="Hiện panel trái"
          >
            <ChevronRightIcon className="w-3 h-3" />
          </button>
        )}
        {!rightOpen && (
          <button
            onClick={() => setRightOpen(true)}
            style={{ position: 'absolute', top: '40px', right: 0, zIndex: 30 }}
            className="w-5 h-9 flex items-center justify-center bg-elevated border border-border border-r-0 rounded-l-md text-text-muted hover:text-text-primary hover:bg-hover transition-colors shadow-sm"
            title="Hiện panel phải"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};
