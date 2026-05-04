import React, { useState } from 'react';
import { X, ChevronDown, ChevronUp, CheckCircle2, XCircle, Loader2, Upload } from 'lucide-react';
import type { UploadItem } from '../../hooks/useDocumentUpload';
import { cn } from '../../lib/utils';

interface Props {
  uploads: UploadItem[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
}

const StatusIcon = ({ status, progress }: { status: UploadItem['status']; progress: number }) => {
  if (status === 'uploading') return (
    <div className="relative w-5 h-5 flex-shrink-0">
      <svg className="w-5 h-5 -rotate-90" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" className="text-border" />
        <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2"
          strokeDasharray={`${2 * Math.PI * 8}`}
          strokeDashoffset={`${2 * Math.PI * 8 * (1 - progress / 100)}`}
          className="text-accent transition-all duration-300" />
      </svg>
    </div>
  );
  if (status === 'processing') return <Loader2 className="w-4 h-4 text-warning animate-spin flex-shrink-0" />;
  if (status === 'done') return <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />;
  return <XCircle className="w-4 h-4 text-danger flex-shrink-0" />;
};

export const UploadQueuePanel: React.FC<Props> = ({ uploads, onDismiss, onDismissAll }) => {
  const [collapsed, setCollapsed] = useState(false);

  if (uploads.length === 0) return null;

  const active = uploads.filter(u => u.status === 'uploading' || u.status === 'processing').length;
  const done = uploads.filter(u => u.status === 'done').length;
  const failed = uploads.filter(u => u.status === 'error').length;

  const headerLabel = active > 0
    ? `Đang upload ${active} file...`
    : failed > 0
    ? `${done} hoàn thành, ${failed} lỗi`
    : `${done} file đã upload xong`;

  return (
    <div className="fixed bottom-5 right-5 z-50 w-80 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-elevated border-b border-border">
        <Upload className="w-3.5 h-3.5 text-accent flex-shrink-0" />
        <span className="flex-1 text-[13px] font-semibold text-text-primary truncate">{headerLabel}</span>
        <button onClick={() => setCollapsed(c => !c)} className="text-text-muted hover:text-text-primary transition-colors">
          {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {active === 0 && (
          <button onClick={onDismissAll} className="text-text-muted hover:text-text-primary transition-colors ml-1">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* List */}
      {!collapsed && (
        <div className="max-h-64 overflow-y-auto divide-y divide-border/50">
          {uploads.map(item => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-elevated/50 transition-colors group">
              <StatusIcon status={item.status} progress={item.progress} />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-text-primary truncate">{item.filename}</p>
                <p className={cn('text-[11px]',
                  item.status === 'uploading' && 'text-accent',
                  item.status === 'processing' && 'text-warning',
                  item.status === 'done' && 'text-success',
                  item.status === 'error' && 'text-danger',
                )}>
                  {item.status === 'uploading' && `${item.progress}%`}
                  {item.status === 'processing' && 'Đang tạo vector...'}
                  {item.status === 'done' && 'Hoàn thành'}
                  {item.status === 'error' && (item.error ?? 'Lỗi')}
                </p>
              </div>
              {(item.status === 'done' || item.status === 'error') && (
                <button
                  onClick={() => onDismiss(item.id)}
                  className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-text-primary transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
