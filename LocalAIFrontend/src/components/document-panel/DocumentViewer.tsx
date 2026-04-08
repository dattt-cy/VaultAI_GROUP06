import React, { useEffect, useRef } from 'react';
import { Shield } from 'lucide-react';
import type { HighlightState } from '../../hooks/useDocumentHighlight';

const DOC_PAGES = [
  { page: 1, title: 'Chương I. Giới thiệu', lines: ['CÔNG TY TNHH ABC VIỆT NAM', 'QUY CHẾ NỘI BỘ NĂM 2024', 'Ban hành kèm theo Quyết định số 01/2024/QĐ-GĐ', 'ngày 01 tháng 01 năm 2024 của Giám đốc Công ty'] },
  { page: 2, title: 'Chương II. Phạm vi áp dụng', lines: ['Điều 1. Phạm vi điều chỉnh', 'Quy chế này điều chỉnh các hoạt động của toàn thể cán bộ,', 'nhân viên đang làm việc tại Công ty TNHH ABC Việt Nam.', 'Điều 2. Đối tượng áp dụng', 'Quy chế áp dụng với tất cả nhân viên chính thức,', 'nhân viên thử việc và cộng tác viên dài hạn.'] },
  { page: 5, title: 'Điều 12. Quyền và nghĩa vụ', lines: ['Điều 12. Quyền và nghĩa vụ của nhân viên', '1. Nhân viên có quyền được hưởng đầy đủ các chế độ phúc lợi.', '2. Nhân viên có nghĩa vụ hoàn thành công việc đúng hạn.', '3. Nhân viên phải tuân thủ quy định bảo mật thông tin nội bộ.', '4. Số CCCD: ████████████ – đã được ẩn danh hóa', '5. Số điện thoại: ██████████ – đã được ẩn danh hóa'] },
  { page: 6, title: 'Điều 13. Lương và phụ cấp', lines: ['Điều 13. Lương và các khoản phụ cấp', 'Mức lương cơ bản được tính dựa trên bảng lương theo Nghị định.', 'Phụ cấp chức vụ áp dụng từ cấp Trưởng nhóm trở lên.', 'Xem bảng phụ lục 3 để biết hệ số phụ cấp chi tiết.'] },
];

export const DocumentViewer: React.FC<{ highlight: HighlightState; filename?: string }> = ({ highlight, filename }) => {
  const highlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlight.isVisible && highlight.citation)
      highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlight]);

  return (
    <div className="h-full overflow-y-auto px-5 py-4 select-none-all text-[13px]">
      {/* Doc header */}
      <div className="text-center mb-6 pb-4 border-b border-border">
        <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Đang xem</p>
        <p className="font-semibold text-text-primary">{filename ?? 'Quy chế nội bộ 2024.pdf'}</p>
      </div>

      {DOC_PAGES.map(pg => {
        const isHl = highlight.isVisible && highlight.citation?.page === pg.page;
        return (
          <div key={pg.page} className="mb-7">
            {/* Page marker */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-bold text-text-muted bg-elevated border border-border px-2 py-0.5 rounded uppercase tracking-wider flex-shrink-0">
                Trang {pg.page}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <p className="text-[12px] font-semibold text-text-secondary mb-2">{pg.title}</p>

            <div
              ref={isHl ? highlightRef : undefined}
              className={`p-3.5 rounded-lg border transition-all duration-500 ${
                isHl
                  ? 'border-yellow-600/60 animate-highlight'
                  : 'bg-elevated border-border'
              }`}
              style={isHl ? { backgroundColor: 'rgba(187,128,9,0.2)', border: '1.5px solid rgba(187,128,9,0.6)' } : {}}
            >
              {pg.lines.map((line, i) => (
                <p key={i} className={`leading-7 text-[12.5px] ${line.includes('████') ? 'text-danger font-mono' : 'text-text-primary'}`}>
                  {line}
                </p>
              ))}
              {isHl && (
                <div className="mt-2 pt-2 border-t border-yellow-600/30 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-warning" />
                  <span className="text-[10px] text-warning font-semibold">Đoạn văn bản được trích dẫn</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
