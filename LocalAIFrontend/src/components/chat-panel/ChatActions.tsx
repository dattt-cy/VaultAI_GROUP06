import React, { useState, useRef, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, AlertCircle, Copy, Check, RefreshCw } from 'lucide-react';
import { ReportDialog } from './ReportDialog';

const DISLIKE_REASONS = ['Câu trả lời không đúng', 'Không liên quan', 'Quá dài / ngắn', 'Khác'];

interface ChatActionsProps {
  messageId: string;
  feedback: 'like' | 'dislike' | 'report' | null | undefined;
  onFeedback: (id: string, type: 'like' | 'dislike', comment?: string) => void;
  onReport: (id: string, reportType: string, comment: string) => void;
  content?: string;
  onRegenerate?: () => void;
}

export const ChatActions: React.FC<ChatActionsProps> = ({ messageId, feedback, onFeedback, onReport, content, onRegenerate }) => {
  const [showDislikePopover, setShowDislikePopover] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [dislikeReason, setDislikeReason] = useState('');
  const [dislikeComment, setDislikeComment] = useState('');
  const [copied, setCopied] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showDislikePopover) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        // click outside → submit dislike without comment, close popover
        if (feedback !== 'dislike') onFeedback(messageId, 'dislike');
        setShowDislikePopover(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDislikePopover, feedback, messageId, onFeedback]);

  const handleDislikeClick = () => {
    if (feedback === 'dislike') {
      onFeedback(messageId, 'dislike'); // toggle off
      return;
    }
    setDislikeReason('');
    setDislikeComment('');
    setShowDislikePopover(true);
  };

  const submitDislike = () => {
    const comment = [dislikeReason, dislikeComment].filter(Boolean).join(' — ');
    onFeedback(messageId, 'dislike', comment || undefined);
    setShowDislikePopover(false);
  };

  const handleCopy = async () => {
    if (!content) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border/50">
        {/* Like */}
        <button
          onClick={() => onFeedback(messageId, 'like')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] transition-all duration-150 cursor-pointer border
            ${feedback === 'like'
              ? 'bg-success/15 border-success/40 text-success'
              : 'bg-transparent border-transparent text-text-muted hover:bg-elevated hover:text-text-secondary'}`}
        >
          <ThumbsUp className={`w-3.5 h-3.5 ${feedback === 'like' ? 'fill-success' : ''}`} />
          Hữu ích
        </button>

        {/* Dislike + popover */}
        <div className="relative" ref={popoverRef}>
          <button
            onClick={handleDislikeClick}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] transition-all duration-150 cursor-pointer border
              ${feedback === 'dislike'
                ? 'bg-danger/15 border-danger/40 text-danger'
                : 'bg-transparent border-transparent text-text-muted hover:bg-elevated hover:text-text-secondary'}`}
          >
            <ThumbsDown className={`w-3.5 h-3.5 ${feedback === 'dislike' ? 'fill-danger' : ''}`} />
            Chưa tốt
          </button>

          {showDislikePopover && (
            <div
              role="dialog"
              aria-label="Phản hồi chưa tốt"
              className="absolute left-0 bottom-full mb-2 z-40 bg-surface border border-border rounded-xl shadow-xl p-3 w-[260px] animate-fade-in"
            >
              <p className="text-[11px] font-semibold text-text-secondary mb-2">Vì sao chưa tốt?</p>
              <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                {DISLIKE_REASONS.map(r => (
                  <button
                    key={r}
                    onClick={() => setDislikeReason(r === dislikeReason ? '' : r)}
                    className={`px-2 py-1.5 rounded-md text-[11px] border transition-colors cursor-pointer text-center
                      ${dislikeReason === r
                        ? 'bg-accent/15 border-accent/40 text-accent font-medium'
                        : 'bg-elevated border-border text-text-secondary hover:bg-hover hover:border-border/80'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={dislikeComment}
                onChange={e => setDislikeComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitDislike()}
                placeholder="Mô tả thêm (tuỳ chọn)"
                aria-label="Mô tả thêm về phản hồi"
                className="w-full bg-elevated border border-border rounded-lg px-2.5 py-1.5 text-[12px] text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors mb-2.5"
              />
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowDislikePopover(false)}
                  className="flex-1 py-1.5 rounded-lg text-[12px] font-medium border border-border text-text-secondary hover:bg-hover transition-colors cursor-pointer"
                >
                  Huỷ
                </button>
                <button
                  onClick={submitDislike}
                  className="flex-1 py-1.5 rounded-lg text-[12px] font-medium bg-accent text-white hover:bg-accent-hover transition-colors cursor-pointer"
                >
                  Gửi
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Copy */}
        <button
          onClick={handleCopy}
          disabled={!content}
          aria-label="Sao chép câu trả lời"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] transition-all duration-150 cursor-pointer border border-transparent text-text-muted hover:bg-elevated hover:text-text-secondary disabled:opacity-40"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Đã sao chép' : 'Sao chép'}
        </button>

        {/* Regenerate — only on last assistant */}
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            aria-label="Tạo lại câu trả lời"
            title="Tạo lại câu trả lời"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] transition-all duration-150 cursor-pointer border border-transparent text-text-muted hover:bg-elevated hover:text-text-secondary"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Tạo lại
          </button>
        )}

        <div className="w-px h-4 bg-border mx-1" />

        {/* Report */}
        <button
          onClick={() => { if (feedback !== 'report') setShowReportModal(true); }}
          disabled={feedback === 'report'}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] transition-all duration-150 cursor-pointer border
            ${feedback === 'report'
              ? 'bg-warning/15 border-warning/40 text-warning cursor-default'
              : 'bg-transparent border-transparent text-text-muted hover:bg-elevated hover:text-text-secondary'}`}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          {feedback === 'report' ? 'Đã báo' : 'Báo lỗi'}
        </button>
      </div>

      {showReportModal && (
        <ReportDialog
          onConfirm={(type, comment) => onReport(messageId, type, comment)}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </>
  );
};
