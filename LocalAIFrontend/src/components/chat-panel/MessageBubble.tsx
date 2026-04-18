import React, { useState, useRef, useEffect } from 'react';
import { ExternalLink, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Message, Citation } from '../../hooks/useChatState';
import { CitationTag } from './CitationTag';
import { ChatActions } from './ChatActions';

interface MessageBubbleProps {
  message: Message;
  onCitationClick: (c: Citation) => void;
  onFeedback: (id: string, type: 'like' | 'dislike') => void;
  onSuggestionClick?: (s: string) => void;
  showSuggestions?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message, onCitationClick, onFeedback, onSuggestionClick, showSuggestions,
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

  // Build per-occurrence sentence map: citation index → ordered list of sentences citing it
  // This enables clicking [1] next to sentence X to highlight exactly sentence X in the document
  const sentencesByCitation = new Map<number, string[]>();
  if (!isUser && message.content) {
    message.content.split(/(?<=[.!?\n])\s+/).forEach(sentence => {
      Array.from(sentence.matchAll(/\[(\d+)\]/g)).forEach(m => {
        const oldIdx = parseInt(m[1], 10) - 1;
        if (!sentencesByCitation.has(oldIdx)) sentencesByCitation.set(oldIdx, []);
        const clean = sentence.replace(/\[\d+\]/g, '').trim();
        if (clean.length > 5) sentencesByCitation.get(oldIdx)!.push(clean);
      });
    });
  }

