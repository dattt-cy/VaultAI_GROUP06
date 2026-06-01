import React from 'react';
import { FileText, FileSpreadsheet, FileDown } from 'lucide-react';

const EXPORTS = [
  { label: 'Word',  Icon: FileText,        color: 'text-accent',   bgColor: 'bg-accent/10',   borderColor: 'border-accent/30',   hoverBg: 'hover:bg-accent/20' },
  { label: 'Excel', Icon: FileSpreadsheet, color: 'text-success',  bgColor: 'bg-success/10',  borderColor: 'border-success/30',  hoverBg: 'hover:bg-success/20' },
  { label: 'PDF',   Icon: FileDown,        color: 'text-danger',   bgColor: 'bg-danger/10',   borderColor: 'border-danger/30',   hoverBg: 'hover:bg-danger/20' },
];

export const ExportButtons: React.FC<{ disabled?: boolean }> = ({ disabled }) => (
  <div className="flex items-center gap-1.5 mt-2">
    <span className="text-[14px] text-text-muted mr-1">Xuất ra:</span>
    {EXPORTS.map(({ label, Icon, color, bgColor, borderColor, hoverBg }) => (
      <button
        key={label}
        disabled={disabled}
        title={`Xuất kết quả ra tệp ${label}`}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] font-medium border transition-all duration-150
          ${disabled
            ? 'bg-elevated border-border text-text-muted cursor-not-allowed opacity-50'
            : `${bgColor} ${borderColor} ${color} ${hoverBg} hover:-translate-y-px cursor-pointer`
          }`}
      >
        <Icon className="w-3.5 h-3.5" />
        {label}
      </button>
    ))}
  </div>
);
