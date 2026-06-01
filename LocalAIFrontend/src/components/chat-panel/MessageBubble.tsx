import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Brain, Loader2, Sparkles, Search, BookOpen, Cpu, Copy, Check, Pencil } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Message, Citation } from '../../hooks/useChatState';
import { CitationTag } from './CitationTag';
import { CitationPopup } from './CitationPopup';
import { ChatActions } from './ChatActions';
import { DataTable } from './DataTable';

interface MessageBubbleProps {
  message: Message;
  onCitationClick: (c: Citation, sourceLine?: string) => void;
  onFeedback: (id: string, type: 'like' | 'dislike', comment?: string) => void;
  onReport: (id: string, reportType: string, comment: string) => void;
  onSuggestionClick?: (s: string) => void;
  onRegenerate?: () => void;
  onEditUserMessage?: (id: string, newText: string) => void;
  isLastAssistant?: boolean;
  showSuggestions?: boolean;
  suggestionsDisabled?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message, onCitationClick, onFeedback, onReport, onSuggestionClick,
  onRegenerate, onEditUserMessage, isLastAssistant, showSuggestions, suggestionsDisabled,
}) => {
  const isUser = message.role === 'user';

  // === Hooks declared unconditionally at top to satisfy Rules of Hooks ===
  const [popupState, setPopupState] = useState<{ citation: Citation; rect: DOMRect; sourceLine?: string } | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const [copiedUser, setCopiedUser] = useState(false);
  const reasoningScrollRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const steps = message.thinkingSteps ?? [];
  const hasReasoning = !!(message.reasoningContent && message.reasoningContent.length > 0);
  const showPanel = message.isStreaming || steps.length > 0 || hasReasoning || message.isReasoning;

  // Auto-open panel khi bắt đầu suy luận
  useEffect(() => {
    if (steps.length > 0 || message.isReasoning) setPanelOpen(true);
  }, [steps.length, message.isReasoning]);

  // Ẩn panel khi token đầu tiên xuất hiện
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

  // Resize editor + focus khi vào edit mode
  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus();
      editRef.current.style.height = 'auto';
      editRef.current.style.height = Math.min(editRef.current.scrollHeight, 240) + 'px';
    }
  }, [isEditing, editValue]);

  // Memoize parsing/regex — tránh chạy lại mỗi token streaming
  const { processedContent, activeCitations, indexMap } = useMemo(() => {
    const usedIndices = new Set<number>();
    if (!isUser && message.content) {
      Array.from(message.content.matchAll(/\[(\d+)\]/g)).forEach(m =>
        usedIndices.add(parseInt(m[1], 10) - 1)
      );
    }
    const usedArr = Array.from(usedIndices).sort((a, b) => a - b);
    const map = new Map<number, number>();
    usedArr.forEach((oldIdx, i) => map.set(oldIdx, i + 1));
    const occ: Record<number, number> = {};
    const processed = (message.content || '').replace(/\[(\d+)\]/g, (_, p1) => {
      const oldIdx = parseInt(p1, 10) - 1;
      const o = occ[oldIdx] ?? 0;
      occ[oldIdx] = o + 1;
      const newIdx = map.get(oldIdx) || (oldIdx + 1);
      return `[${newIdx}](#cite-${oldIdx}-${o})`;
    });
    const active = (message.citations || []).filter((_, i) => usedIndices.has(i));
    return { processedContent: processed, activeCitations: active, indexMap: map };
  }, [message.content, message.citations, isUser]);

  const stripEmoji = (text: string) => text.replace(/^[\p{Emoji}\s✓✔⚡📄🔍🧠💬📝⚠️]+/u, '').trim();

  const getStepIcon = (text: string) => {
    if (/tìm kiếm|search/i.test(text)) return Search;
    if (/tài liệu|đoạn|đọc|phân tích ngữ cảnh/i.test(text)) return BookOpen;
    if (/tổng hợp|suy luận|suy nghĩ/i.test(text)) return Brain;
    return Cpu;
  };

  const handleCopyUser = async () => {
    if (!message.content) return;
    await navigator.clipboard.writeText(message.content);
    setCopiedUser(true);
    setTimeout(() => setCopiedUser(false), 1500);
  };

  const submitEdit = () => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === message.content) {
      setIsEditing(false);
      setEditValue(message.content);
      return;
    }
    setIsEditing(false);
    onEditUserMessage?.(message.id, trimmed);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditValue(message.content);
  };

  // === User message ===
  if (isUser) {
    if (isEditing) {
      return (
        <div className="flex justify-end mb-4 animate-fade-in">
          <div className="w-full max-w-[72%] bg-elevated border border-accent/40 rounded-2xl rounded-br-sm shadow-sm overflow-hidden">
            <textarea
              ref={editRef}
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submitEdit(); }
                if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
              }}
              className="w-full bg-transparent border-none outline-none text-[14px] text-text-primary leading-relaxed resize-none px-4 py-2.5 placeholder:text-text-muted"
              placeholder="Chỉnh sửa câu hỏi..."
            />
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-border/40 bg-surface/40">
              <span className="text-[11px] text-text-muted">Ctrl+Enter để gửi · Esc để huỷ</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={cancelEdit}
                  className="px-2.5 py-1 rounded-md text-[12px] text-text-secondary hover:bg-hover transition-colors cursor-pointer"
                >
                  Huỷ
                </button>
                <button
                  onClick={submitEdit}
                  disabled={!editValue.trim() || editValue.trim() === message.content}
                  className="px-3 py-1 rounded-md text-[12px] bg-accent text-white hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Gửi lại
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="group flex justify-end mb-4 animate-fade-in">
        <div className="flex items-end gap-1.5 max-w-[80%]">
          {/* Hover actions */}
          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pb-1">
            {onEditUserMessage && (
              <button
                onClick={() => { setEditValue(message.content); setIsEditing(true); }}
                title="Chỉnh sửa & gửi lại"
                aria-label="Chỉnh sửa tin nhắn"
                className="w-7 h-7 rounded-md flex items-center justify-center text-text-muted hover:text-accent hover:bg-elevated transition-colors cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={handleCopyUser}
              title="Sao chép"
              aria-label="Sao chép tin nhắn"
              className="w-7 h-7 rounded-md flex items-center justify-center text-text-muted hover:text-accent hover:bg-elevated transition-colors cursor-pointer"
            >
              {copiedUser ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <div className="px-4 py-2.5 rounded-2xl rounded-br-sm bg-accent text-white text-[14px] leading-relaxed shadow-sm whitespace-pre-wrap">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  // === Cancelled assistant ===
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

  // === Assistant message ===
  return (
    <>
    <div className="flex gap-2.5 mb-5 animate-fade-in">
      <img src="/logo.png" alt="AI" className="w-8 h-8 rounded-lg object-cover flex-shrink-0 mt-0.5 shadow-sm" />

      <div className="flex-1 min-w-0">
        {/* Meta */}
        <div className="text-[14px] text-text-muted mb-1.5">
          Trợ lý AI · {message.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
        </div>

        {/* Thinking panel */}
        {showPanel && (
          <div className="mb-3">
            <button
              onClick={() => setPanelOpen(o => !o)}
              disabled={message.isStreaming && message.content !== ''}
              aria-expanded={panelOpen}
              aria-label="Xem chi tiết các bước suy luận"
              className="group w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border border-border/60 bg-elevated hover:bg-hover hover:border-border transition-all duration-200 disabled:cursor-not-allowed disabled:hover:bg-elevated disabled:hover:border-border/60"
            >
              <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                {message.isStreaming ? (
                  <Loader2 className="w-4 h-4 text-accent animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 text-accent/70" />
                )}
              </div>

              <span className="text-[13px] font-medium text-text-secondary flex-1 text-left truncate">
                {message.isStreaming
                  ? (message.isReasoning
                      ? 'Đang suy luận...'
                      : (steps.length > 0 ? stripEmoji(steps[steps.length - 1]) : 'Đang xử lý...'))
                  : (hasReasoning
                      ? `Đã suy luận · ${message.reasoningTime ?? 0}s`
                      : `Đã xử lý · ${steps.length} bước`)}
              </span>

              {!message.isStreaming && steps.length > 0 && (
                <span className="flex-shrink-0 text-[11px] text-text-muted bg-border/40 px-1.5 py-0.5 rounded-full">
                  {steps.length}
                </span>
              )}

              <ChevronDown
                className={`w-3.5 h-3.5 text-text-muted flex-shrink-0 transition-transform duration-300 group-hover:text-text-secondary ${panelOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {panelOpen && (steps.length > 0 || message.isReasoning || hasReasoning) && (
              <div className="mt-1.5 rounded-2xl border border-border/60 bg-elevated overflow-hidden">
                {steps.length > 0 && (
                  <div className="px-3.5 py-3 space-y-2.5">
                    {steps.map((step, i) => {
                      const isLast = i === steps.length - 1;
                      const isActive = message.isStreaming && isLast;
                      const StepIcon = getStepIcon(step);
                      const label = stripEmoji(step);
                      return (
                        <div key={i} className="flex items-center gap-2.5">
                          <div className="flex-shrink-0">
                            {isActive
                              ? <Loader2 className="w-3 h-3 text-accent animate-spin" />
                              : <StepIcon className="w-3 h-3 text-text-muted/50" />
                            }
                          </div>
                          <span className={`text-[12px] leading-relaxed transition-colors duration-200 ${isActive ? 'text-text-secondary' : 'text-text-muted'}`}>
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {(message.isReasoning || hasReasoning) && (
                  <>
                    {steps.length > 0 && <div className="mx-3.5 border-t border-border/40" />}
                    <div className="px-3.5 py-3">
                      {message.isReasoning && !hasReasoning ? (
                        <div className="flex items-center gap-2.5 text-[12px] text-accent/70 italic">
                          <Brain className="w-3.5 h-3.5 flex-shrink-0 animate-pulse" />
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
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bubble */}
        {(message.content || !message.isStreaming || !showPanel) && <div className="card-ai">
          <div
            className="text-[14px] leading-relaxed text-text-primary"
            aria-live={message.isStreaming ? 'polite' : undefined}
          >
            {message.isStreaming && message.content === '' ? (
              !showPanel ? (
                <div className="flex items-center gap-1.5 h-5 px-1 py-1 opacity-70" aria-label="Đang xử lý">
                  <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              ) : null
            ) : (
              <div className="[&>p]:mb-3 last:[&>p]:mb-0 [&>ul]:list-disc [&>ul]:ml-5 [&>ul]:mb-3 [&>ul]:space-y-1 [&>ol]:list-decimal [&>ol]:ml-5 [&>ol]:mb-3 [&>ol]:space-y-1 [&_ul_ul]:mt-1 [&_ul_ul]:ml-4 [&_ul_ul]:space-y-0.5 [&_ul_ul]:mb-0 [&_ul_ul]:list-none [&_ol_ol]:mt-1 [&_ol_ol]:ml-4 [&_ol_ol]:space-y-0.5 [&_ol_ol]:mb-0 [&_li]:leading-relaxed [&_strong]:font-semibold [&_strong]:text-text-primary [&_em]:italic [&_em]:text-text-secondary [&>h2]:text-[15px] [&>h2]:font-semibold [&>h2]:text-text-primary [&>h2]:mt-3 [&>h2]:mb-1.5 [&>h3]:text-[14px] [&>h3]:font-semibold [&>h3]:text-text-secondary [&>h3]:mt-2 [&>h3]:mb-1 [&>hr]:border-border [&>hr]:my-3 [&_code]:bg-elevated [&_code]:font-mono [&_code]:text-[13px] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:border [&_code]:border-border [&>blockquote]:border-l-2 [&>blockquote]:border-accent/40 [&>blockquote]:pl-3 [&>blockquote]:text-text-secondary [&>blockquote]:italic [&>blockquote]:mb-2">
                <ReactMarkdown
                  components={{
                    a: ({ node, ...props }) => {
                      if (props.href?.startsWith('#cite-')) {
                        const parts = props.href.replace('#cite-', '').split('-');
                        const oldIdx = parseInt(parts[0], 10);
                        const occ = parts.length > 1 ? parseInt(parts[1], 10) : 0;
                        const citation = message.citations?.[oldIdx];
                        if (citation) {
                          const newIdx = indexMap.get(oldIdx) || (oldIdx + 1);
                          const sourceLine = citation.source_lines?.[occ];
                          return (
                            <CitationTag
                              citation={citation}
                              index={newIdx - 1}
                              sourceLine={sourceLine}
                              onClick={onCitationClick}
                              onShowPopup={(c, rect, sl) => setPopupState({ citation: c, rect, sourceLine: sl })}
                            />
                          );
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
          </div>

          {message.tableData && (
            <DataTable data={message.tableData} />
          )}

          {!message.isStreaming && activeCitations.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-border/50">
              <p className="text-[11px] text-text-muted uppercase tracking-wider mb-2 font-semibold">Theo {activeCitations.length > 1 ? `${activeCitations.length} nguồn` : '1 nguồn'}</p>
              <div className="flex flex-wrap gap-1.5">
                {activeCitations.map((c, i) => {
                  const baseName = c.sourceFile.replace(/\.[a-z]{2,5}$/i, '');
                  const shortName = baseName.length > 28
                    ? baseName.slice(0, 25) + '…'
                    : baseName;
                  return (
                    <button
                      key={c.id}
                      onClick={() => onCitationClick(c)}
                      aria-label={`Nguồn ${i + 1}: ${c.sourceFile}, trang ${c.page}`}
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

          {!message.isStreaming && (
            <ChatActions
              messageId={message.id}
              feedback={message.feedback}
              onFeedback={onFeedback}
              onReport={onReport}
              content={message.content}
              onRegenerate={isLastAssistant ? onRegenerate : undefined}
            />
          )}
        </div>}

        {showSuggestions && !message.isStreaming && message.suggestions && message.suggestions.length > 0 && (
          <div className={`flex flex-col gap-2 mt-3 pl-1 transition-opacity duration-200 ${suggestionsDisabled ? 'opacity-40 pointer-events-none' : ''}`}>
            {message.suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => onSuggestionClick?.(suggestion)}
                disabled={suggestionsDisabled}
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

    {popupState && (
      <CitationPopup
        citation={popupState.citation}
        anchorRect={popupState.rect}
        sourceLine={popupState.sourceLine}
        onNavigate={onCitationClick}
        onClose={() => setPopupState(null)}
      />
    )}
    </>
  );
};
