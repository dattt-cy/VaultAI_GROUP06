import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Shield, FileKey, FileText,
  FolderOpen, Settings2, MessageSquare, ThumbsUp,
  ClipboardList, Activity, Building2,
  Cpu, Sliders, HardDrive, ShieldCheck, Scale,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet } from '../../utils/apiClient';
import { cn } from '../../lib/utils';

interface NavItem {
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
  minLevel: number;
  /** Optional badge key to fetch counts for */
  badgeKey?: 'pending_feedback' | 'failed_ingestion';
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Tổng quan',           path: '/admin/overview',          icon: LayoutDashboard, minLevel: 5  },
  { label: 'Người dùng',          path: '/admin/users',             icon: Users,           minLevel: 9  },
  { label: 'Phòng ban',           path: '/admin/departments',       icon: Building2,       minLevel: 9  },
  { label: 'Vai trò & Quyền',     path: '/admin/roles',             icon: Shield,          minLevel: 10 },
  { label: 'Phân quyền Tài liệu', path: '/admin/doc-permissions',   icon: FileKey,         minLevel: 5  },
  { label: 'Tài liệu',            path: '/admin/documents',         icon: FileText,        minLevel: 5,  badgeKey: 'failed_ingestion' },
  { label: 'Import Pháp luật',   path: '/admin/legal-import',      icon: Scale,           minLevel: 5  },
  { label: 'Danh mục',            path: '/admin/categories',        icon: FolderOpen,      minLevel: 5  },
  { label: 'Cấu hình AI',         path: '/admin/ai-config',         icon: Settings2,       minLevel: 9  },
  { label: 'Quản lý Model',       path: '/admin/model-management',  icon: Cpu,             minLevel: 9  },
  { label: 'Cấu hình RAG',        path: '/admin/rag-config',        icon: Sliders,         minLevel: 9  },
  { label: 'Giám sát Chat',       path: '/admin/chat-monitor',      icon: MessageSquare,   minLevel: 5  },
  { label: 'Phản hồi',            path: '/admin/feedback',          icon: ThumbsUp,        minLevel: 5,  badgeKey: 'pending_feedback' },
  { label: 'Nhật ký',             path: '/admin/audit-logs',        icon: ClipboardList,   minLevel: 9  },
  { label: 'Tài nguyên',          path: '/admin/system-metrics',    icon: Activity,        minLevel: 9  },
  { label: 'Sao lưu',             path: '/admin/backup',            icon: HardDrive,       minLevel: 9  },
  { label: 'Bảo mật',             path: '/admin/security',          icon: ShieldCheck,     minLevel: 9  },
];

const SECTION_CONFIG: { title: string; paths: string[] }[] = [
  { title: 'Tổng quan', paths: ['/admin/overview'] },
  { title: 'Quản lý', paths: [
    '/admin/users', '/admin/departments', '/admin/roles',
    '/admin/doc-permissions', '/admin/documents', '/admin/legal-import', '/admin/categories',
  ]},
  { title: 'Hệ thống', paths: [
    '/admin/ai-config', '/admin/model-management', '/admin/rag-config',
    '/admin/chat-monitor', '/admin/feedback', '/admin/audit-logs',
    '/admin/system-metrics', '/admin/backup', '/admin/security',
  ]},
];

interface SidebarNavProps {
  collapsed?: boolean;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({ collapsed = false }) => {
  const { canAccess } = useAuth();
  const [badges, setBadges] = useState<{ pending_feedback: number; failed_ingestion: number }>({
    pending_feedback: 0,
    failed_ingestion: 0,
  });

  // Fetch sidebar badge counters from the overview endpoint
  useEffect(() => {
    let alive = true;
    const fetchBadges = () => {
      apiGet('/api/admin/overview')
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!alive || !d) return;
          setBadges({
            pending_feedback: d.feedback_stats?.pending ?? 0,
            failed_ingestion: d.ingestion_stats?.FAILED ?? 0,
          });
        })
        .catch(() => { /* silent */ });
    };
    fetchBadges();
    const interval = setInterval(fetchBadges, 60_000); // refresh every minute
    return () => { alive = false; clearInterval(interval); };
  }, []);

  const visible = NAV_ITEMS.filter(item => canAccess(item.minLevel));
  const sections = SECTION_CONFIG
    .map(s => ({ title: s.title, items: visible.filter(i => s.paths.includes(i.path)) }))
    .filter(s => s.items.length > 0);

  return (
    <nav className={cn('flex flex-col gap-0.5 p-3', collapsed && 'px-1.5')} aria-label="Điều hướng admin">
      {sections.map(section => (
        <div key={section.title} className="mb-3">
          {!collapsed && (
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest px-3 py-1 mb-1">
              {section.title}
            </p>
          )}
          {collapsed && <div className="border-t border-border/40 my-2 mx-2" />}

          {section.items.map(({ label, path, icon: Icon, badgeKey }) => {
            const badge = badgeKey ? badges[badgeKey] : 0;
            return (
              <NavLink
                key={path}
                to={path}
                end={path === '/admin/overview'}
                title={collapsed ? label : undefined}
                className={({ isActive }) => cn(
                  'relative flex items-center rounded-md text-[13px] font-medium border border-transparent transition-all duration-150 cursor-pointer',
                  collapsed ? 'justify-center py-2 mx-1' : 'gap-2.5 px-3 py-2',
                  isActive
                    ? 'bg-accent/15 border-accent/40 text-accent'
                    : 'text-text-secondary hover:bg-hover hover:text-text-primary',
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span className="flex-1 truncate">{label}</span>}
                {badge > 0 && (
                  <span className={cn(
                    'flex-shrink-0 text-[10px] font-bold rounded-full bg-danger text-white tabular-nums',
                    collapsed
                      ? 'absolute top-1 right-1 min-w-[16px] h-[16px] px-1 flex items-center justify-center'
                      : 'min-w-[18px] h-[18px] px-1.5 flex items-center justify-center',
                  )}>
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>
      ))}
    </nav>
  );
};
