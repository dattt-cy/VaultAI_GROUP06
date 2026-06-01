import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X, XCircle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextType {
  show: (t: Omit<Toast, 'id'>) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
};

const TYPE_META: Record<ToastType, { icon: typeof CheckCircle2; cls: string }> = {
  success: { icon: CheckCircle2, cls: 'border-success/40 bg-success/10 text-success' },
  error:   { icon: XCircle,      cls: 'border-danger/40 bg-danger/10 text-danger' },
  warning: { icon: AlertTriangle,cls: 'border-warning/40 bg-warning/10 text-warning' },
  info:    { icon: Info,         cls: 'border-accent/40 bg-accent/10 text-accent' },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const show = useCallback((t: Omit<Toast, 'id'>) => {
    const id = ++counter.current;
    const duration = t.duration ?? 4000;
    setToasts(prev => [...prev, { ...t, id }]);
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
  }, [dismiss]);

  const ctx: ToastContextType = React.useMemo(() => ({
    show,
    success: (title, description) => show({ type: 'success', title, description }),
    error:   (title, description) => show({ type: 'error',   title, description }),
    warning: (title, description) => show({ type: 'warning', title, description }),
    info:    (title, description) => show({ type: 'info',    title, description }),
  }), [show]);

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div
        className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map(t => {
          const meta = TYPE_META[t.type];
          const Icon = meta.icon;
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-2.5 min-w-[280px] max-w-[400px] px-3.5 py-2.5 rounded-xl border bg-surface shadow-lg backdrop-blur-sm animate-fade-in ${meta.cls}`}
            >
              <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-text-primary">{t.title}</p>
                {t.description && <p className="text-[12px] text-text-muted mt-0.5 break-words">{t.description}</p>}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Đóng thông báo"
                className="text-text-muted hover:text-text-primary transition-colors flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

/** Hook that auto-mounts a one-shot toast on mount — convenience. */
export const useOneShotToast = (toast: Omit<Toast, 'id'> | null) => {
  const { show } = useToast();
  useEffect(() => {
    if (toast) show(toast);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast?.title]);
};
