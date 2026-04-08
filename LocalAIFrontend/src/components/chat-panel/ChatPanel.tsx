import React, { useRef, useEffect } from 'react';
import { MessageSquare, Loader2, Bot } from 'lucide-react';
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
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages, isGenerating, onSend, onCitationClick, onFeedback, prefill, onPrefillConsumed,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-base">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-accent" />
          <span className="text-[13px] font-semibold text-text-primary">Cuộc trò chuyện</span>
          <span className="badge bg-elevated text-text-muted border border-border">{messages.length} tin</span>
        </div>
        {isGenerating && (
          <div className="flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 text-accent animate-spin-fast" />
            <span className="text-[11px] text-text-muted">Đang xử lý...</span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-2 flex flex-col">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-accent flex items-center justify-center shadow-lg">
              <Bot className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary mb-1.5">Bắt đầu cuộc trò chuyện</h3>
              <p className="text-[13px] text-text-muted max-w-xs leading-relaxed">
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
              isGenerating={isGenerating}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <ChatInput onSend={onSend} disabled={isGenerating} prefill={prefill} onPrefillConsumed={onPrefillConsumed} />
    </div>
  );
};
