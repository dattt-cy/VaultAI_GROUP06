import React, { useCallback, useEffect, useState } from 'react';
import {
  Users, FileText, MessageSquare, Hash, Database, ThumbsDown,
  AlertTriangle, CheckCircle, RefreshCw, Upload, UserPlus, Activity,
} from 'lucide-react';
import { StatCard } from '../../components/admin/StatCard';
import { StatusBadge } from '../../components/admin/AdminTable';
import { PageHeader } from '../../components/admin/ui/PageHeader';
import { SkeletonStatCard, SkeletonPanel } from '../../components/admin/ui/Skeleton';
import { EmptyState } from '../../components/admin/ui/EmptyState';
import { useToast } from '../../components/admin/ui/Toast';
import { apiGet } from '../../utils/apiClient';
import { useNavigate } from 'react-router-dom';

interface FlaggedDoc {
  document_id: number;
  document_title: string;
  bad_count: number;
  unresolved_count: number;
}

interface OverviewData {
  total_users: number;
  total_documents: number;
  total_sessions: number;
  total_messages: number;
  chroma_status: string;
  chroma_vectors: number;
  ingestion_stats: { COMPLETED: number; PROCESSING: number; PENDING: number; FAILED: number };
  feedback_stats?: { total: number; pending: number; likes: number; dislikes: number; hallucinated: number };
}

const REFRESH_OPTIONS = [
  { label: 'Tắt',  value: 0 },
  { label: '30s',  value: 30_000 },
  { label: '1ph',  value: 60_000 },
  { label: '5ph',  value: 300_000 },
];

