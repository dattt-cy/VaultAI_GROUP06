import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Circle, LogOut, Plus, Shield } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const TopHeader: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAdmin, logout } = useAuth();

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
    <header className="h-12 bg-surface border-b border-border flex items-center justify-between px-4 flex-shrink-0 z-50">
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <img src="/logo.png" alt="VaultAI Logo" className="w-8 h-8 rounded-lg object-cover shadow-sm" />
        <span className="font-semibold text-[15px] text-text-primary">VaultAI</span>
        <span className="badge bg-accent/15 text-accent border border-accent/40">NỘI BỘ</span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        {/* Online */}
        <div className="flex items-center gap-1.5">
          <Circle className="w-2 h-2 fill-success text-success animate-pulse-slow" />
          <span className="text-[12px] text-text-muted">Trực tuyến</span>
        </div>

        {/* Role badge */}
        <span className={`badge border hidden sm:inline-flex ${isAdmin ? 'bg-danger/15 text-danger border-danger/30' : 'bg-warning/15 text-warning border-warning/30'}`}>
          {isAdmin ? 'Admin' : 'Người dùng'}
        </span>

        {/* Admin Panel link */}
        {isAdmin && (
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 border border-danger/40 text-danger hover:bg-danger/10 rounded-lg transition-colors text-[12px] font-semibold"
            title="Admin Panel"
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Admin</span>
          </button>
        )}

        {/* New notebook */}
        <button
          onClick={() => navigate('/workspace?id=new')}
          className="flex items-center gap-1.5 pl-2 pr-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 rounded-full transition-colors font-semibold text-[11px]"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
          Ghi chú mới
        </button>

        <div className="w-px h-5 bg-border" />

        {/* User info + logout */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-600 to-accent flex items-center justify-center text-white text-xs font-semibold">
            {initials}
          </div>
          <span className="text-[13px] text-text-secondary hidden sm:block">{user?.full_name ?? '—'}</span>
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
