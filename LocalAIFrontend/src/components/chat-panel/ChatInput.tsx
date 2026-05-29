import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Send, Square, BookOpen, X, FileText, AtSign, Mic, MicOff } from 'lucide-react';

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

const CHAR_WARN_THRESHOLD = 200;
const CHAR_MAX = 2000;

interface DocTag {
  id: number;
  name: string;
}

interface ChatInputProps {
  onSend: (text: string, taggedDocIds?: number[]) => void;
  disabled?: boolean;
  noSources?: boolean;
  prefill?: string;
  onPrefillConsumed?: () => void;
  isGenerating?: boolean;
  onCancel?: () => void;
  onEditLast?: () => void;
  availableDocs?: DocTag[];
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend, disabled, noSources, prefill, onPrefillConsumed,
  isGenerating, onCancel, onEditLast, availableDocs = [],
}) => {
  const [value, setValue] = useState('');
  const [taggedDocs, setTaggedDocs] = useState<DocTag[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionAnchor, setMentionAnchor] = useState(0);
  const [mentionIdx, setMentionIdx] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported] = useState(() =>
    typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  );
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const interimRef = useRef('');
  const ref = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ bottom: number; left: number; width: number } | null>(null);

  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMentionQuery(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // useLayoutEffect để tính vị trí TRƯỚC khi browser paint — không bị flicker
  useLayoutEffect(() => {
    if (mentionQuery !== null && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPos({
        bottom: window.innerHeight - rect.top + 6,
        left: rect.left,
        width: rect.width,
      });
    } else {
      setDropdownPos(null);
    }
  }, [mentionQuery]);

  const mentionFiltered = useMemo(() => {
    if (mentionQuery === null) return [];
    console.log('[ChatInput @-tag] availableDocs:', availableDocs.length, 'query:', mentionQuery);
    if (availableDocs.length === 0) return [];
    const q = mentionQuery.toLowerCase();
    return availableDocs
      .filter(d => !taggedDocs.some(t => t.id === d.id))
      .filter(d => d.name.toLowerCase().includes(q))
      .slice(0, 20);
  }, [mentionQuery, availableDocs, taggedDocs]);

  const hasTaggedDocs = taggedDocs.length > 0;
  const charCount = value.length;
  const overLimit = charCount > CHAR_MAX;
  const showCounter = charCount > CHAR_WARN_THRESHOLD;
  const effectivelyBlocked = noSources && !hasTaggedDocs;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setValue(v);

    const cursor = e.target.selectionStart ?? v.length;
    const textBeforeCursor = v.slice(0, cursor);
    // match @ followed by word chars (including Vietnamese)
    const match = textBeforeCursor.match(/@([\wÀ-ɏḀ-ỿ]*)$/);
    if (match && availableDocs.length > 0) {
      setMentionQuery(match[1]);
      setMentionAnchor(cursor - match[0].length);
      setMentionIdx(0);
    } else {
      setMentionQuery(null);
    }
  };

  const selectMention = (doc: DocTag) => {
    const queryLen = mentionQuery?.length ?? 0;
    const before = value.slice(0, mentionAnchor);
    const after = value.slice(mentionAnchor + 1 + queryLen);
    setValue(before + after);
    setTaggedDocs(prev => [...prev, doc]);
    setMentionQuery(null);
    setMentionIdx(0);
    setTimeout(() => ref.current?.focus(), 0);
  };

  const removeTagged = (id: number) => {
    setTaggedDocs(prev => prev.filter(d => d.id !== id));
  };

  const toggleVoice = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'vi-VN';
    recognition.continuous = true;
    recognition.interimResults = true;
    interimRef.current = '';

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let interim = '';
      let finalChunk = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalChunk += t;
        else interim += t;
      }
      if (finalChunk) {
        setValue(prev => {
          const base = prev.endsWith(' ') || prev === '' ? prev : prev + ' ';
          return base + finalChunk.trim();
        });
        interimRef.current = '';
      } else {
        interimRef.current = interim;
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      ref.current?.focus();
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening]);

  const send = () => {
    const t = value.trim();
    if (!t || disabled || overLimit || effectivelyBlocked) return;
    const tagIds = hasTaggedDocs ? taggedDocs.map(d => d.id) : undefined;
    onSend(t, tagIds);
    setValue('');
    setTaggedDocs([]);
    setMentionQuery(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && mentionFiltered.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(i => (i + 1) % mentionFiltered.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIdx(i => (i - 1 + mentionFiltered.length) % mentionFiltered.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); selectMention(mentionFiltered[mentionIdx]); return; }
      if (e.key === 'Escape') { e.preventDefault(); setMentionQuery(null); return; }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
      return;
    }
    if (e.key === 'ArrowUp' && value === '' && onEditLast && !disabled) {
      e.preventDefault();
      onEditLast();
    }
  };

  const shortName = (name: string) => {
    const base = name.replace(/\.[^/.]+$/, '');
    return base.length > 20 ? base.slice(0, 18) + '…' : base;
  };

  const dropdownContent = mentionQuery !== null && dropdownPos && (
    <div
      ref={dropdownRef}
      role="listbox"
      aria-label="Chọn tài liệu để tag"
      style={{
        position: 'fixed',
        bottom: dropdownPos.bottom,
        left: dropdownPos.left,
        width: dropdownPos.width,
        zIndex: 9999,
        maxHeight: '320px',
        display: 'flex',
        flexDirection: 'column',
      }}
      className="bg-surface border border-border rounded-xl shadow-2xl animate-fade-in"
    >
      {/* Header cố định */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-elevated/60 flex-shrink-0 rounded-t-xl">
        <AtSign className="w-3 h-3 text-accent" />
        <span className="text-[11px] text-text-muted font-medium">
          {mentionQuery ? `Tìm "${mentionQuery}"` : 'Chọn tài liệu · ↑↓ điều hướng · Enter chọn · Esc đóng'}
        </span>
      </div>

      {/* Danh sách scrollable */}
      <div className="overflow-y-auto flex-1 min-h-0">
        {mentionFiltered.length > 0 ? (
          mentionFiltered.map((doc, i) => (
            <button
              key={doc.id}
              role="option"
              aria-selected={i === mentionIdx}
              onMouseDown={(e) => { e.preventDefault(); selectMention(doc); }}
              onMouseEnter={() => setMentionIdx(i)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors cursor-pointer
                ${i === mentionIdx ? 'bg-accent/10' : 'hover:bg-hover'}`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${i === mentionIdx ? 'bg-accent/15' : 'bg-elevated'}`}>
                <FileText className={`w-3.5 h-3.5 ${i === mentionIdx ? 'text-accent' : 'text-text-muted'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <span className={`text-[13px] font-medium block truncate ${i === mentionIdx ? 'text-accent' : 'text-text-primary'}`}>
                  {doc.name}
                </span>
              </div>
              {i === mentionIdx && (
                <kbd className="text-[10px] text-accent/60 font-mono bg-accent/10 px-1.5 py-0.5 rounded flex-shrink-0">Enter</kbd>
              )}
            </button>
          ))
        ) : (
          <div className="flex items-center gap-2 px-3 py-2.5">
            <FileText className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-[12px] text-text-muted">
              {taggedDocs.length >= availableDocs.length && availableDocs.length > 0
                ? 'Đã tag tất cả tài liệu'
                : `Không tìm thấy "${mentionQuery}"`}
            </span>
          </div>
        )}
      </div>

      {/* Footer hint khi có nhiều kết quả */}
      {mentionFiltered.length >= 20 && (
        <div className="px-3 py-1.5 border-t border-border bg-elevated/40 text-center flex-shrink-0 rounded-b-xl">
          <span className="text-[11px] text-text-muted">Gõ thêm để lọc chính xác hơn...</span>
        </div>
      )}
    </div>
  );

  return (
    <div ref={containerRef} className="px-4 pb-4 pt-3 border-t border-border bg-surface flex-shrink-0">

      {effectivelyBlocked && (
        <div className="flex items-center gap-2 mb-2.5 px-3 py-2 rounded-lg bg-warning/8 border border-warning/25 animate-fade-in">
          <BookOpen className="w-3.5 h-3.5 text-warning flex-shrink-0" />
          <p className="text-[12px] text-warning font-medium">
            Chọn tài liệu bên trái, hoặc gõ{' '}
            <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-warning/15 rounded font-mono font-bold">
              <AtSign className="w-2.5 h-2.5" />tên
            </span>{' '}
            để tag trực tiếp tài liệu cụ thể
          </p>
        </div>
      )}

      {availableDocs.length > 0 && taggedDocs.length === 0 && !value && !effectivelyBlocked && (
        <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
          <AtSign className="w-3 h-3 text-text-muted/60" />
          <span className="text-[11px] text-text-muted/70">
            Gõ <kbd className="px-1 py-0.5 bg-elevated border border-border rounded text-[10px] font-mono">@</kbd> để chọn bất kỳ tài liệu nào ({availableDocs.length} tài liệu)
          </span>
        </div>
      )}

      {/* dropdown được render qua portal để thoát khỏi overflow:hidden của ChatPanel */}
      {dropdownContent && createPortal(dropdownContent, document.body)}

      {/* Main input box */}
      <div
        className={`flex flex-col gap-2 bg-elevated border rounded-xl px-3 py-2 transition-all duration-200
          ${effectivelyBlocked
            ? 'border-border opacity-50'
            : mentionQuery !== null
              ? 'border-accent/60 shadow-sm shadow-accent/10'
              : overLimit
                ? 'border-danger/60 shadow-sm shadow-danger/10'
                : 'border-border focus-within:border-accent/60 focus-within:shadow-sm focus-within:shadow-accent/5'}`}
      >
        {/* Tagged doc chips */}
        {taggedDocs.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {taggedDocs.map(doc => (
              <span
                key={doc.id}
                className="inline-flex items-center gap-1 pl-1.5 pr-1 py-0.5 rounded-full bg-accent/10 border border-accent/25 text-accent text-[12px] font-medium"
              >
                <FileText className="w-3 h-3 flex-shrink-0" />
                <span className="max-w-[150px] truncate">{shortName(doc.name)}</span>
                <button
                  type="button"
                  onClick={() => removeTagged(doc.id)}
                  className="w-3.5 h-3.5 rounded-full flex items-center justify-center hover:bg-accent/25 transition-colors ml-0.5 cursor-pointer"
                  aria-label={`Bỏ tag ${doc.name}`}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
            <span className="text-[11px] text-accent/60 font-medium italic">
              · AI chỉ đọc {taggedDocs.length} tài liệu này
            </span>
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={ref}
              rows={1}
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={
                effectivelyBlocked
                  ? 'Chọn nguồn tài liệu hoặc dùng @ để tag...'
                  : hasTaggedDocs
                    ? `Hỏi về ${taggedDocs.length > 1 ? `${taggedDocs.length} tài liệu đã tag` : shortName(taggedDocs[0].name)}...`
                    : 'Đặt câu hỏi... (Enter gửi · Shift+Enter xuống dòng · @ tag tài liệu · ↑ sửa câu trước)'
              }
              disabled={disabled || effectivelyBlocked}
              aria-label="Soạn câu hỏi"
              aria-invalid={overLimit || undefined}
              aria-autocomplete="list"
              aria-expanded={mentionQuery !== null && mentionFiltered.length > 0}
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
            {voiceSupported && !isGenerating && (
              <button
                type="button"
                onClick={toggleVoice}
                title={isListening ? 'Dừng ghi âm' : 'Nhập liệu bằng giọng nói (vi-VN)'}
                aria-label={isListening ? 'Dừng ghi âm' : 'Ghi âm giọng nói'}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 border
                  ${isListening
                    ? 'bg-red-500/10 border-red-400/60 text-red-500 animate-pulse cursor-pointer'
                    : 'border-border text-text-muted hover:border-accent/50 hover:text-accent hover:bg-accent/5 cursor-pointer'
                  }`}
              >
                {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>
            )}
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
                disabled={!value.trim() || disabled || overLimit || effectivelyBlocked}
                aria-label="Gửi câu hỏi"
                title={
                  overLimit
                    ? `Vượt quá ${CHAR_MAX.toLocaleString('vi-VN')} ký tự`
                    : hasTaggedDocs
                      ? `Hỏi về ${taggedDocs.length} tài liệu đã tag`
                      : 'Gửi (Enter)'
                }
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 border-none
                  ${value.trim() && !disabled && !overLimit && !effectivelyBlocked
                    ? hasTaggedDocs
                      ? 'bg-accent text-white hover:bg-accent-hover cursor-pointer shadow-sm ring-2 ring-accent/30'
                      : 'bg-accent text-white hover:bg-accent-hover cursor-pointer shadow-sm'
                    : 'bg-hover text-text-muted cursor-not-allowed opacity-60'}`}
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="text-center text-[12px] text-text-muted mt-1.5">
        Local AI có thể mắc lỗi · Hãy kiểm tra lại các trích dẫn nguồn
      </p>
    </div>
  );
};
