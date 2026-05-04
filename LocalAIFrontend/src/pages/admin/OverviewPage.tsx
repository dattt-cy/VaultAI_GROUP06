import React, { useEffect, useState } from 'react';
import { Users, FileText, MessageSquare, Hash, Database, Clock } from 'lucide-react';
import { StatCard } from '../../components/admin/StatCard';
import { StatusBadge } from '../../components/admin/AdminTable';
import { apiGet } from '../../utils/apiClient';

interface OverviewData {
  total_users: number;
  total_documents: number;
  total_sessions: number;
  total_messages: number;
  chroma_status: string;
  chroma_vectors: number;
  ingestion_stats: { COMPLETED: number; PROCESSING: number; PENDING: number; FAILED: number };
}

const OverviewPage: React.FC = () => {
  const [data, setData] = useState<OverviewData | null>(null);

  useEffect(() => {
    apiGet('/api/admin/overview').then(r => r.json()).then(setData).catch(console.error);
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-48 text-text-muted text-[13px]">
        Đang tải...
      </div>
    );
  }

  const { total_users, total_documents, total_sessions, total_messages, chroma_status, chroma_vectors, ingestion_stats } = data;
  const ingestionTotal = Object.values(ingestion_stats).reduce((a, b) => a + b, 0);

  const ingestionBars = [
    { label: 'Completed', value: ingestion_stats.COMPLETED, color: 'bg-success' },
    { label: 'Processing', value: ingestion_stats.PROCESSING, color: 'bg-accent' },
    { label: 'Pending',    value: ingestion_stats.PENDING,    color: 'bg-warning' },
    { label: 'Failed',     value: ingestion_stats.FAILED,     color: 'bg-danger' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-[20px] font-bold text-text-primary">Tổng quan hệ thống</h1>
        <p className="text-[13px] text-text-muted mt-0.5">Trạng thái và số liệu toàn cục</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Người dùng" value={total_users} icon={Users} color="accent" />
        <StatCard label="Tài liệu" value={total_documents} icon={FileText} color="success" />
        <StatCard label="Phiên chat" value={total_sessions} icon={MessageSquare} color="warning" />
        <StatCard label="Tin nhắn" value={total_messages} icon={Hash} color="danger" />
      </div>

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
