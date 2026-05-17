import React, { useEffect, useState } from 'react';
import { Users, FileText, MessageSquare, Hash, Database, Clock, ThumbsDown, AlertTriangle, CheckCircle } from 'lucide-react';
import { StatCard } from '../../components/admin/StatCard';
import { StatusBadge } from '../../components/admin/AdminTable';
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

const OverviewPage: React.FC = () => {
  const [data, setData]           = useState<OverviewData | null>(null);
  const [flagged, setFlagged]     = useState<FlaggedDoc[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    apiGet('/api/admin/overview').then(r => r.json()).then(setData).catch(console.error);
    apiGet('/api/admin/feedback/flagged-documents').then(r => r.json()).then(d => setFlagged(d.items ?? [])).catch(() => {});
  }, []);

  if (!data) {
    return <div className="flex items-center justify-center h-48 text-text-muted text-[13px]">Đang tải...</div>;
  }

  const { total_users, total_documents, total_sessions, total_messages, chroma_status, chroma_vectors, ingestion_stats, feedback_stats } = data;
  const ingestionTotal = Object.values(ingestion_stats).reduce((a, b) => a + b, 0);

  const ingestionBars = [
    { label: 'Completed', value: ingestion_stats.COMPLETED, color: 'bg-success' },
    { label: 'Processing', value: ingestion_stats.PROCESSING, color: 'bg-accent' },
    { label: 'Pending',    value: ingestion_stats.PENDING,    color: 'bg-warning' },
    { label: 'Failed',     value: ingestion_stats.FAILED,     color: 'bg-danger' },
  ];

  const pending = feedback_stats?.pending ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-text-primary">Tổng quan hệ thống</h1>
          <p className="text-[13px] text-text-muted mt-0.5">Trạng thái và số liệu toàn cục</p>
        </div>
        {pending > 0 && (
          <button
            onClick={() => navigate('/admin/feedback')}
            className="flex items-center gap-2 px-3 py-2 bg-danger/10 border border-danger/30 rounded-lg text-danger text-[12px] font-medium hover:bg-danger/20 transition-colors cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {pending} phản hồi cần xử lý
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Người dùng"  value={total_users}     icon={Users}         color="accent"   />
        <StatCard label="Tài liệu"    value={total_documents} icon={FileText}       color="success"  />
        <StatCard label="Phiên chat"  value={total_sessions}  icon={MessageSquare}  color="warning"  />
        <StatCard label="Tin nhắn"    value={total_messages}  icon={Hash}           color="danger"   />
      </div>

      {/* Feedback summary */}
      {feedback_stats && (
        <div className="bg-elevated border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] font-semibold text-text-primary">Phản hồi người dùng</p>
            <button
              onClick={() => navigate('/admin/feedback')}
              className="text-[11px] text-accent hover:underline cursor-pointer"
            >
              Xem tất cả →
            </button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Tổng phản hồi',   value: feedback_stats.total,       color: 'text-text-primary',  bg: 'bg-surface' },
              { label: 'Hài lòng',         value: feedback_stats.likes,       color: 'text-success',       bg: 'bg-success/10' },
              { label: 'Chưa tốt',         value: feedback_stats.dislikes,    color: 'text-warning',       bg: 'bg-warning/10' },
              { label: 'Ảo giác AI',       value: feedback_stats.hallucinated,color: 'text-danger',        bg: 'bg-danger/10'  },
            ].map(s => (
              <div key={s.label} className={`${s.bg} border border-border rounded-lg px-3 py-2.5 text-center`}>
                <p className={`text-[22px] font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[11px] text-text-muted mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          {pending > 0 && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-danger/5 border border-danger/20 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 text-danger shrink-0" />
              <p className="text-[12px] text-danger">
                <span className="font-semibold">{pending}</span> phản hồi tiêu cực chưa được xử lý — xem tài liệu nguồn để cải thiện AI
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-elevated border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Database className="w-4 h-4 text-text-secondary" />
            <p className="text-[13px] font-semibold text-text-primary">ChromaDB</p>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge status={chroma_status} />
            <span className="text-[12px] text-text-muted">Vector DB</span>
          </div>
          <p className="text-[22px] font-bold text-text-primary mt-2">{chroma_vectors.toLocaleString()}</p>
          <p className="text-[11px] text-text-muted">vectors đang lưu</p>
        </div>

        <div className="bg-elevated border border-border rounded-xl p-4">
          <p className="text-[13px] font-semibold text-text-primary mb-3">Trạng thái ingestion</p>
          <div className="space-y-2.5">
            {ingestionBars.map(bar => (
              <div key={bar.label}>
                <div className="flex justify-between text-[11px] text-text-muted mb-1">
                  <span>{bar.label}</span>
                  <span className="font-semibold text-text-primary">{bar.value}</span>
                </div>
                <div className="h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className={`h-full ${bar.color} rounded-full transition-all`}
                    style={{ width: ingestionTotal > 0 ? `${(bar.value / ingestionTotal) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Flagged documents */}
      {flagged.length > 0 && (
        <div className="bg-elevated border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <ThumbsDown className="w-3.5 h-3.5 text-warning" />
              <p className="text-[13px] font-semibold text-text-primary">Tài liệu cần cập nhật</p>
              <span className="text-[11px] text-text-muted">— AI đang dùng những tài liệu này để tạo câu trả lời bị báo lỗi</span>
            </div>
            <button
              onClick={() => navigate('/admin/documents')}
              className="text-[11px] text-accent hover:underline cursor-pointer"
            >
              Quản lý tài liệu →
            </button>
          </div>
          <div className="divide-y divide-border">
            {flagged.slice(0, 5).map(doc => (
              <div
                key={doc.document_id}
                className="flex items-center justify-between px-4 py-3 hover:bg-hover transition-colors cursor-pointer"
                onClick={() => navigate(`/admin/documents?highlight=${doc.document_id}`)}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-3.5 h-3.5 text-text-muted shrink-0" />
                  <span className="text-[13px] text-text-primary truncate">{doc.document_title}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  {doc.unresolved_count > 0 && (
                    <span className="flex items-center gap-1 text-[11px] text-danger font-medium">
                      <AlertTriangle className="w-3 h-3" />
                      {doc.unresolved_count} chưa xử lý
                    </span>
                  )}
                  <span className="text-[11px] text-text-muted">{doc.bad_count} lần bị báo</span>
                  {doc.unresolved_count === 0 && (
                    <CheckCircle className="w-3.5 h-3.5 text-success" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-elevated border border-border rounded-xl overflow-hidden">
        <div className="panel-header">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            <span>Hoạt động gần đây</span>
          </div>
        </div>
        <div className="px-4 py-6 text-center text-[13px] text-text-muted">
          Audit log sẽ hiển thị ở đây sau khi có dữ liệu
        </div>
      </div>
    </div>
  );
};

export default OverviewPage;
