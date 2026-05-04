import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Shield, FileKey, FileText,
  FolderOpen, Settings2, MessageSquare, ThumbsUp,
  ClipboardList, Activity, Building2,
} from 'lucide-react';

const navItems = [
  { label: 'Tổng quan', path: '/admin/overview', icon: LayoutDashboard },
  { label: 'Người dùng', path: '/admin/users', icon: Users },
  { label: 'Phòng ban', path: '/admin/departments', icon: Building2 },
  { label: 'Vai trò & Quyền', path: '/admin/roles', icon: Shield },
  { label: 'Phân quyền Tài liệu', path: '/admin/doc-permissions', icon: FileKey },
  { label: 'Tài liệu', path: '/admin/documents', icon: FileText },
  { label: 'Danh mục', path: '/admin/categories', icon: FolderOpen },
  { label: 'Cấu hình AI', path: '/admin/ai-config', icon: Settings2 },
  { label: 'Giám sát Chat', path: '/admin/chat-monitor', icon: MessageSquare },
  { label: 'Phản hồi', path: '/admin/feedback', icon: ThumbsUp },
  { label: 'Nhật ký', path: '/admin/audit-logs', icon: ClipboardList },
  { label: 'Tài nguyên', path: '/admin/system-metrics', icon: Activity },
];

const sections = [
  { title: 'Tổng quan', items: navItems.slice(0, 1) },
  { title: 'Quản lý', items: navItems.slice(1, 7) },
  { title: 'Hệ thống', items: navItems.slice(7) },
];

export const SidebarNav: React.FC = () => (
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
