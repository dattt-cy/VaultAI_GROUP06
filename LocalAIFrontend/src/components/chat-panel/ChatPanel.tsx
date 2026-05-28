import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MessageSquare, Loader2, BookOpen, ChevronDown, ScrollText } from 'lucide-react';
import type { Message, Citation } from '../../hooks/useChatState';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { SampleQuestions } from '../left-panel/SampleQuestions';

interface ChatPanelProps {
  messages: Message[];
  isGenerating: boolean;
  onSend: (t: string, taggedDocIds?: number[]) => void;
  onCancel: () => void;
  onRegenerate?: () => void;
  onEditUserMessage?: (id: string, newText: string) => void;
  onCitationClick: (c: Citation) => void;
  onFeedback: (id: string, type: 'like' | 'dislike', comment?: string) => void;
  onReport: (id: string, reportType: string, comment: string) => void;
  prefill?: string;
  onPrefillConsumed?: () => void;
  checkedCount: number;
  checkedIds?: Set<number>;
  selectedDocNames?: string[];
  availableDocs?: { id: number; name: string }[];
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages, isGenerating, onSend, onCancel, onRegenerate, onEditUserMessage,
  onCitationClick, onFeedback, onReport, prefill, onPrefillConsumed,
  checkedCount, checkedIds, selectedDocNames = [], availableDocs = [],
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevLenRef = useRef(messages.length);
  const isAtBottomRef = useRef(true);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMsgCount, setNewMsgCount] = useState(0);
  const [editPrefill, setEditPrefill] = useState<string | undefined>();

  // Keep ref in sync to avoid stale closure inside the effect below
  useEffect(() => { isAtBottomRef.current = isAtBottom; }, [isAtBottom]);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    setNewMsgCount(0);
  }, []);

  // Auto-scroll only when user is already at bottom; use 'auto' during streaming for perf
  useEffect(() => {
    if (isAtBottomRef.current) {
      scrollToBottom(!isGenerating);
    } else if (messages.length > prevLenRef.current) {
      // Track new messages while user scrolled up
      setNewMsgCount(c => c + (messages.length - prevLenRef.current));
    }
    prevLenRef.current = messages.length;
  }, [messages, isGenerating, scrollToBottom]);

  // Track whether user is at bottom via IntersectionObserver
  useEffect(() => {
    const sentinel = bottomRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsAtBottom(entry.isIntersecting);
        if (entry.isIntersecting) setNewMsgCount(0);
      },
      { root: scrollContainerRef.current, threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // Keyboard: ↑ at empty input → edit last user message
  const handleEditLast = useCallback(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        setEditPrefill(messages[i].content);
        return;
      }
    }
  }, [messages]);

  const noSources = checkedCount === 0;

  const lastCompletedAssistantId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === 'assistant' && !m.isStreaming && !m.isCancelled && m.id !== 'welcome') return m.id;
    }
    return undefined;
  })();

  const sourceLabel = (() => {
    if (checkedCount === 0) return null;
    if (selectedDocNames.length === 0) return `${checkedCount} nguồn`;
    const visible = selectedDocNames.slice(0, 2);
    const rest = checkedCount - visible.length;
    return visible.join(', ') + (rest > 0 ? ` +${rest} khác` : '');
  })();

  return (
    <div className="relative flex flex-col h-full overflow-hidden bg-base">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-accent" />
          <span className="text-[14px] font-semibold text-text-primary">Cuộc trò chuyện</span>
          <span className="badge bg-elevated text-text-muted border border-border">{messages.length} tin</span>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && !isGenerating && (
            <button
              onClick={() => onSend('Hãy tóm tắt ngắn gọn cuộc trò chuyện này thành các điểm chính, kèm kết luận quan trọng.')}
              title="Tóm tắt cuộc trò chuyện"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium text-text-muted border border-border hover:border-accent/50 hover:text-accent hover:bg-accent/5 transition-all"
            >
              <ScrollText className="w-3.5 h-3.5" />
              Tóm tắt
            </button>
          )}
          {checkedCount > 0 ? (
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-accent/10 border border-accent/20 max-w-[200px]"
              title={selectedDocNames.join('\n')}
            >
              <BookOpen className="w-3 h-3 text-accent flex-shrink-0" />
              <span className="text-[11px] text-accent font-semibold truncate">{sourceLabel}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-warning/10 border border-warning/25">
              <BookOpen className="w-3 h-3 text-warning" />
              <span className="text-[11px] text-warning font-semibold">Chưa chọn nguồn</span>
            </div>
          )}
          {isGenerating && (
            <div className="flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 text-accent animate-spin-fast" />
              <span className="text-[12px] text-text-muted">Đang xử lý...</span>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-5 pt-5 pb-2 flex flex-col"
        role="log"
        aria-live="polite"
        aria-label="Lịch sử cuộc trò chuyện"
      >
        {noSources ? (
          /* ── Empty: no source selected ── */
          <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center">
            <div className="relative flex items-center justify-center">
              <div className="absolute w-24 h-24 rounded-full border-2 border-warning/20 animate-ping" style={{ animationDuration: '2.5s' }} />
              <div className="absolute w-16 h-16 rounded-full border-2 border-warning/30 animate-ping" style={{ animationDuration: '2s' }} />
              <div className="w-14 h-14 rounded-2xl bg-warning/10 border border-warning/30 flex items-center justify-center shadow-lg">
                <BookOpen className="w-7 h-7 text-warning" />
              </div>
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary mb-2">Chọn nguồn tài liệu</h3>
              <p className="text-[13px] text-text-muted max-w-xs leading-relaxed">
                Tích vào{' '}
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-elevated border border-border rounded text-[11px] font-mono">
                  ☑ checkbox
                </span>
                {' '}bên trái để chọn tài liệu bạn muốn hỏi.
                <br /><br />
                Bạn có thể chọn từ <span className="text-accent font-semibold">Kho dùng chung</span> hoặc{' '}
                <span className="text-warning font-semibold">Kho cá nhân</span>.
              </p>
            </div>
            <div className="flex flex-col gap-2 text-left w-full max-w-xs">
              {[
                { step: '1', text: 'Mở mục "Nguồn tài liệu" bên trái' },
                { step: '2', text: 'Tích checkbox vào file hoặc cả folder' },
                { step: '3', text: 'Bắt đầu đặt câu hỏi' },
              ].map(s => (
                <div key={s.step} className="flex items-center gap-3 px-3 py-2 bg-elevated/50 rounded-lg border border-border/50">
                  <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    {s.step}
                  </span>
                  <span className="text-[12px] text-text-secondary">{s.text}</span>
                </div>
              ))}
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 animate-fade-in">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg">
                <img src="/logo.png" alt="AI" className="w-14 h-14 rounded-2xl object-cover" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary mb-1">Bắt đầu cuộc trò chuyện</h3>
                <p className="text-[13px] text-text-muted">
                  Đặt câu hỏi hoặc chọn gợi ý bên dưới
                </p>
              </div>
            </div>
            <div className="w-full max-w-sm bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
              <SampleQuestions onSelect={onSend} checkedDocIds={checkedIds} />
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onCitationClick={onCitationClick}
              onFeedback={onFeedback}
              onReport={onReport}
              onSuggestionClick={onSend}
              onRegenerate={onRegenerate}
              onEditUserMessage={onEditUserMessage}
              isLastAssistant={msg.id === lastCompletedAssistantId}
              showSuggestions={msg.id === lastCompletedAssistantId}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Floating scroll-to-bottom button */}
      {!isAtBottom && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={() => scrollToBottom(true)}
            aria-label="Cuộn xuống tin nhắn mới nhất"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-border shadow-lg text-text-secondary hover:text-text-primary hover:bg-elevated transition-all text-[12px] font-medium animate-fade-in"
          >
            {isGenerating && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />}
            <span>
              {newMsgCount > 0
                ? `${newMsgCount} tin mới`
                : (isGenerating ? 'Đang trả lời' : 'Cuộn xuống')}
            </span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <ChatInput
        onSend={onSend}
        disabled={isGenerating}
        noSources={noSources}
        prefill={editPrefill ?? prefill}
        onPrefillConsumed={() => { setEditPrefill(undefined); onPrefillConsumed?.(); }}
        isGenerating={isGenerating}
        onCancel={onCancel}
        onEditLast={handleEditLast}
        availableDocs={availableDocs}
      />
    </div>
  );
};
