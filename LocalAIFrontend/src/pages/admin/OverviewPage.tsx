import React from 'react';
import { Users, FileText, MessageSquare, Hash, Database, Clock } from 'lucide-react';
import { StatCard } from '../../components/admin/StatCard';
import { StatusBadge } from '../../components/admin/AdminTable';
import { mockOverview, mockAuditLogs } from '../../mocks/adminMocks';

const OverviewPage: React.FC = () => {
  const { total_users, total_documents, total_sessions, total_messages, chroma_status, chroma_vectors, ingestion_stats } = mockOverview;

  const ingestionTotal = Object.values(ingestion_stats).reduce((a, b) => a + b, 0);

  const ingestionBars = [
    { label: 'Completed', value: ingestion_stats.COMPLETED, color: 'bg-success' },
    { label: 'Processing', value: ingestion_stats.PROCESSING, color: 'bg-accent' },
    { label: 'Pending',    value: ingestion_stats.PENDING,    color: 'bg-warning' },
    { label: 'Failed',     value: ingestion_stats.FAILED,     color: 'bg-danger' },
  ];

  const formatTime = (iso: string) => new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-[20px] font-bold text-text-primary">Tổng quan hệ thống</h1>
        <p className="text-[13px] text-text-muted mt-0.5">Trạng thái và số liệu toàn cục</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Người dùng" value={total_users} icon={Users} color="accent" />
        <StatCard label="Tài liệu" value={total_documents} icon={FileText} color="success" />
        <StatCard label="Phiên chat" value={total_sessions} icon={MessageSquare} color="warning" />
        <StatCard label="Tin nhắn" value={total_messages} icon={Hash} color="danger" />
      </div>

      {/* Second row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ChromaDB */}
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

        {/* Ingestion status */}
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

        {/* System metrics snapshot */}
        <div className="bg-elevated border border-border rounded-xl p-4">
          <p className="text-[13px] font-semibold text-text-primary mb-3">Tài nguyên hệ thống</p>
          {[
            { label: 'CPU', value: 23.4, unit: '%', max: 100, color: 'bg-accent' },
            { label: 'RAM', value: 4821, unit: 'MB', max: 16384, color: 'bg-success' },
            { label: 'VRAM', value: 5120, unit: 'MB', max: 8192, color: 'bg-warning' },
          ].map(m => (
            <div key={m.label} className="mb-2.5">
              <div className="flex justify-between text-[11px] text-text-muted mb-1">
                <span>{m.label}</span>
                <span className="font-semibold text-text-primary">{m.value} {m.unit}</span>
              </div>
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <div className={`h-full ${m.color} rounded-full`} style={{ width: `${(m.value / m.max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent audit log */}
      <div className="bg-elevated border border-border rounded-xl overflow-hidden">
        <div className="panel-header">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            <span>Hoạt động gần đây</span>
          </div>
        </div>
        <div className="divide-y divide-border">
          {mockAuditLogs.slice(0, 6).map(log => (
            <div key={log.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-hover/50 transition-colors">
              <span className="text-[11px] text-text-muted w-28 flex-shrink-0">{formatTime(log.timestamp)}</span>
              <span className="text-[12px] font-semibold text-accent w-32 flex-shrink-0 truncate">{log.action}</span>
              <span className="text-[12px] text-text-secondary flex-shrink-0">{log.user}</span>
              <span className="text-[12px] text-text-muted truncate">
                {log.details && Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join(', ')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OverviewPage;
