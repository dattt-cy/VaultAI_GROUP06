import React from 'react';
import { Circle, LogOut } from 'lucide-react';

interface TopHeaderProps {
  role: string;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ role }) => {
  return (
    <header className="h-12 bg-surface border-b border-border flex items-center justify-between px-4 flex-shrink-0 z-50">
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <img src="/logo.png" alt="Local AI Logo" className="w-8 h-8 rounded-lg object-cover shadow-sm" />
        <span className="font-semibold text-[15px] text-text-primary">Local AI</span>
        <span className="badge bg-accent/15 text-accent border border-accent/40">NỘI BỘ</span>
      </div>

      {/* Center title */}
      <p className="text-[13px] text-text-secondary truncate max-w-lg">
        Hệ thống xử lý văn bản nội bộ không dùng Cloud
      </p>

      {/* Right */}
      <div className="flex items-center gap-3">
        {/* Online */}
        <div className="flex items-center gap-1.5">
          <Circle className="w-2 h-2 fill-success text-success animate-pulse-slow" />
          <span className="text-[11px] text-text-muted">Trực tuyến</span>
        </div>

        <div className="w-px h-5 bg-border" />

        {/* Role badge */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-text-muted">vai trò:</span>
          <span className="badge bg-warning/15 text-warning border border-warning/30">{role}</span>
        </div>

        <div className="w-px h-5 bg-border" />

        {/* User */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-600 to-accent flex items-center justify-center text-white text-xs font-semibold">
            NV
          </div>
          <span className="text-[12px] text-text-secondary">Nguyễn Văn A</span>
          <button
            title="Đăng xuất"
            className="btn-icon w-7 h-7 hover:text-danger hover:border-danger/50"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