const OverviewPage: React.FC = () => {
  const [data, setData]       = useState<OverviewData | null>(null);
  const [flagged, setFlagged] = useState<FlaggedDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<number>(60_000);
  const navigate = useNavigate();
  const toast = useToast();

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const [overviewRes, flaggedRes] = await Promise.all([
        apiGet('/api/admin/overview'),
        apiGet('/api/admin/feedback/flagged-documents'),
      ]);
      if (overviewRes.ok) setData(await overviewRes.json());
      if (flaggedRes.ok) {
        const j = await flaggedRes.json();
        setFlagged(j.items ?? []);
      }
      setLastUpdated(new Date());
    } catch (err) {
      if (!silent) toast.error('Không tải được dữ liệu', String(err));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { fetchAll(true); }, [fetchAll]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval <= 0) return;
    const id = setInterval(() => fetchAll(true), refreshInterval);
    return () => clearInterval(id);
  }, [refreshInterval, fetchAll]);

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Tổng quan hệ thống" subtitle="Trạng thái và số liệu toàn cục" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}
        </div>
        <SkeletonPanel rows={4} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SkeletonPanel rows={2} />
          <SkeletonPanel rows={4} />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <>
        <PageHeader title="Tổng quan hệ thống" />
        <EmptyState
          icon={AlertTriangle}
          title="Không tải được dữ liệu"
          description="Kiểm tra kết nối tới backend rồi thử lại."
          action={
            <button
              onClick={() => fetchAll(false)}
              className="px-3 py-1.5 rounded-lg bg-accent text-white text-[12px] font-medium hover:bg-accent-hover transition-colors"
            >
              Thử lại
            </button>
          }
        />
      </>
    );
  }

  const {
    total_users, total_documents, total_sessions, total_messages,
    chroma_status, chroma_vectors, ingestion_stats, feedback_stats,
  } = data;
  const ingestionTotal = Object.values(ingestion_stats).reduce((a, b) => a + b, 0);
  const ingestionBars = [
    { label: 'Hoàn tất',  value: ingestion_stats.COMPLETED,  color: 'bg-success' },
    { label: 'Đang xử lý', value: ingestion_stats.PROCESSING, color: 'bg-accent'  },
    { label: 'Chờ',       value: ingestion_stats.PENDING,    color: 'bg-warning' },
    { label: 'Thất bại',  value: ingestion_stats.FAILED,     color: 'bg-danger'  },
  ];

  const pending = feedback_stats?.pending ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Tổng quan hệ thống"
        subtitle={
          lastUpdated
            ? `Cập nhật lúc ${lastUpdated.toLocaleTimeString('vi-VN')}`
            : 'Trạng thái và số liệu toàn cục'
        }
        actions={
          <>
            <div className="hidden md:flex items-center gap-1 bg-elevated border border-border rounded-lg p-0.5">
              {REFRESH_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setRefreshInterval(opt.value)}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer
                    ${refreshInterval === opt.value
                      ? 'bg-accent text-white'
                      : 'text-text-muted hover:text-text-primary hover:bg-hover'}`}
                  title={`Tự động làm mới: ${opt.label}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => fetchAll(false)}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-elevated border border-border text-text-secondary hover:text-text-primary hover:border-border/80 text-[12px] font-medium transition-colors cursor-pointer disabled:opacity-50"
              title="Làm mới"
              aria-label="Làm mới dữ liệu"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Làm mới</span>
            </button>
          </>
        }
      />

      {/* ── Quick actions ── */}
      <div className="flex flex-wrap items-center gap-2">
        <QuickAction icon={UserPlus} label="Thêm người dùng" onClick={() => navigate('/admin/users')} />
        <QuickAction icon={Upload}    label="Quản lý tài liệu" onClick={() => navigate('/admin/documents')} />
        <QuickAction icon={Activity}  label="Tài nguyên hệ thống" onClick={() => navigate('/admin/system-metrics')} />
        {pending > 0 && (
          <button
            onClick={() => navigate('/admin/feedback')}
            className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-danger/10 border border-danger/30 rounded-lg text-danger text-[12px] font-medium hover:bg-danger/20 transition-colors cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {pending} phản hồi cần xử lý
          </button>
        )}
      </div>

      {/* ── Stat grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Người dùng" value={total_users}     icon={Users}        color="accent"  onClick={() => navigate('/admin/users')} />
        <StatCard label="Tài liệu"   value={total_documents} icon={FileText}     color="success" onClick={() => navigate('/admin/documents')} />
        <StatCard label="Phiên chat" value={total_sessions}  icon={MessageSquare} color="warning" onClick={() => navigate('/admin/chat-monitor')} />
        <StatCard label="Tin nhắn"   value={total_messages}  icon={Hash}         color="neutral" />
      </div>

      {/* ── Feedback summary ── */}
      {feedback_stats && (
        <section className="bg-elevated border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[14px] font-semibold text-text-primary">Phản hồi người dùng</p>
              <p className="text-[12px] text-text-muted mt-0.5">Đánh giá AI từ end-user</p>
            </div>
            <button
              onClick={() => navigate('/admin/feedback')}
              className="text-[12px] text-accent hover:underline cursor-pointer font-medium"
            >
              Xem tất cả →
            </button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <FeedbackPill label="Tổng phản hồi" value={feedback_stats.total} tone="neutral" />
            <FeedbackPill label="Hài lòng"       value={feedback_stats.likes} tone="success" />
            <FeedbackPill label="Chưa tốt"       value={feedback_stats.dislikes} tone="warning" />
            <FeedbackPill label="Ảo giác AI"     value={feedback_stats.hallucinated} tone="danger" />
          </div>
          {pending > 0 && (
            <div className="mt-4 flex items-center gap-2 px-3 py-2.5 bg-danger/5 border border-danger/20 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 text-danger shrink-0" />
              <p className="text-[12px] text-danger">
                <span className="font-semibold">{pending}</span> phản hồi tiêu cực chưa được xử lý — kiểm tra tài liệu nguồn để cải thiện chất lượng AI
              </p>
            </div>
          )}
        </section>
      )}

      {/* ── Chroma + Ingestion ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-elevated border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Database className="w-4 h-4 text-text-secondary" />
            <p className="text-[14px] font-semibold text-text-primary">ChromaDB</p>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <StatusBadge status={chroma_status} />
            <span className="text-[12px] text-text-muted">Vector store</span>
          </div>
          <p className="text-[28px] font-bold text-text-primary tabular-nums leading-tight">
            {chroma_vectors >= 0 ? chroma_vectors.toLocaleString('vi-VN') : '—'}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">vectors đang lưu trữ</p>
        </section>

        <section className="bg-elevated border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[14px] font-semibold text-text-primary">Trạng thái ingestion</p>
            <span className="text-[11px] text-text-muted tabular-nums">{ingestionTotal} tài liệu</span>
          </div>
          {ingestionTotal === 0 ? (
            <EmptyState compact title="Chưa có tài liệu" description="Upload tài liệu để thấy phân bố trạng thái." icon={FileText} />
          ) : (
            <>
              {/* Stacked bar */}
              <div className="flex h-2 rounded-full overflow-hidden bg-border mb-3">
                {ingestionBars.map(bar => bar.value > 0 && (
                  <div
                    key={bar.label}
                    className={bar.color}
                    style={{ width: `${(bar.value / ingestionTotal) * 100}%` }}
                    title={`${bar.label}: ${bar.value}`}
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {ingestionBars.map(bar => (
                  <div key={bar.label} className="flex items-center gap-2 text-[12px]">
                    <span className={`w-2 h-2 rounded-full ${bar.color}`} />
                    <span className="text-text-muted flex-1">{bar.label}</span>
                    <span className="font-semibold text-text-primary tabular-nums">{bar.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      {/* ── Flagged docs ── */}
      {flagged.length > 0 && (
        <section className="bg-elevated border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <div className="flex items-center gap-2 min-w-0">
              <ThumbsDown className="w-3.5 h-3.5 text-warning flex-shrink-0" />
              <p className="text-[14px] font-semibold text-text-primary">Tài liệu cần cập nhật</p>
              <span className="text-[11px] text-text-muted truncate hidden sm:inline">— AI dùng các tài liệu này nhưng bị báo lỗi</span>
            </div>
            <button
              onClick={() => navigate('/admin/documents')}
              className="text-[12px] text-accent hover:underline cursor-pointer font-medium flex-shrink-0"
            >
              Quản lý →
            </button>
          </div>
          <div className="divide-y divide-border">
            {flagged.slice(0, 5).map(doc => (
              <button
                key={doc.document_id}
                onClick={() => navigate(`/admin/documents?highlight=${doc.document_id}`)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-hover transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-3.5 h-3.5 text-text-muted shrink-0" />
                  <span className="text-[13px] text-text-primary truncate">{doc.document_title}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  {doc.unresolved_count > 0 ? (
                    <span className="flex items-center gap-1 text-[11px] text-danger font-semibold">
                      <AlertTriangle className="w-3 h-3" />
                      {doc.unresolved_count} chưa xử lý
                    </span>
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5 text-success" />
                  )}
                  <span className="text-[11px] text-text-muted tabular-nums">{doc.bad_count} lần</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

// ── Local sub-components ──

const QuickAction: React.FC<{ icon: React.FC<any>; label: string; onClick: () => void }> = ({ icon: Icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-elevated border border-border text-text-secondary hover:text-text-primary hover:border-accent/40 hover:bg-accent/5 text-[12px] font-medium transition-colors cursor-pointer"
  >
    <Icon className="w-3.5 h-3.5" />
    {label}
  </button>
);

const TONE_CLASSES: Record<string, { num: string; bg: string }> = {
  neutral: { num: 'text-text-primary', bg: 'bg-surface' },
  success: { num: 'text-success',      bg: 'bg-success/8 border-success/20' },
  warning: { num: 'text-warning',      bg: 'bg-warning/8 border-warning/20' },
  danger:  { num: 'text-danger',       bg: 'bg-danger/8 border-danger/20' },
};

const FeedbackPill: React.FC<{ label: string; value: number; tone: keyof typeof TONE_CLASSES }> = ({ label, value, tone }) => {
  const t = TONE_CLASSES[tone];
  return (
    <div className={`border border-border rounded-lg px-3 py-3 ${t.bg}`}>
      <p className={`text-[24px] font-bold tabular-nums leading-tight ${t.num}`}>{value.toLocaleString('vi-VN')}</p>
      <p className="text-[11px] text-text-muted mt-1">{label}</p>
    </div>
  );
};

export default OverviewPage;
