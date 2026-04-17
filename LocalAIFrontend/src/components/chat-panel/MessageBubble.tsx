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

  // Extract used citations from content: [1], [2]
  const usedIndices = new Set<number>();
  if (!isUser && message.content) {
    const matches = Array.from(message.content.matchAll(/\[(\d+)\]/g));
    matches.forEach(m => usedIndices.add(parseInt(m[1], 10) - 1));
  }

  // Create re-mapping to make citations start from 1 sequentially
  const usedIndicesArray = Array.from(usedIndices).sort((a, b) => a - b);
  const indexMap = new Map<number, number>();
  usedIndicesArray.forEach((oldIdx, i) => indexMap.set(oldIdx, i + 1));

  // Convert [6] to markdown link [1](#cite-5) using the re-map
  const processedContent = message.content.replace(/\[(\d+)\]/g, (match, p1) => {
    const oldIdx = parseInt(p1, 10) - 1;
    const newIdx = indexMap.get(oldIdx) || (oldIdx + 1);
    return `[${newIdx}](#cite-${oldIdx})`;
  });

  const activeCitations = (message.citations || []).filter((_, i) => usedIndices.has(i));

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
              <div className="[&>p]:mb-2 last:[&>p]:mb-0 [&>ul]:list-disc [&>ul]:ml-5 [&>ul]:mb-2 [&>ol]:list-decimal [&>ol]:ml-5 [&>ol]:mb-2 [&_strong]:font-bold [&_strong]:text-accent [&_strong]:bg-accent/15 [&_strong]:px-1.5 [&_strong]:py-0.5 [&_strong]:rounded-md [&_em]:italic">
                <ReactMarkdown
                  components={{
                    a: ({ node, ...props }) => {
                      if (props.href?.startsWith('#cite-')) {
                        const oldIdx = parseInt(props.href.replace('#cite-', ''), 10);
                        const citation = message.citations?.[oldIdx];
                        if (citation) {
                          const newIdx = indexMap.get(oldIdx) || (oldIdx + 1);
                          return <CitationTag citation={citation} index={newIdx - 1} onClick={onCitationClick} />;
                        }
                      }
                      return <a {...props} className="text-accent underline hover:text-accent/80" />;
                    }
                  }}
                >
                  {processedContent}
                </ReactMarkdown>
              </div>
            )}
            {/* Streaming cursor */}
            {message.isStreaming && message.content !== '' && (
              <span className="inline-block w-0.5 h-3.5 bg-accent ml-0.5 align-middle animate-blink" />
            )}
          </div>

          {/* ★ NotebookLM-style Source Footer ★ */}
          {!message.isStreaming && activeCitations.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-border/50">
              <p className="text-[11px] text-text-muted uppercase tracking-wider mb-2 font-semibold">Theo {activeCitations.length > 1 ? `${activeCitations.length} nguồn` : '1 nguồn'}</p>
              <div className="flex flex-wrap gap-1.5">
                {activeCitations.map((c, i) => {
                  // Tên file rút gọn
                  const shortName = c.sourceFile.length > 28 
                    ? c.sourceFile.slice(0, 25) + '…' 
                    : c.sourceFile;
                  return (
                    <button
                      key={c.id}
                      onClick={() => onCitationClick(c)}
                      className="inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full bg-accent/8 border border-accent/20 
                                 hover:bg-accent/20 hover:border-accent/40 transition-all duration-200 cursor-pointer group"
                      title={`${c.sourceFile} – Trang ${c.page}`}
                    >
                      <span className="w-4 h-4 rounded-full bg-accent/15 text-accent text-[9px] font-bold flex items-center justify-center flex-shrink-0 group-hover:bg-accent group-hover:text-white transition-colors">
                        {i + 1}
                      </span>
                      <span className="text-[11px] text-text-secondary group-hover:text-accent transition-colors truncate max-w-[180px]">
                        {shortName}
                      </span>
                      <span className="text-[10px] text-text-muted/60 group-hover:text-accent/70 transition-colors flex-shrink-0">
                        tr.{c.page}
                      </span>
                    </button>
                  );
                })}
              </div>
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
