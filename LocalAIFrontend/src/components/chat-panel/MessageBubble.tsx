import React from 'react';
import { ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Message, Citation } from '../../hooks/useChatState';
import { CitationTag } from './CitationTag';
import { ChatActions } from './ChatActions';

interface MessageBubbleProps {
  message: Message;
  onCitationClick: (c: Citation) => void;
  onFeedback: (id: string, type: 'like' | 'dislike') => void;
  onSuggestionClick?: (s: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message, onCitationClick, onFeedback, onSuggestionClick,
}) => {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end mb-4 animate-fade-in">
        <div className="max-w-[72%] px-4 py-2.5 rounded-2xl rounded-br-sm bg-accent text-white text-[14px] leading-relaxed shadow-sm whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5 mb-5 animate-fade-in">
      <img src="/logo.png" alt="AI" className="w-8 h-8 rounded-lg object-cover flex-shrink-0 mt-0.5 shadow-sm" />

      <div className="flex-1 min-w-0">
        {/* Meta */}
        <div className="text-[14px] text-text-muted mb-1.5">
          Trợ lý AI · {message.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
        </div>

        {/* Bubble */}
        <div className="card-ai">
          {/* Text + inline citations */}
          <div className="text-[14px] leading-relaxed text-text-primary">
            {message.isStreaming && message.content === '' ? (
              <div className="flex items-center gap-1.5 h-5 px-1 py-1 opacity-70">
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            ) : (
              <div className="[&>p]:mb-2 last:[&>p]:mb-0 [&>ul]:list-disc [&>ul]:ml-5 [&>ul]:mb-2 [&>ol]:list-decimal [&>ol]:ml-5 [&>ol]:mb-2 [&_strong]:font-bold [&_em]:italic">
                <ReactMarkdown>
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
            {message.citations && message.citations.length > 0 && (
              <span className="inline-block mt-1">
                {message.citations.map((c, i) => (
                  <CitationTag key={c.id} citation={c} index={i} onClick={onCitationClick} />
                ))}
              </span>
            )}
            {/* Streaming cursor */}
            {message.isStreaming && message.content !== '' && (
              <span className="inline-block w-0.5 h-3.5 bg-accent ml-0.5 align-middle animate-blink" />
            )}
          </div>

          {/* Source list */}
          {!message.isStreaming && message.citations && message.citations.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <p className="text-[14px] text-text-muted font-semibold uppercase tracking-wider mb-2">Trích dẫn nguồn</p>
              {message.citations.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => onCitationClick(c)}
                  className="flex items-start gap-2 w-full p-2 rounded-lg mb-1.5 text-left
                             bg-surface border border-border hover:border-accent/40 hover:bg-accent/5
                             transition-all duration-150 group cursor-pointer"
                >
                  <span className="w-5 h-5 rounded-md bg-accent/15 text-accent text-[14px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-citation truncate">{c.sourceFile} · Trang {c.page}</div>
                    <div className="text-[12px] text-text-muted truncate">{c.excerpt}</div>
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
            </>
          )}
        </div>

        {/* Contextual Suggestions */}
        {!message.isStreaming && message.suggestions && message.suggestions.length > 0 && (
          <div className="flex flex-col gap-2 mt-3 pl-1">
            {message.suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => onSuggestionClick?.(suggestion)}
                className="text-left w-fit max-w-[90%] px-4 py-2.5 rounded-2xl bg-hover border border-border/50 text-[13px] text-text-primary 
                           hover:bg-accent/10 hover:border-accent/30 hover:text-accent transition-colors duration-200"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
