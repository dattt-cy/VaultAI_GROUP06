import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';

const QUESTIONS = [
  { cat: '🔍 Tra cứu quy định', items: ['Quy định về giờ làm việc và nghỉ phép?', 'Mức phụ cấp chức vụ hiện hành là bao nhiêu?', 'Quy trình xin nghỉ phép năm như thế nào?'] },
  { cat: '📊 Phân tích tài liệu', items: ['So sánh quy chế 2023 và 2024 có điểm gì khác?', 'Tóm tắt các thay đổi chính trong hợp đồng mới nhất'] },
  { cat: '📝 Soạn thảo báo cáo', items: ['Giúp tôi soạn báo cáo tóm tắt về tình hình nhân sự', 'Trích xuất các số liệu tài chính quan trọng từ báo cáo Q1'] },
];

export const SampleQuestions: React.FC<{ onSelect: (q: string) => void }> = ({ onSelect }) => {
  const [open, setOpen] = useState<Set<string>>(new Set([QUESTIONS[0].cat]));
  const toggle = (c: string) => setOpen(p => { const s = new Set(p); s.has(c) ? s.delete(c) : s.add(c); return s; });

  return (
    <div className="py-1">
      {QUESTIONS.map(g => (
        <div key={g.cat}>
          <button onClick={() => toggle(g.cat)}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-hover transition-colors">
            <span className="text-[11px] font-semibold text-text-secondary flex-1">{g.cat}</span>
            <ChevronRight className={`w-3 h-3 text-text-muted transition-transform duration-150 ${open.has(g.cat) ? 'rotate-90' : ''}`} />
          </button>
          {open.has(g.cat) && g.items.map(q => (
            <button key={q} onClick={() => onSelect(q)}
              className="block w-full text-left px-5 py-1.5 text-[11px] text-text-secondary
                         hover:bg-elevated hover:text-text-primary transition-colors leading-snug">
              {q}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
};
