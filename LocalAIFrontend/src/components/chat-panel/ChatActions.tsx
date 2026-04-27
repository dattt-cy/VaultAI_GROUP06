import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, AlertCircle, Copy, Check } from 'lucide-react';

interface ChatActionsProps {
  messageId: string;
  feedback: 'like' | 'dislike' | null | undefined;
  onFeedback: (id: string, type: 'like' | 'dislike') => void;
  content?: string;
}

export const ChatActions: React.FC<ChatActionsProps> = ({ messageId, feedback, onFeedback, content }) => {
  const [reported, setReported] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!content) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border/50">
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

      <button
        onClick={() => onFeedback(messageId, 'dislike')}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] transition-all duration-150 cursor-pointer border
          ${feedback === 'dislike'
            ? 'bg-danger/15 border-danger/40 text-danger'
            : 'bg-transparent border-transparent text-text-muted hover:bg-elevated hover:text-text-secondary'}`}
      >
        <ThumbsDown className={`w-3.5 h-3.5 ${feedback === 'dislike' ? 'fill-danger' : ''}`} />
        Chưa tốt
      </button>

      <div className="w-px h-4 bg-border mx-1" />

      <button
        onClick={handleCopy}
        disabled={!content}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] transition-all duration-150 cursor-pointer border border-transparent text-text-muted hover:bg-elevated hover:text-text-secondary disabled:opacity-40"
        title="Sao chép nội dung"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? 'Đã sao chép' : 'Sao chép'}
      </button>

      <div className="w-px h-4 bg-border mx-1" />

      <button
        onClick={() => setReported(true)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] transition-all duration-150 cursor-pointer border
          ${reported
            ? 'bg-warning/15 border-warning/40 text-warning'
            : 'bg-transparent border-transparent text-text-muted hover:bg-elevated hover:text-text-secondary'}`}
      >
        <AlertCircle className="w-3.5 h-3.5" />
        {reported ? 'Đã báo lỗi' : 'Báo lỗi'}
      </button>
    </div>
  );
};
