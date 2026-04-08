import React from 'react';
import { FileText, ExternalLink, Bot } from 'lucide-react';
import type { Message, Citation } from '../../hooks/useChatState';
import { CitationTag } from './CitationTag';
import { ChatActions } from './ChatActions';
import { ExportButtons } from './ExportButtons';

interface MessageBubbleProps {
  message: Message;
  onCitationClick: (c: Citation) => void;
  onFeedback: (id: string, type: 'like' | 'dislike') => void;
  isGenerating: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message, onCitationClick, onFeedback, isGenerating,
}) => {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end mb-4 animate-fade-in">
        <div className="max-w-[72%] px-4 py-2.5 rounded-2xl rounded-br-sm bg-accent text-white text-[13px] leading-relaxed shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5 mb-5 animate-fade-in">
      {/* AI avatar */}
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-accent flex items-center justify-center flex-shrink-0 mt-0.5">
        <Bot className="w-4 h-4 text-white" />
      </div>

      <div className="flex-1 min-w-0">
        {/* Meta */}
        <div className="text-[10px] text-text-muted mb-1.5">
          Trợ lý AI · {message.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
        </div>

        {/* Bubble */}
        <div className="card-ai">
          {/* Text + inline citations */}
          <div className="text-[13px] leading-relaxed text-text-primary">
            <span dangerouslySetInnerHTML={{ __html: message.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            {message.citations && message.citations.length > 0 && (
              <span className="ml-1">
                {message.citations.map((c, i) => (
                  <CitationTag key={c.id} citation={c} index={i} onClick={onCitationClick} />
                ))}
              </span>
            )}
            {/* Streaming cursor */}
            {message.isStreaming && (
              <span className="inline-block w-0.5 h-3.5 bg-accent ml-0.5 align-middle animate-blink" />
            )}
          </div>

          {/* Source list */}
          {!message.isStreaming && message.citations && message.citations.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <p className="text-[10px] text-text-muted font-semibold uppercase tracking-wider mb-2">Trích dẫn nguồn</p>
              {message.citations.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => onCitationClick(c)}
                  className="flex items-start gap-2 w-full p-2 rounded-lg mb-1.5 text-left
                             bg-surface border border-border hover:border-accent/40 hover:bg-accent/5
                             transition-all duration-150 group cursor-pointer"
                >
                  <span className="w-5 h-5 rounded-md bg-accent/15 text-accent text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold text-citation truncate">{c.sourceFile} · Trang {c.page}</div>
                    <div className="text-[11px] text-text-muted truncate">{c.excerpt}</div>
                  </div>
                  <ExternalLink className="w-3 h-3 text-text-muted flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          )}

          {/* Actions */}
          {!message.isStreaming && (
            <>
              <ChatActions messageId={message.id} feedback={message.feedback} onFeedback={onFeedback} />
              <ExportButtons disabled={isGenerating} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};
