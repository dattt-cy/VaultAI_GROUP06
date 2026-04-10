import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Send, Loader2, BookOpen } from 'lucide-react';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  noSources?: boolean;
  prefill?: string;
  onPrefillConsumed?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled, noSources, prefill, onPrefillConsumed }) => {
  const [value, setValue] = useState('');
  const [recording, setRecording] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (prefill) { setValue(prefill); ref.current?.focus(); onPrefillConsumed?.(); }
  }, [prefill]);

  useEffect(() => {
    if (ref.current) { ref.current.style.height = 'auto'; ref.current.style.height = Math.min(ref.current.scrollHeight, 160) + 'px'; }
  }, [value]);

  const send = () => { const t = value.trim(); if (!t || disabled) return; onSend(t); setValue(''); };

  return (
    <div className="px-4 pb-4 pt-3 border-t border-border bg-surface flex-shrink-0">

      {/* ── No-source warning banner ── */}
      {noSources && (
        <div className="flex items-center gap-2 mb-2.5 px-3 py-2 rounded-lg bg-warning/8 border border-warning/25 animate-fade-in">
          <BookOpen className="w-3.5 h-3.5 text-warning flex-shrink-0" />
          <p className="text-[12px] text-warning font-medium">
            Hãy tích chọn ít nhất 1 tài liệu ở bên trái để bắt đầu chat
          </p>
        </div>
      )}

      {/* ── Input area ── */}
      <div
        className={`flex items-end gap-2 bg-elevated border rounded-xl px-3 py-2 transition-all duration-200
          ${noSources
            ? 'border-border opacity-50 cursor-not-allowed'
            : 'border-border focus-within:border-accent/60 focus-within:shadow-sm focus-within:shadow-accent/5'}`}
      >
        <textarea
          ref={ref}
          rows={1}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={noSources
            ? 'Chọn nguồn tài liệu trước khi đặt câu hỏi...'
            : 'Đặt câu hỏi về tài liệu nội bộ... (Enter để gửi)'}
          disabled={disabled}
          className="flex-1 bg-transparent border-none outline-none text-text-primary text-[14px]
                     resize-none min-h-6 max-h-40 overflow-y-auto leading-relaxed
                     placeholder:text-text-muted py-1 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <div className="flex items-center gap-1.5 pb-0.5">
          <button
            onClick={() => setRecording(r => !r)}
            disabled={noSources}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer border
              ${noSources
                ? 'opacity-40 cursor-not-allowed border-transparent text-text-muted'
                : recording
                  ? 'bg-danger/15 border-danger/40 text-danger animate-pulse'
                  : 'bg-transparent border-transparent text-text-muted hover:bg-elevated hover:text-text-secondary'}`}
          >
            {recording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={send}
            disabled={!value.trim() || disabled}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 border-none 
              ${value.trim() && !disabled
                ? 'bg-accent text-white hover:bg-accent-hover cursor-pointer shadow-sm'
                : 'bg-hover text-text-muted cursor-not-allowed opacity-60'}`}
          >
            {disabled && !noSources
              ? <Loader2 className="w-3.5 h-3.5 animate-spin-fast" />
              : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <p className="text-center text-[12px] text-text-muted mt-1.5">
        Local AI có thể mắc lỗi · Hãy kiểm tra lại các trích dẫn nguồn
      </p>
    </div>
  );
};
