import React, { useEffect, useRef, useState } from 'react';
import { Outlet, useNavigate, Navigate } from 'react-router-dom';
import { ArrowLeft, Shield, PanelLeftClose, PanelLeftOpen, LogOut, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { SidebarNav } from '../../components/admin/SidebarNav';
import { Breadcrumb } from '../../components/admin/ui/Breadcrumb';
import { ToastProvider } from '../../components/admin/ui/Toast';
import { cn } from '../../lib/utils';

const COLLAPSE_KEY = 'localai_admin_sidebar_collapsed';

const AdminLayout: React.FC = () => {
  const { canAccess, isLoading, user, logout } = useAuth();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
  });
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* ignore */ }
  }, [collapsed]);

  // Close user menu on outside click
  useEffect(() => {
    if (!userMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [userMenuOpen]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!canAccess(5)) return <Navigate to="/dashboard" replace />;

  const initials = (user?.full_name ?? user?.username ?? '?')
    .split(' ')
    .slice(-2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <ToastProvider>
      <div className="h-screen flex flex-col bg-base overflow-hidden">
        {/* Top bar */}
        <header className="h-12 bg-surface border-b border-border flex items-center justify-between pl-2 pr-4 flex-shrink-0 z-50">
          {/* Left cluster */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-icon w-7 h-7 hover:text-accent hover:border-accent/50"
              title="Về Dashboard"
              aria-label="Về Dashboard"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCollapsed(c => !c)}
              className="btn-icon w-7 h-7 hover:text-accent hover:border-accent/50"
              title={collapsed ? 'Mở sidebar' : 'Thu gọn sidebar'}
              aria-label={collapsed ? 'Mở sidebar' : 'Thu gọn sidebar'}
            >
              {collapsed ? <PanelLeftOpen className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
            </button>
            <div className="w-px h-5 bg-border mx-1" />
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-md bg-danger/15">
                <Shield className="w-4 h-4 text-danger" />
              </div>
              <span className="font-semibold text-[15px] text-text-primary">Admin Panel</span>
            </div>
            <div className="w-px h-5 bg-border mx-2 hidden md:block" />
            <div className="hidden md:block min-w-0">
              <Breadcrumb />
            </div>
          </div>

          {/* Right cluster: user menu */}
          <div className="flex items-center gap-2" ref={userMenuRef}>
            {user && (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(o => !o)}
                  className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-hover transition-colors cursor-pointer"
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-accent-hover text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                    {initials}
                  </div>
                  <div className="hidden sm:flex flex-col items-start leading-tight">
                    <span className="text-[12px] font-semibold text-text-primary truncate max-w-[120px]">{user.full_name || user.username}</span>
                    <span className="text-[10px] text-text-muted">Lv {user.access_level}</span>
                  </div>
                </button>
                {userMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full mt-1.5 min-w-[200px] bg-surface border border-border rounded-xl shadow-xl py-1.5 animate-fade-in"
                  >
                    <div className="px-3 py-2 border-b border-border/60 mb-1">
                      <p className="text-[13px] font-semibold text-text-primary truncate">{user.full_name || user.username}</p>
                      <p className="text-[11px] text-text-muted truncate">@{user.username} · {user.role}</p>
                    </div>
                    <button
                      onClick={() => { setUserMenuOpen(false); navigate('/dashboard'); }}
                      role="menuitem"
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-text-secondary hover:bg-hover hover:text-text-primary transition-colors cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5" />
                      Trang người dùng
                    </button>
                    <button
                      onClick={() => { setUserMenuOpen(false); logout().catch(() => {}); }}
                      role="menuitem"
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          <aside
            className={cn(
              'flex-shrink-0 bg-surface border-r border-border overflow-y-auto transition-[width] duration-200',
              collapsed ? 'w-[56px]' : 'w-[220px]',
            )}
            aria-label="Sidebar"
          >
            <SidebarNav collapsed={collapsed} />
          </aside>

          <main className="flex-1 overflow-y-auto bg-base">
            <div className="max-w-[1400px] mx-auto p-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
};

export default AdminLayout;
