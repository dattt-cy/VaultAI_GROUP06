import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Square, BookOpen, X, FileText, AtSign } from 'lucide-react';

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
  const ref = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const mentionFiltered = useMemo(() => {
    if (mentionQuery === null || availableDocs.length === 0) return [];
    const q = mentionQuery.toLowerCase();
    return availableDocs
      .filter(d => !taggedDocs.some(t => t.id === d.id))
      .filter(d => d.name.toLowerCase().includes(q))
      .slice(0, 6);
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

  return (
    <div className="px-4 pb-4 pt-3 border-t border-border bg-surface flex-shrink-0 relative">

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

      {!effectivelyBlocked && availableDocs.length > 0 && taggedDocs.length === 0 && !value && (
        <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
          <AtSign className="w-3 h-3 text-text-muted/60" />
          <span className="text-[11px] text-text-muted/70">
            Gõ <kbd className="px-1 py-0.5 bg-elevated border border-border rounded text-[10px] font-mono">@</kbd> để hỏi riêng 1 tài liệu cụ thể
          </span>
        </div>
      )}

      {/* @mention dropdown — floats above */}
      {mentionQuery !== null && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full mb-1 left-4 right-4 z-50 bg-surface border border-border rounded-xl shadow-xl overflow-hidden animate-fade-in"
          role="listbox"
          aria-label="Chọn tài liệu để tag"
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-elevated/60">
            <AtSign className="w-3 h-3 text-accent" />
            <span className="text-[11px] text-text-muted font-medium">
              {mentionQuery ? `Tìm "${mentionQuery}"` : 'Chọn tài liệu · ↑↓ điều hướng · Enter chọn · Esc đóng'}
            </span>
          </div>

          {mentionFiltered.length > 0 ? (
            <>
              {mentionFiltered.map((doc, i) => (
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
              ))}
              {availableDocs.filter(d => !taggedDocs.some(t => t.id === d.id)).length > 6 && (
                <div className="px-3 py-1.5 border-t border-border bg-elevated/40 text-center">
                  <span className="text-[11px] text-text-muted">Gõ thêm để lọc chính xác hơn...</span>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2.5">
              <FileText className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-[12px] text-text-muted">
                {taggedDocs.length === availableDocs.length
                  ? 'Đã tag tất cả tài liệu được chọn'
                  : `Không tìm thấy "${mentionQuery}"`}
              </span>
            </div>
          )}
        </div>
      )}

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
