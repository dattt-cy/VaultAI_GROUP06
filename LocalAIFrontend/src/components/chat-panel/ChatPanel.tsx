import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MessageSquare, Loader2, BookOpen, ChevronDown } from 'lucide-react';
import type { Message, Citation } from '../../hooks/useChatState';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { SampleQuestions } from '../left-panel/SampleQuestions';

interface ChatPanelProps {
  messages: Message[];
  isGenerating: boolean;
  onSend: (t: string) => void;
  onCancel: () => void;
  onCitationClick: (c: Citation) => void;
  onFeedback: (id: string, type: 'like' | 'dislike', comment?: string) => void;
  onReport: (id: string, reportType: string, comment: string) => void;
  prefill?: string;
  onPrefillConsumed?: () => void;
  checkedCount: number;
  checkedIds?: Set<number>;
  selectedDocNames?: string[];
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages, isGenerating, onSend, onCancel, onCitationClick, onFeedback, onReport, prefill, onPrefillConsumed,
  checkedCount, checkedIds, selectedDocNames = [],
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Auto-scroll only when user is already at bottom
  useEffect(() => {
    if (isAtBottom) scrollToBottom();
  }, [messages, isAtBottom, scrollToBottom]);

  // Track whether user is at bottom via IntersectionObserver
  useEffect(() => {
    const sentinel = bottomRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsAtBottom(entry.isIntersecting),
      { root: scrollContainerRef.current, threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const noSources = checkedCount === 0;

  const lastCompletedAssistantId = [...messages].reverse().find(m => m.role === 'assistant' && !m.isStreaming)?.id;

  // Build source label: show up to 2 names + "+N khác"
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
          {/* Source badge */}
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
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-5 pt-5 pb-2 flex flex-col">
        {noSources ? (
          /* ── Empty: no source selected ── */
          <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center">
            {/* Animated rings */}
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
            {/* Step indicators */}
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
          /* ── Empty: sources selected but no messages ── */
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
            {/* Inline smart suggestions */}
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
            onClick={scrollToBottom}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-border shadow-lg text-text-secondary hover:text-text-primary hover:bg-elevated transition-all text-[12px] font-medium animate-fade-in"
          >
            {isGenerating && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />}
            <span>{isGenerating ? 'Tin mới' : 'Cuộn xuống'}</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <ChatInput
        onSend={onSend}
        disabled={isGenerating || noSources}
        noSources={noSources}
        prefill={prefill}
        onPrefillConsumed={onPrefillConsumed}
        isGenerating={isGenerating}
        onCancel={onCancel}
      />
    </div>
  );
};
