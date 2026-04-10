import React, { useRef, useEffect } from 'react';
import { MessageSquare, Loader2, BookOpen } from 'lucide-react';
import type { Message, Citation } from '../../hooks/useChatState';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';

interface ChatPanelProps {
  messages: Message[];
  isGenerating: boolean;
  onSend: (t: string) => void;
  onCitationClick: (c: Citation) => void;
  onFeedback: (id: string, type: 'like' | 'dislike') => void;
  prefill?: string;
  onPrefillConsumed?: () => void;
  checkedCount: number;
  totalCount: number;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages, isGenerating, onSend, onCitationClick, onFeedback, prefill, onPrefillConsumed,
  checkedCount, totalCount,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const noSources = checkedCount === 0;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-base">
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
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-accent/10 border border-accent/20">
              <BookOpen className="w-3 h-3 text-accent" />
              <span className="text-[11px] text-accent font-semibold">{checkedCount} / {totalCount} nguồn</span>
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
      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-2 flex flex-col">
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
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg">
              <img src="/logo.png" alt="AI" className="w-14 h-14 rounded-2xl object-cover" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary mb-1.5">Bắt đầu cuộc trò chuyện</h3>
              <p className="text-[14px] text-text-muted max-w-xs leading-relaxed">
                Đặt câu hỏi về tài liệu nội bộ.<br />
                Mọi câu trả lời đều có trích dẫn nguồn cụ thể.
              </p>
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onCitationClick={onCitationClick}
              onFeedback={onFeedback}
              onSuggestionClick={onSend}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <ChatInput
        onSend={onSend}
        disabled={isGenerating || noSources}
        noSources={noSources}
        prefill={prefill}
        onPrefillConsumed={onPrefillConsumed}
      />
    </div>
  );
};
