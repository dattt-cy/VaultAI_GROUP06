import React, { useEffect, useState } from 'react';
import { ChevronRight, Loader2, RefreshCw, Lightbulb } from 'lucide-react';

// Nhóm câu hỏi mẫu cố định (phổ quát, không liên quan đến tài liệu cụ thể)
const STATIC_GROUPS = [
  {
    cat: '📖 Tra cứu chung',
    items: [
      'Tóm tắt nội dung chính của tài liệu này?',
      'Tài liệu này có những điều khoản quan trọng nào?',
      'Liệt kê các định nghĩa và thuật ngữ trong tài liệu?',
    ],
  },
  {
    cat: '📊 Phân tích & So sánh',
    items: [
      'Những điểm khác biệt chính trong tài liệu này là gì?',
      'Tóm tắt các quy định quan trọng nhất?',
      'Có những rủi ro hoặc lưu ý nào cần chú ý?',
    ],
  },
];

interface SampleQuestionsProps {
  onSelect: (q: string) => void;
  checkedDocIds?: Set<number>;
}

export const SampleQuestions: React.FC<SampleQuestionsProps> = ({ onSelect, checkedDocIds }) => {
  const [open, setOpen] = useState<Set<string>>(new Set([STATIC_GROUPS[0].cat]));
  const [dynSuggestions, setDynSuggestions] = useState<string[]>([]);
  const [dynLoading, setDynLoading] = useState(false);
  const [dynError, setDynError] = useState(false);

  const toggle = (c: string) =>
    setOpen(p => { const s = new Set(p); s.has(c) ? s.delete(c) : s.add(c); return s; });

  // Fetch gợi ý động khi có tài liệu được chọn
  const fetchSuggestions = async () => {
    if (!checkedDocIds || checkedDocIds.size === 0) {
      setDynSuggestions([]);
      return;
    }
    setDynLoading(true);
    setDynError(false);
    try {
      const ids = Array.from(checkedDocIds).join(',');
      const res = await fetch(`/api/chat/suggestions?doc_ids=${ids}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDynSuggestions(data.suggestions || []);
    } catch {
      setDynError(true);
      setDynSuggestions([]);
    } finally {
      setDynLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedDocIds]);

  const hasDynamic = dynSuggestions.length > 0 || dynLoading;

  return (
    <div className="py-1">
      {/* Gợi ý động theo tài liệu đã chọn */}
      {checkedDocIds && checkedDocIds.size > 0 && (
        <div className="mb-1">
          <div className="flex items-center gap-1.5 px-3 pr-2.5 py-1.5 hover:bg-hover/40 transition-colors">
            <button
              onClick={() => toggle('__dynamic__')}
              className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer text-left"
            >
              <Lightbulb className="w-3 h-3 text-accent flex-shrink-0" />
              <span className="text-[11px] font-semibold text-accent flex-1">
                Gợi ý từ tài liệu đã chọn
              </span>
              <ChevronRight
                className={`w-3 h-3 text-text-muted transition-transform duration-150 ${open.has('__dynamic__') ? 'rotate-90' : ''}`}
              />
            </button>
            <button
              onClick={e => { e.stopPropagation(); fetchSuggestions(); }}
              title="Làm mới gợi ý"
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-hover transition-colors"
            >
              <RefreshCw className={`w-3 h-3 text-text-muted ${dynLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {open.has('__dynamic__') && (
            <div>
              {dynLoading && (
                <div className="flex items-center gap-1.5 px-5 py-2 text-text-muted">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span className="text-[11px]">Đang tạo gợi ý...</span>
                </div>
              )}
              {dynError && (
                <p className="px-5 py-1.5 text-[11px] text-danger">Không thể tải gợi ý.</p>
              )}
              {!dynLoading && dynSuggestions.map(q => (
                <button
                  key={q}
                  onClick={() => onSelect(q)}
                  className="block w-full text-left px-5 py-1.5 text-[12px] text-accent/90
                             hover:bg-accent/5 hover:text-accent transition-colors leading-snug"
                >
                  {q}
                </button>
              ))}
              {!dynLoading && !dynError && dynSuggestions.length === 0 && (
                <p className="px-5 py-1.5 text-[11px] text-text-muted italic">Chưa có gợi ý.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Phân cách */}
      {hasDynamic && checkedDocIds && checkedDocIds.size > 0 && (
        <div className="h-px bg-border/50 mx-3 my-1" />
      )}

      {/* Nhóm câu hỏi cố định */}
      {STATIC_GROUPS.map(g => (
        <div key={g.cat}>
          <button
            onClick={() => toggle(g.cat)}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-hover transition-colors"
          >
            <span className="text-[11px] font-semibold text-text-secondary flex-1">{g.cat}</span>
            <ChevronRight
              className={`w-3 h-3 text-text-muted transition-transform duration-150 ${open.has(g.cat) ? 'rotate-90' : ''}`}
            />
          </button>
          {open.has(g.cat) && g.items.map(q => (
            <button
              key={q}
              onClick={() => onSelect(q)}
              className="block w-full text-left px-5 py-1.5 text-[12px] text-text-secondary
                         hover:bg-elevated hover:text-text-primary transition-colors leading-snug"
            >
              {q}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
};
