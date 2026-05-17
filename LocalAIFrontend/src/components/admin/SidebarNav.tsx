import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Shield, FileKey, FileText,
  FolderOpen, Settings2, MessageSquare, ThumbsUp,
  ClipboardList, Activity, Building2,
  Cpu, Sliders, HardDrive, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const NAV_ITEMS = [
  { label: 'Tổng quan',          path: '/admin/overview',          icon: LayoutDashboard, minLevel: 5  },
  { label: 'Người dùng',         path: '/admin/users',             icon: Users,           minLevel: 9  },
  { label: 'Phòng ban',          path: '/admin/departments',       icon: Building2,       minLevel: 9  },
  { label: 'Vai trò & Quyền',    path: '/admin/roles',             icon: Shield,          minLevel: 10 },
  { label: 'Phân quyền Tài liệu',path: '/admin/doc-permissions',   icon: FileKey,         minLevel: 5  },
  { label: 'Tài liệu',           path: '/admin/documents',         icon: FileText,        minLevel: 5  },
  { label: 'Danh mục',           path: '/admin/categories',        icon: FolderOpen,      minLevel: 5  },
  { label: 'Cấu hình AI',        path: '/admin/ai-config',         icon: Settings2,       minLevel: 9  },
  { label: 'Quản lý Model',      path: '/admin/model-management',  icon: Cpu,             minLevel: 9  },
  { label: 'Cấu hình RAG',       path: '/admin/rag-config',        icon: Sliders,         minLevel: 9  },
  { label: 'Giám sát Chat',      path: '/admin/chat-monitor',      icon: MessageSquare,   minLevel: 5  },
  { label: 'Phản hồi',           path: '/admin/feedback',          icon: ThumbsUp,        minLevel: 5  },
  { label: 'Nhật ký',            path: '/admin/audit-logs',        icon: ClipboardList,   minLevel: 9  },
  { label: 'Tài nguyên',         path: '/admin/system-metrics',    icon: Activity,        minLevel: 9  },
  { label: 'Sao lưu',            path: '/admin/backup',            icon: HardDrive,       minLevel: 9  },
  { label: 'Bảo mật',            path: '/admin/security',          icon: ShieldCheck,     minLevel: 9  },
];

export const SidebarNav: React.FC = () => {
  const { canAccess } = useAuth();
  const visible = NAV_ITEMS.filter(item => canAccess(item.minLevel));

  const sections = [
    { title: 'Tổng quan', items: visible.filter(i => i.path === '/admin/overview') },
    { title: 'Quản lý',   items: visible.filter(i => ['/admin/users','/admin/departments','/admin/roles','/admin/doc-permissions','/admin/documents','/admin/categories'].includes(i.path)) },
    { title: 'Hệ thống',  items: visible.filter(i => ['/admin/ai-config','/admin/model-management','/admin/rag-config','/admin/chat-monitor','/admin/feedback','/admin/audit-logs','/admin/system-metrics','/admin/backup','/admin/security'].includes(i.path)) },
  ].filter(s => s.items.length > 0);

  return (
    <nav className="flex flex-col gap-0.5 p-3">
      {sections.map(section => (
        <div key={section.title} className="mb-3">
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest px-3 py-1 mb-1">
            {section.title}
          </p>
          {section.items.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `sidebar-item gap-2.5 py-2 text-[13px] font-medium ${isActive ? 'active' : ''}`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
};