  // Convert [1] → [1](#cite-0-{occurrence}) — encode which occurrence so each click highlights precisely
  const occurrenceTracker: Record<number, number> = {};
  const processedContent = message.content.replace(/\[(\d+)\]/g, (_, p1) => {
    const oldIdx = parseInt(p1, 10) - 1;
    const occ = occurrenceTracker[oldIdx] ?? 0;
    occurrenceTracker[oldIdx] = occ + 1;
    const newIdx = indexMap.get(oldIdx) || (oldIdx + 1);
    return `[${newIdx}](#cite-${oldIdx}-${occ})`;
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

  if (message.isCancelled) {
    return (
      <div className="flex gap-2.5 mb-4 animate-fade-in">
        <img src="/logo.png" alt="AI" className="w-8 h-8 rounded-lg object-cover flex-shrink-0 mt-0.5 shadow-sm opacity-40" />
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-elevated text-text-muted text-[12px] italic">
          <span className="opacity-60">◼</span>
          <span>Đã dừng sinh câu trả lời. Bạn có thể chỉnh sửa và gửi lại câu hỏi.</span>
        </div>
      </div>
    );
  }

  const [panelOpen, setPanelOpen] = useState(false);
  const reasoningScrollRef = useRef<HTMLDivElement>(null);
  const steps = message.thinkingSteps ?? [];
  const hasReasoning = !!(message.reasoningContent && message.reasoningContent.length > 0);
  const showPanel = message.isStreaming || steps.length > 0 || hasReasoning || message.isReasoning;

  // Tự mở khi bắt đầu suy luận
  useEffect(() => {
    if (steps.length > 0 || message.isReasoning) setPanelOpen(true);
  }, [steps.length, message.isReasoning]);

  // Ẩn panel khi token đầu tiên xuất hiện (đang trả lời, không còn suy luận)
  useEffect(() => {
    if (message.isStreaming && message.content !== '' && !message.isReasoning) {
      setPanelOpen(false);
    }
  }, [message.content, message.isStreaming, message.isReasoning]);

  // Đóng panel khi trả lời xong
  useEffect(() => {
    if (!message.isStreaming) setPanelOpen(false);
  }, [message.isStreaming]);

  // Auto-scroll reasoning xuống cuối
  useEffect(() => {
    if (message.isReasoning && reasoningScrollRef.current) {
      reasoningScrollRef.current.scrollTop = reasoningScrollRef.current.scrollHeight;
    }
  }, [message.reasoningContent, message.isReasoning]);

  return (
    <div className="flex gap-2.5 mb-5 animate-fade-in">
      <img src="/logo.png" alt="AI" className="w-8 h-8 rounded-lg object-cover flex-shrink-0 mt-0.5 shadow-sm" />

      <div className="flex-1 min-w-0">
        {/* Meta */}
        <div className="text-[14px] text-text-muted mb-1.5">
          Trợ lý AI · {message.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
        </div>

        {/* Panel Gemini-style — 1 thanh duy nhất */}
        {showPanel && (
          <div className="mb-2">
            {/* Header bar — luôn hiển thị, click để expand/collapse */}
            <button
              onClick={() => setPanelOpen(o => !o)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border border-border bg-elevated hover:bg-hover transition-colors"
            >
              {/* Gradient spinner như Gemini */}
              <div className="w-4 h-4 flex-shrink-0 relative">
                <div
                  className={`absolute inset-0 rounded-full ${message.isStreaming ? 'animate-spin' : ''}`}
                  style={{ background: 'conic-gradient(from 0deg, #3b82f6 0%, #f59e0b 40%, #10b981 70%, #3b82f6 100%)' }}
                />
                <div className="absolute inset-[2.5px] rounded-full bg-elevated" />
              </div>

              {/* Text trạng thái hiện tại */}
              <span className="text-[13px] text-text-primary flex-1 text-left truncate">
                {message.isStreaming
                  ? (message.isReasoning
                      ? 'Đang suy luận...'
                      : (steps.length > 0 ? steps[steps.length - 1] : 'Đang xử lý...'))
                  : (hasReasoning
                      ? `Đã suy luận · ${message.reasoningTime ?? 0}s`
                      : `Đã xử lý · ${steps.length} bước`)}
              </span>

              <ChevronRight className={`w-4 h-4 text-text-muted flex-shrink-0 transition-transform duration-200 ${panelOpen ? 'rotate-90' : ''}`} />
            </button>

            {/* Nội dung mở rộng — chỉ hiện khi có steps hoặc reasoning */}
            {panelOpen && (steps.length > 0 || message.isReasoning || hasReasoning) && (
              <div className="mt-1 rounded-xl border border-border bg-elevated px-3 py-2.5 space-y-2">
                {/* Pipeline steps */}
                {steps.length > 0 && (
                  <div className="space-y-1">
                    {steps.map((step, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px] text-text-muted">
                        <span className="text-[9px] text-accent/70 flex-shrink-0">✓</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reasoning text stream */}
                {(message.isReasoning || hasReasoning) && (
                  <>
                    {steps.length > 0 && <div className="border-t border-border/40" />}
                    {message.isReasoning && !hasReasoning ? (
                      /* Chờ token đầu tiên từ model */
                      <div className="flex items-center gap-2 text-[11px] text-accent/70 italic">
                        <span className="w-2.5 h-2.5 border border-accent/50 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                        <span>Mô hình đang suy nghĩ...</span>
                      </div>
                    ) : (
                      <div
                        ref={reasoningScrollRef}
                        className="text-[12px] text-text-muted leading-relaxed italic max-h-52 overflow-y-auto whitespace-pre-wrap"
                      >
                        {message.reasoningContent}
                        {message.isReasoning && (
                          <span className="inline-block w-0.5 h-3 bg-accent ml-0.5 align-middle animate-blink" />
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bubble — ẩn khi panel đang chạy và chưa có content */}
        {(message.content || !message.isStreaming || !showPanel) && <div className="card-ai">
          {/* Text + inline citations */}
          <div className="text-[14px] leading-relaxed text-text-primary">
            {message.isStreaming && message.content === '' ? (
              /* Chỉ hiện "..." khi không có panel (edge case) */
              !showPanel ? (
                <div className="flex items-center gap-1.5 h-5 px-1 py-1 opacity-70">
                  <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              ) : null
            ) : (
              <div className="[&>p]:mb-2 last:[&>p]:mb-0 [&>ul]:list-disc [&>ul]:ml-5 [&>ul]:mb-2 [&>ol]:list-decimal [&>ol]:ml-5 [&>ol]:mb-2 [&_strong]:font-bold [&_strong]:text-accent [&_strong]:bg-accent/15 [&_strong]:px-1.5 [&_strong]:py-0.5 [&_strong]:rounded-md [&_em]:italic">
                <ReactMarkdown
                  components={{
                    a: ({ node, ...props }) => {
                      if (props.href?.startsWith('#cite-')) {
                        const parts = props.href.replace('#cite-', '').split('-');
                        const oldIdx = parseInt(parts[0], 10);
                        const occurrence = parseInt(parts[1] ?? '0', 10);
                        const citation = message.citations?.[oldIdx];
                        if (citation) {
                          const newIdx = indexMap.get(oldIdx) || (oldIdx + 1);
                          // Override relevant_spans with the exact sentence the user clicked
                          const sentences = sentencesByCitation.get(oldIdx) || [];
                          const specificSentence = sentences[occurrence];
                          const enrichedCitation: Citation = specificSentence
                            ? { ...citation, relevant_spans: [specificSentence] }
                            : citation;
                          return <CitationTag citation={enrichedCitation} index={newIdx - 1} onClick={onCitationClick} />;
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
        </div>}

        {/* Contextual Suggestions - chỉ hiển thị cho tin nhắn assistant cuối cùng */}
        {showSuggestions && !message.isStreaming && message.suggestions && message.suggestions.length > 0 && (
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
