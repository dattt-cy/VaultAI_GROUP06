import React, { useState, useEffect } from 'react';
import { Cpu, HardDrive, Zap, RefreshCw, Wifi } from 'lucide-react';
import { mockSystemMetrics } from '../../mocks/adminMocks';

const MetricBar: React.FC<{ label: string; used: number; total: number; unit: string; color: string }> = ({ label, used, total, unit, color }) => {
  const pct = Math.round((used / total) * 100);
  return (
    <div className="bg-elevated border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] font-semibold text-text-primary">{label}</p>
        <span className="text-[11px] text-text-muted">{used} / {total} {unit}</span>
      </div>
      <div className="h-3 bg-border rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[22px] font-bold text-text-primary mt-2">{pct}%</p>
    </div>
  );
};

const SystemMetricsPage: React.FC = () => {
  const [metrics, setMetrics] = useState(mockSystemMetrics.current);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const history = mockSystemMetrics.history;

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        cpu_percent: Math.max(5, Math.min(95, prev.cpu_percent + (Math.random() - 0.5) * 10)),
        ram_used_mb: Math.max(3000, Math.min(14000, prev.ram_used_mb + Math.round((Math.random() - 0.5) * 200))),
        vram_used_mb: Math.max(2000, Math.min(7500, prev.vram_used_mb + Math.round((Math.random() - 0.5) * 100))),
        timestamp: new Date().toISOString(),
      }));
      setLastRefresh(new Date());
    }, 5000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  const maxBar = Math.max(...history.map(h => h.cpu));

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-text-primary">Tài nguyên hệ thống</h1>
          <p className="text-[13px] text-text-muted mt-0.5">Cập nhật lúc {lastRefresh.toLocaleTimeString('vi-VN')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(a => !a)}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-[12px] font-medium transition-colors ${autoRefresh ? 'border-success/40 text-success bg-success/10' : 'border-border text-text-muted hover:bg-hover'}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin-fast' : ''}`} />
            {autoRefresh ? 'Auto refresh ON' : 'Auto refresh OFF'}
          </button>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-elevated border border-border rounded-xl p-4 flex items-center gap-4">
          <div className="p-2.5 rounded-lg bg-accent/15"><Cpu className="w-5 h-5 text-accent" /></div>
          <div className="flex-1">
            <p className="text-[11px] text-text-muted uppercase tracking-wide">CPU</p>
            <p className="text-[22px] font-bold text-text-primary">{metrics.cpu_percent.toFixed(1)}%</p>
            <div className="h-1.5 bg-border rounded-full mt-1.5 overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${metrics.cpu_percent}%` }} />
            </div>
          </div>
        </div>
        <MetricBar label="RAM" used={metrics.ram_used_mb} total={metrics.ram_total_mb} unit="MB" color="bg-success" />
        <MetricBar label="VRAM (GPU)" used={metrics.vram_used_mb} total={metrics.vram_total_mb} unit="MB" color="bg-warning" />
      </div>

      {/* CPU history chart */}
      <div className="bg-elevated border border-border rounded-xl p-5">
        <p className="text-[13px] font-semibold text-text-primary mb-4">CPU Usage — lịch sử</p>
        <div className="flex items-end gap-1.5 h-24">
          {history.map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-accent/60 hover:bg-accent transition-colors"
                style={{ height: `${(h.cpu / 100) * 96}px` }}
                title={`CPU: ${h.cpu}%`}
              />
              <span className="text-[10px] text-text-muted">{h.timestamp}</span>
            </div>
          ))}
        </div>
      </div>

      {/* RAM & VRAM history */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[
          { label: 'RAM Usage (MB)', key: 'ram' as const, max: metrics.ram_total_mb, color: 'bg-success/60 hover:bg-success' },
          { label: 'VRAM Usage (MB)', key: 'vram' as const, max: metrics.vram_total_mb, color: 'bg-warning/60 hover:bg-warning' },
        ].map(({ label, key, max, color }) => (
          <div key={key} className="bg-elevated border border-border rounded-xl p-5">
            <p className="text-[13px] font-semibold text-text-primary mb-4">{label}</p>
            <div className="flex items-end gap-1.5 h-20">
              {history.map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-t ${color} transition-colors`}
                    style={{ height: `${(h[key] / max) * 80}px` }}
                    title={`${h[key]} MB`}
                  />
                  <span className="text-[10px] text-text-muted">{h.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Ollama status */}
      <div className="bg-elevated border border-border rounded-xl p-4 flex items-center gap-4">
        <div className="p-2.5 rounded-lg bg-success/15"><Wifi className="w-5 h-5 text-success" /></div>
        <div>
          <p className="text-[13px] font-semibold text-text-primary">Ollama Service</p>
          <p className="text-[12px] text-text-muted">http://localhost:11434 · Model: qwen2.5:7b · Đang chạy</p>
        </div>
        <span className="ml-auto text-[11px] px-2.5 py-1 rounded-full bg-success/15 text-success border border-success/30 font-semibold">Online</span>
      </div>
    </div>
  );
};

export default SystemMetricsPage;
