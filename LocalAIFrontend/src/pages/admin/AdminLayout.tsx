import React from 'react';
import { Outlet, useNavigate, Navigate } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { SidebarNav } from '../../components/admin/SidebarNav';

const AdminLayout: React.FC = () => {
  const { canAccess, isLoading } = useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!canAccess(5)) return <Navigate to="/dashboard" replace />;

  return (
    <div className="h-screen flex flex-col bg-base overflow-hidden">
      {/* Top bar */}
      <header className="h-12 bg-surface border-b border-border flex items-center justify-between px-4 flex-shrink-0 z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-icon w-7 h-7 hover:text-accent hover:border-accent/50"
            title="Về Dashboard"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-5 bg-border" />
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-danger/15">
              <Shield className="w-4 h-4 text-danger" />
            </div>
            <span className="font-semibold text-[15px] text-text-primary">Admin Panel</span>
          </div>
        </div>
        <span className="text-[12px] text-text-muted hidden sm:block">Quản trị hệ thống Local AI</span>
        <div className="w-24" />
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[220px] flex-shrink-0 bg-surface border-r border-border overflow-y-auto">
          <SidebarNav />
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto bg-base p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
