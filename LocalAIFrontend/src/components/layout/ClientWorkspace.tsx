import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight as ChevronRightIcon, BookOpen, MessageSquare, FileText } from 'lucide-react';
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

type MobileTab = 'sources' | 'chat' | 'document';

export const ClientWorkspace: React.FC<ClientWorkspaceProps> = ({ initialSessionId }) => {
  const navigate = useNavigate();
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<string | undefined>();
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [selectedDocNames, setSelectedDocNames] = useState<string[]>([]);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [mobileTab, setMobileTab] = useState<MobileTab>('chat');

  const {
    messages, isGenerating, cancelledQuestion, currentSessionId, sessionTitle,
    sendMessage, cancelMessage, setFeedback, reportMessage, loadSession,
    renameSession, regenerateLast, editAndResend,
  } = useChatState();

  const { sharedDocs, privateDocs } = useDocumentTree(currentSessionId);
  const allDocs = [...sharedDocs, ...privateDocs]
    .filter(d => !['PENDING', 'PROCESSING', 'FAILED'].includes(d.ingestion_status))
    .map(d => ({ id: d.id, name: d.title }));

  useEffect(() => {
    if (initialSessionId && initialSessionId !== currentSessionId) {
      loadSession(initialSessionId);
    }
  }, [initialSessionId]); // eslint-disable-line

  useEffect(() => {
    if (currentSessionId) {
      navigate(`/workspace?id=${currentSessionId}`, { replace: true });
    }
  }, [currentSessionId, navigate]);

  const { highlight, highlightCitation } = useDocumentHighlight();

  const handleCitationClick = (c: Citation, sourceLine?: string) => {
    setActiveFile(c.sourceFile);
    highlightCitation(c, sourceLine);
    setMobileTab('document');
  };

  const handleSelectionChange = useCallback((ids: Set<number>, names: string[]) => {
    setCheckedIds(new Set(ids));
    setSelectedDocNames(names);
  }, []);

  const leftWidth = leftOpen ? '320px' : '0px';
  const rightWidth = rightOpen ? '360px' : '0px';

  const tabConfig: { key: MobileTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      key: 'sources',
      label: 'Nguồn',
      icon: <BookOpen className="w-5 h-5" />,
      badge: checkedIds.size > 0 ? checkedIds.size : undefined,
    },
    {
      key: 'chat',
      label: 'Trò chuyện',
      icon: <MessageSquare className="w-5 h-5" />,
      badge: messages.filter(m => m.role === 'assistant').length || undefined,
    },
    {
      key: 'document',
      label: 'Tài liệu',
      icon: <FileText className="w-5 h-5" />,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', minHeight: '-webkit-fill-available', overflow: 'hidden' }}>
      <TopHeader
        sessionTitle={sessionTitle}
        onRenameSession={currentSessionId ? (t) => renameSession(currentSessionId, t) : undefined}
      />

      {/* ── DESKTOP layout ── */}
      <div className="hidden md:block" style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'grid',
          gridTemplateColumns: `${leftWidth} 1fr ${rightWidth}`,
          transition: 'grid-template-columns 200ms ease',
          overflow: 'hidden',
        }}>
          <div style={{ overflow: 'hidden', minWidth: 0 }}>
            <LeftPanel
              onSelectFile={setActiveFile}
              onSelectionChange={handleSelectionChange}
              onBackToDashboard={() => navigate('/dashboard')}
              onCollapse={() => setLeftOpen(false)}
              currentSessionId={currentSessionId}
            />
          </div>

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

          <div style={{ overflow: 'hidden', minWidth: 0 }}>
            <DocumentPanel
              highlight={highlight}
              activeFile={activeFile}
              onCollapse={() => setRightOpen(false)}
            />
          </div>
        </div>

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

      {/* ── MOBILE layout ── */}
      <div className="flex md:hidden flex-col" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Panel area */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div style={{ display: mobileTab === 'sources' ? 'flex' : 'none', height: '100%', flexDirection: 'column' }}>
            <LeftPanel
              onSelectFile={(f) => { setActiveFile(f); setMobileTab('document'); }}
              onSelectionChange={handleSelectionChange}
              onBackToDashboard={() => navigate('/dashboard')}
              onCollapse={() => setMobileTab('chat')}
              currentSessionId={currentSessionId}
            />
          </div>

          <div style={{ display: mobileTab === 'chat' ? 'flex' : 'none', height: '100%', flexDirection: 'column' }}>
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
          </div>

          <div style={{ display: mobileTab === 'document' ? 'flex' : 'none', height: '100%', flexDirection: 'column' }}>
            <DocumentPanel
              highlight={highlight}
              activeFile={activeFile}
              onCollapse={() => setMobileTab('chat')}
            />
          </div>
        </div>

        {/* Bottom tab bar */}
        <nav
          style={{ flexShrink: 0 }}
          className="flex flex-col bg-surface border-t border-border"
        >
          <div className="flex items-stretch">
          {tabConfig.map(tab => (
            <button
              key={tab.key}
              onClick={() => setMobileTab(tab.key)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 relative transition-colors
                ${mobileTab === tab.key
                  ? 'text-accent'
                  : 'text-text-muted'}`}
            >
              <div className="relative">
                {tab.icon}
                {tab.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center leading-none">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-medium">{tab.label}</span>
              {mobileTab === tab.key && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-accent" />
              )}
            </button>
          ))}
          </div>
          {/* Fill iOS home indicator area */}
          <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} className="bg-surface" />
        </nav>
      </div>
    </div>
  );
};
