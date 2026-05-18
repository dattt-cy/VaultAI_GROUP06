import React, { useState, useRef, useEffect } from 'react';
import { Send, Square, BookOpen } from 'lucide-react';

const CHAR_WARN_THRESHOLD = 200;
const CHAR_MAX = 2000;

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  noSources?: boolean;
  prefill?: string;
  onPrefillConsumed?: () => void;
  isGenerating?: boolean;
  onCancel?: () => void;
  onEditLast?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend, disabled, noSources, prefill, onPrefillConsumed, isGenerating, onCancel, onEditLast,
}) => {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (prefill !== undefined && prefill !== '') {
      setValue(prefill);
      ref.current?.focus();
      onPrefillConsumed?.();
    }
  }, [prefill, onPrefillConsumed]);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = Math.min(ref.current.scrollHeight, 160) + 'px';
    }
  }, [value]);

  // Global shortcuts: Ctrl+/ focus, Esc cancel while generating
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        ref.current?.focus();
        return;
      }
      if (e.key === 'Escape' && isGenerating) {
        e.preventDefault();
        onCancel?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isGenerating, onCancel]);

  const charCount = value.length;
  const overLimit = charCount > CHAR_MAX;
  const showCounter = charCount > CHAR_WARN_THRESHOLD;

  const send = () => {
    const t = value.trim();
    if (!t || disabled || overLimit) return;
    onSend(t);
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
      return;
    }
    // ↑ on empty input → edit last user message
    if (e.key === 'ArrowUp' && value === '' && onEditLast && !disabled) {
      e.preventDefault();
      onEditLast();
    }
  };

  return (
    <div className="px-4 pb-4 pt-3 border-t border-border bg-surface flex-shrink-0">
      {noSources && (
        <div className="flex items-center gap-2 mb-2.5 px-3 py-2 rounded-lg bg-warning/8 border border-warning/25 animate-fade-in">
          <BookOpen className="w-3.5 h-3.5 text-warning flex-shrink-0" />
          <p className="text-[12px] text-warning font-medium">
            Hãy tích chọn ít nhất 1 tài liệu ở bên trái để bắt đầu chat
          </p>
        </div>
      )}

      <div
        className={`flex items-end gap-2 bg-elevated border rounded-xl px-3 py-2 transition-all duration-200
          ${noSources
            ? 'border-border opacity-50 cursor-not-allowed'
            : overLimit
              ? 'border-danger/60 shadow-sm shadow-danger/10'
              : 'border-border focus-within:border-accent/60 focus-within:shadow-sm focus-within:shadow-accent/5'}`}
      >
        <div className="flex-1 relative">
          <textarea
            ref={ref}
            rows={1}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={noSources
              ? 'Chọn nguồn tài liệu trước khi đặt câu hỏi...'
              : 'Đặt câu hỏi... (Enter gửi · Shift+Enter xuống dòng · ↑ sửa câu trước · Ctrl+/ focus · Esc dừng)'}
            disabled={disabled}
            aria-label="Soạn câu hỏi"
            aria-invalid={overLimit || undefined}
            className="w-full bg-transparent border-none outline-none text-text-primary text-[14px]
                       resize-none min-h-6 max-h-40 overflow-y-auto leading-relaxed
                       placeholder:text-text-muted py-1 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {showCounter && (
            <span
              className={`absolute bottom-0 right-0 text-[10px] font-mono tabular-nums ${overLimit ? 'text-danger font-semibold' : 'text-text-muted'}`}
              aria-live="polite"
            >
              {charCount.toLocaleString('vi-VN')}/{CHAR_MAX.toLocaleString('vi-VN')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 pb-0.5">
          {isGenerating ? (
            <button
              onClick={onCancel}
              title="Dừng sinh câu trả lời (Esc)"
              aria-label="Dừng sinh câu trả lời"
              className="w-8 h-8 rounded-lg flex items-center justify-center border border-red-300 text-red-500 hover:bg-red-50 transition-all duration-150 cursor-pointer"
            >
              <Square className="w-3 h-3 fill-current" />
            </button>
          ) : (
            <button
              onClick={send}
              disabled={!value.trim() || disabled || overLimit}
              aria-label="Gửi câu hỏi"
              title={overLimit ? `Vượt quá ${CHAR_MAX.toLocaleString('vi-VN')} ký tự` : 'Gửi (Enter)'}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 border-none
                ${value.trim() && !disabled && !overLimit
                  ? 'bg-accent text-white hover:bg-accent-hover cursor-pointer shadow-sm'
                  : 'bg-hover text-text-muted cursor-not-allowed opacity-60'}`}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <p className="text-center text-[12px] text-text-muted mt-1.5">
        Local AI có thể mắc lỗi · Hãy kiểm tra lại các trích dẫn nguồn
      </p>
    </div>
  );
};
