import React, { useState } from 'react';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { mockAuditLogs } from '../../mocks/adminMocks';

type Log = typeof mockAuditLogs[0];

const ACTION_COLORS: Record<string, string> = {
  LOGIN:       'bg-accent/15 text-accent border-accent/30',
  LOGOUT:      'bg-border/20 text-text-muted border-border',
  UPLOAD_DOC:  'bg-success/15 text-success border-success/30',
  DELETE_DOC:  'bg-danger/15 text-danger border-danger/30',
  UPDATE_USER: 'bg-warning/15 text-warning border-warning/30',
};

const AuditLogsPage: React.FC = () => {
  const [logs] = useState(mockAuditLogs);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  const allActions = [...new Set(logs.map(l => l.action))];

  const filtered = logs.filter(l => {
    const q = search.toLowerCase();
    const matchQ = !q || l.user.toLowerCase().includes(q) || l.action.toLowerCase().includes(q);
    const matchAction = !filterAction || l.action === filterAction;
    return matchQ && matchAction;
  });

  const formatTime = (iso: string) => new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-[20px] font-bold text-text-primary">Nhật ký hoạt động</h1>
        <p className="text-[13px] text-text-muted mt-0.5">{filtered.length} bản ghi</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm user, action..." className="input-base pl-9 py-2" />
        </div>
        <select value={filterAction} onChange={e => setFilterAction(e.target.value)} className="input-base w-auto py-2">
          <option value="">Tất cả hành động</option>
          {allActions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="bg-elevated border border-border rounded-xl overflow-hidden">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-surface">
              {['Thời gian', 'Người dùng', 'Hành động', 'Đối tượng', 'IP', 'Chi tiết'].map(h => (
                <th key={h} className="px-4 py-2.5 text-[11px] font-semibold text-text-secondary uppercase tracking-wide border-b border-border whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(log => (
              <React.Fragment key={log.id}>
                <tr
                  className="border-b border-border hover:bg-hover/50 transition-colors cursor-pointer"
                  onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                >
                  <td className="px-4 py-3 text-[12px] text-text-muted font-mono whitespace-nowrap">{formatTime(log.timestamp)}</td>
                  <td className="px-4 py-3 text-[13px] font-semibold text-text-primary">{log.user}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${ACTION_COLORS[log.action] ?? 'bg-border/20 text-text-muted border-border'}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-text-muted">{log.entity_type} #{log.entity_id}</td>
                  <td className="px-4 py-3 text-[12px] font-mono text-text-muted">{log.ip_address}</td>
                  <td className="px-4 py-3">
                    {expanded === log.id
                      ? <ChevronDown className="w-4 h-4 text-text-muted" />
                      : <ChevronRight className="w-4 h-4 text-text-muted" />}
                  </td>
                </tr>
                {expanded === log.id && (
                  <tr className="border-b border-border bg-base/50">
                    <td colSpan={6} className="px-4 py-3">
                      <pre className="text-[12px] text-text-secondary font-mono bg-elevated p-3 rounded-lg overflow-x-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[13px] text-text-muted">Không có bản ghi</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditLogsPage;
