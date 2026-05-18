import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

/**
 * Generates breadcrumb items from the current admin path.
 * Maps known segments to Vietnamese labels.
 */
const SEGMENT_LABELS: Record<string, string> = {
  admin: 'Admin',
  overview: 'Tổng quan',
  users: 'Người dùng',
  departments: 'Phòng ban',
  roles: 'Vai trò & Quyền',
  'doc-permissions': 'Phân quyền Tài liệu',
  documents: 'Tài liệu',
  categories: 'Danh mục',
  'ai-config': 'Cấu hình AI',
  'model-management': 'Quản lý Model',
  'rag-config': 'Cấu hình RAG',
  'chat-monitor': 'Giám sát Chat',
  feedback: 'Phản hồi',
  'audit-logs': 'Nhật ký',
  'system-metrics': 'Tài nguyên',
  backup: 'Sao lưu',
  security: 'Bảo mật',
};

export const Breadcrumb: React.FC = () => {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);

  // Build cumulative paths: ['admin', 'admin/users']
  const items = segments.map((seg, i) => ({
    label: SEGMENT_LABELS[seg] ?? seg,
    href: '/' + segments.slice(0, i + 1).join('/'),
  }));

  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12px] text-text-muted">
      <Home className="w-3 h-3 flex-shrink-0" />
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <React.Fragment key={item.href}>
            <ChevronRight className="w-3 h-3 text-text-muted/60 flex-shrink-0" />
            {isLast ? (
              <span className="text-text-secondary font-medium truncate max-w-[200px]">{item.label}</span>
            ) : (
              <Link
                to={item.href}
                className="hover:text-text-primary transition-colors truncate max-w-[160px]"
              >
                {item.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
