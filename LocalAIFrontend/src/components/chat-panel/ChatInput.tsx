import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Send, Loader2 } from 'lucide-react';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  prefill?: string;
  onPrefillConsumed?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled, prefill, onPrefillConsumed }) => {
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
      <p className="text-[10px] text-text-muted mb-2 flex items-center gap-1">
        💡 Dữ liệu chỉ tra cứu từ tài liệu nội bộ · Không kết nối internet
      </p>

      <div className="flex items-end gap-2 bg-elevated border border-border rounded-xl px-3 py-2 focus-within:border-accent/60 transition-colors">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Đặt câu hỏi về tài liệu nội bộ... (Enter để gửi)"
          disabled={disabled}
          className="flex-1 bg-transparent border-none outline-none text-text-primary text-[13px]
                     resize-none min-h-6 max-h-40 overflow-y-auto leading-relaxed
                     placeholder:text-text-muted py-1 disabled:opacity-50"
        />
        <div className="flex items-center gap-1.5 pb-0.5">
          <button
            onClick={() => setRecording(r => !r)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer border
              ${recording
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
            {disabled
              ? <Loader2 className="w-3.5 h-3.5 animate-spin-fast" />
              : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      <p className="text-center text-[10px] text-text-muted mt-1.5">
        Local AI có thể mắc lỗi · Hãy kiểm tra lại các trích dẫn nguồn
      </p>
    </div>
  );
};
