import React, { useState } from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ReportDialogProps {
  onConfirm: (reportType: string, comment: string) => void;
  onClose: () => void;
}

const REPORT_TYPES = [
  { value: 'Thông tin bịa đặt', label: 'Thông tin bịa đặt (ảo giác AI)' },
  { value: 'Thông tin sai lệch', label: 'Thông tin sai lệch' },
  { value: 'Dẫn nguồn không tồn tại', label: 'Dẫn nguồn không tồn tại' },
  { value: 'Nội dung không phù hợp', label: 'Nội dung không phù hợp' },
];

export const ReportDialog: React.FC<ReportDialogProps> = ({ onConfirm, onClose }) => {
  const [selected, setSelected] = useState(REPORT_TYPES[0].value);
  const [comment, setComment] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-md p-5 mx-4 animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-warning" />
            <span className="font-semibold text-[14px] text-text-primary">Báo lỗi câu trả lời AI</span>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-secondary transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[12px] text-text-muted mb-4">Chọn loại lỗi để giúp cải thiện chất lượng AI.</p>

        <div className="space-y-2 mb-4">
          {REPORT_TYPES.map(rt => (
            <label key={rt.value} className="flex items-center gap-3 p-2.5 rounded-lg border border-border cursor-pointer hover:bg-hover transition-colors">
              <input
                type="radio"
                name="reportType"
                value={rt.value}
                checked={selected === rt.value}
                onChange={() => setSelected(rt.value)}
                className="accent-accent"
              />
              <span className="text-[13px] text-text-primary">{rt.label}</span>
            </label>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Mô tả thêm (không bắt buộc)..."
          rows={3}
          className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-[12px] text-text-primary placeholder-text-muted resize-none focus:outline-none focus:border-accent transition-colors mb-4"
        />

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-[12px] text-text-secondary border border-border hover:bg-hover transition-colors cursor-pointer"
          >
            Huỷ
          </button>
          <button
            onClick={() => { onConfirm(selected, comment.trim()); onClose(); }}
            className="px-4 py-2 rounded-lg text-[12px] font-medium bg-warning text-white hover:bg-warning/90 transition-colors cursor-pointer"
          >
            Gửi báo lỗi
          </button>
        </div>
      </div>
    </div>
  );
};
