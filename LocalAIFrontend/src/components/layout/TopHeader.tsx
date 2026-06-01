import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Circle, LogOut, Pencil, Plus, Shield } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface TopHeaderProps {
  sessionTitle?: string | null;
  onRenameSession?: (newTitle: string) => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ sessionTitle, onRenameSession }) => {
  const navigate = useNavigate();
  const { user, canAccess, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(sessionTitle ?? '');
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [editing, sessionTitle]);

  const commitRename = () => {
    if (draft.trim() && draft.trim() !== sessionTitle) {
      onRenameSession?.(draft.trim());
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') setEditing(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const initials = user?.full_name
    .split(' ')
    .map(w => w[0])
    .slice(-2)
    .join('')
    .toUpperCase() ?? 'AI';

  return (
    <header className="h-12 bg-surface border-b border-border flex items-center justify-between px-3 flex-shrink-0 z-50 relative">
      {/* Logo */}
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-shrink-0"
        title="Về trang sổ ghi chú"
      >
        <img src="/logo.png" alt="VaultAI Logo" className="w-7 h-7 rounded-lg object-cover shadow-sm" />
        <span className="font-semibold text-[14px] text-text-primary hidden sm:block">VaultAI</span>
        <span className="badge bg-accent/15 text-accent border border-accent/40 hidden sm:inline-flex">NỘI BỘ</span>
      </button>

      {/* Session title — center, truncate on mobile */}
      {sessionTitle && (
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 group"
          style={{ maxWidth: 'calc(100% - 200px)' }}>
          <BookOpen className="w-3.5 h-3.5 text-text-muted flex-shrink-0 hidden sm:block" />
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleKeyDown}
              className="text-[13px] font-medium text-text-primary bg-transparent outline-none border-b border-accent/70 pb-px w-[180px] sm:w-[260px] placeholder:text-text-muted"
              placeholder="Tên sổ ghi chú..."
            />
          ) : (
            <button
              onClick={() => onRenameSession && setEditing(true)}
              disabled={!onRenameSession}
              className="flex items-center gap-1 min-w-0 rounded px-1 py-0.5 hover:bg-hover transition-colors"
              title={onRenameSession ? 'Nhấn để đổi tên' : undefined}
            >
              <span className="text-[12px] sm:text-[13px] font-medium text-text-secondary truncate max-w-[140px] sm:max-w-[280px] group-hover:text-text-primary transition-colors">
                {sessionTitle}
              </span>
              {onRenameSession && (
                <Pencil className="w-3 h-3 text-text-muted opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0" />
              )}
            </button>
          )}
        </div>
      )}

      {/* Right */}
      <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
        {/* Online — desktop only */}
        <div className="hidden sm:flex items-center gap-1.5">
          <Circle className="w-2 h-2 fill-success text-success animate-pulse-slow" />
          <span className="text-[12px] text-text-muted">Trực tuyến</span>
        </div>

        {/* Admin Panel link */}
        {canAccess(5) && (
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-1 px-2 py-1.5 border border-danger/40 text-danger hover:bg-danger/10 rounded-lg transition-colors text-[12px] font-semibold"
            title="Admin Panel"
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Admin</span>
          </button>
        )}

        {/* New notebook */}
        <button
          onClick={() => navigate('/workspace?id=new')}
          className="flex items-center gap-1 pl-1.5 pr-2 sm:pr-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 rounded-full transition-colors font-semibold text-[11px]"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
          <span className="hidden sm:inline">Ghi chú mới</span>
        </button>

        <div className="w-px h-5 bg-border hidden sm:block" />

        {/* User avatar + logout */}
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-600 to-accent flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
            {initials}
          </div>
          <span className="text-[13px] text-text-secondary hidden md:block">{user?.full_name ?? '—'}</span>
          <button
            title="Đăng xuất"
            onClick={handleLogout}
            className="btn-icon w-7 h-7 hover:text-danger hover:border-danger/50"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
