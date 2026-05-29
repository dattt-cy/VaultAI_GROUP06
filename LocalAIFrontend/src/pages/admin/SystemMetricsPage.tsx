import React, { useState, useEffect, useCallback } from 'react';
import { Cpu, Zap, RefreshCw, Wifi, WifiOff, Activity } from 'lucide-react';
import { apiGet } from '../../utils/apiClient';
import { PageHeader } from '../../components/admin/ui/PageHeader';
import { SkeletonStatCard, SkeletonPanel } from '../../components/admin/ui/Skeleton';
import { useToast } from '../../components/admin/ui/Toast';

interface MetricsData {
  cpu_percent: number;
  ram_used_mb: number;
  ram_total_mb: number;
  vram_used_mb: number;
  vram_total_mb: number;
  ollama: { url: string; model: string; online: boolean };
}

interface HistoryPoint { cpu: number; ram: number; vram: number; timestamp: string }

const MetricBar: React.FC<{ label: string; used: number; total: number; unit: string; color: string }> = ({ label, used, total, unit, color }) => {
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
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
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(false);

  const toast = useToast();
  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet('/api/admin/system/metrics');
      const data: MetricsData = await res.json();
      setMetrics(data);
      setLastRefresh(new Date());
      setHistory(prev => {
        const point: HistoryPoint = {
          cpu: data.cpu_percent,
          ram: data.ram_used_mb,
          vram: data.vram_used_mb,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        };
        return [...prev.slice(-11), point];
      });
    } catch (e) {
      toast.error('Không tải được số liệu hệ thống', String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchMetrics, 5000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchMetrics]);

  if (!metrics) {
    return (
      <div className="space-y-5 animate-fade-in">
        <PageHeader title="Tài nguyên hệ thống" subtitle="Theo dõi CPU / RAM / GPU thời gian thực" icon={<Activity className="w-5 h-5 text-text-secondary" />} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonStatCard key={i} />)}
        </div>
        <SkeletonPanel rows={3} />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Tài nguyên hệ thống"
        subtitle={`Cập nhật lúc ${lastRefresh.toLocaleTimeString('vi-VN')}`}
        icon={<Activity className="w-5 h-5 text-text-secondary" />}
        actions={
          <>
            <button
              onClick={fetchMetrics}
              disabled={loading}
              aria-label="Làm mới"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-elevated border border-border text-text-secondary hover:text-text-primary hover:border-border/80 text-[12px] font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Làm mới
            </button>
            <button
              onClick={() => setAutoRefresh(a => !a)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-colors cursor-pointer
                ${autoRefresh
                  ? 'border-success/40 text-success bg-success/10'
                  : 'border-border bg-elevated text-text-muted hover:bg-hover hover:text-text-primary'}`}
              aria-pressed={autoRefresh}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-success animate-pulse' : 'bg-text-muted'}`} />
              {autoRefresh ? 'Tự động (5s)' : 'Tự động: Tắt'}
            </button>
          </>
        }
      />

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
        {metrics.vram_total_mb > 0
          ? <MetricBar label="VRAM (GPU)" used={metrics.vram_used_mb} total={metrics.vram_total_mb} unit="MB" color="bg-warning" />
          : (
            <div className="bg-elevated border border-border rounded-xl p-4 flex items-center gap-3">
              <Zap className="w-5 h-5 text-text-muted" />
              <div>
                <p className="text-[13px] font-semibold text-text-primary">VRAM (GPU)</p>
                <p className="text-[12px] text-text-muted">Không phát hiện GPU</p>
              </div>
            </div>
          )
        }
      </div>

      {history.length > 1 && (
        <>
          <div className="bg-elevated border border-border rounded-xl p-5">
            <p className="text-[13px] font-semibold text-text-primary mb-4">CPU Usage — lịch sử</p>
            <div className="flex items-end gap-1.5 h-24">
              {history.map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t bg-accent/60 hover:bg-accent transition-colors" style={{ height: `${(h.cpu / 100) * 96}px` }} title={`CPU: ${h.cpu.toFixed(1)}%`} />
                  <span className="text-[10px] text-text-muted">{h.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[
              { label: 'RAM Usage (MB)', key: 'ram' as const, max: metrics.ram_total_mb, color: 'bg-success/60 hover:bg-success' },
              { label: 'VRAM Usage (MB)', key: 'vram' as const, max: metrics.vram_total_mb || 1, color: 'bg-warning/60 hover:bg-warning' },
            ].map(({ label, key, max, color }) => (
              <div key={key} className="bg-elevated border border-border rounded-xl p-5">
                <p className="text-[13px] font-semibold text-text-primary mb-4">{label}</p>
                <div className="flex items-end gap-1.5 h-20">
                  {history.map((h, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className={`w-full rounded-t ${color} transition-colors`} style={{ height: `${(h[key] / max) * 80}px` }} title={`${h[key]} MB`} />
                      <span className="text-[10px] text-text-muted">{h.timestamp}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="bg-elevated border border-border rounded-xl p-4 flex items-center gap-4">
        <div className={`p-2.5 rounded-lg ${metrics.ollama.online ? 'bg-success/15' : 'bg-danger/15'}`}>
          {metrics.ollama.online ? <Wifi className="w-5 h-5 text-success" /> : <WifiOff className="w-5 h-5 text-danger" />}
        </div>
        <div>
          <p className="text-[13px] font-semibold text-text-primary">Ollama Service</p>
          <p className="text-[12px] text-text-muted">{metrics.ollama.url} · Model: {metrics.ollama.model}</p>
        </div>
        <span className={`ml-auto text-[11px] px-2.5 py-1 rounded-full font-semibold border ${metrics.ollama.online ? 'bg-success/15 text-success border-success/30' : 'bg-danger/15 text-danger border-danger/30'}`}>
          {metrics.ollama.online ? 'Online' : 'Offline'}
        </span>
      </div>
    </div>
  );
};

export default SystemMetricsPage;
