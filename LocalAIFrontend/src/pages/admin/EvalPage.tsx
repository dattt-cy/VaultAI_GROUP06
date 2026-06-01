import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle, XCircle, AlertTriangle, PlayCircle,
  RefreshCw, Clock, FileSearch, Target, Zap, Award,
} from 'lucide-react';
import { PageHeader } from '../../components/admin/ui/PageHeader';
import { StatCard } from '../../components/admin/StatCard';
import { useToast } from '../../components/admin/ui/Toast';
import { SkeletonStatCard, SkeletonPanel } from '../../components/admin/ui/Skeleton';
import { apiGet, apiPost } from '../../utils/apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

interface EvalResult {
  id: string;
  category: string;
  question: string;
  source_doc: string;
  passed: boolean;
  is_out_of_scope: boolean;
  latency: number;
  has_citation: boolean;
  citation_ok: boolean;
  keyword_score: number;
  answer_preview: string;
  num_citations: number;
  error?: string;
}

interface EvalSummary {
  total: number;
  errors: number;
  passed: number;
  pass_rate: number;
  hit_rate: number;
  rejection_rate: number | null;
  keyword_score_avg: number;
  citation_accuracy: number;
  avg_latency: number;
}

interface EvalStatus {
  running: boolean;
  progress: number;
  total: number;
  error: string | null;
}

// ─── Category badge ───────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<string, string> = {
  fact_lookup:  'Tra cứu',
  multi_fact:   'Đa thông tin',
  threshold:    'Ngưỡng',
  procedure:    'Quy trình',
  security:     'Bảo mật',
  yes_no:       'Có/Không',
  multi_doc:    'Đa tài liệu',
  calculation:  'Tính toán',
  out_of_scope: 'Ngoài phạm vi',
};

const CategoryBadge: React.FC<{ category: string }> = ({ category }) => (
  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent/10 text-accent border border-accent/20">
    {CATEGORY_LABEL[category] ?? category}
  </span>
);

// ─── Row ─────────────────────────────────────────────────────────────────────

const ResultRow: React.FC<{ r: EvalResult; index: number }> = ({ r, index }) => {
  const [expanded, setExpanded] = useState(false);

  if (r.error) {
    return (
      <tr className="border-b border-border/40 bg-danger/5">
        <td className="px-4 py-3 text-[12px] font-mono text-text-muted">{r.id}</td>
        <td colSpan={6} className="px-4 py-3 text-[12px] text-danger">LỖI: {r.error}</td>
      </tr>
    );
  }

  const statusIcon = r.passed
    ? <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
    : <XCircle className="w-4 h-4 text-danger flex-shrink-0" />;

  return (
    <>
      <tr
        className={`border-b border-border/30 cursor-pointer transition-colors hover:bg-hover/60 ${index % 2 === 0 ? 'bg-surface' : 'bg-base'}`}
        onClick={() => setExpanded(e => !e)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {statusIcon}
            <span className="text-[12px] font-mono text-text-muted">{r.id}</span>
          </div>
        </td>
        <td className="px-4 py-3 max-w-[320px]">
          <p className="text-[13px] text-text-primary leading-snug line-clamp-2">{r.question}</p>
        </td>
        <td className="px-4 py-3"><CategoryBadge category={r.category} /></td>
        <td className="px-4 py-3 text-center">
          <span className={`text-[12px] font-semibold tabular-nums ${r.keyword_score >= 0.5 ? 'text-success' : 'text-danger'}`}>
            {(r.keyword_score * 100).toFixed(0)}%
          </span>
        </td>
        <td className="px-4 py-3 text-center">
          {r.citation_ok
            ? <CheckCircle className="w-4 h-4 text-success mx-auto" />
            : <AlertTriangle className="w-4 h-4 text-warning mx-auto" />}
        </td>
        <td className="px-4 py-3 text-center">
          <span className="text-[12px] text-text-secondary tabular-nums">{r.latency}s</span>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-border/30 bg-elevated">
          <td colSpan={6} className="px-6 py-4">
            <div className="space-y-2">
              <p className="text-[11px] text-text-muted uppercase tracking-wider font-semibold">Câu trả lời preview</p>
              <p className="text-[13px] text-text-secondary leading-relaxed whitespace-pre-wrap">{r.answer_preview}</p>
              <div className="flex gap-4 mt-2 text-[11px] text-text-muted">
                <span>Nguồn: <strong className="text-text-secondary">{r.source_doc}</strong></span>
                <span>Citations: <strong className="text-text-secondary">{r.num_citations}</strong></span>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const EvalPage: React.FC = () => {
  const [results, setResults]   = useState<EvalResult[]>([]);
  const [summary, setSummary]   = useState<EvalSummary | null>(null);
  const [hasReport, setHasReport] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus]     = useState<EvalStatus>({ running: false, progress: 0, total: 0, error: null });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toast = useToast();

  const fetchReport = useCallback(async () => {
    try {
      const res = await apiGet('/api/admin/eval/report');
      if (!res.ok) return;
      const data = await res.json();
      setHasReport(data.has_report);
      setResults(data.results ?? []);
      setSummary(data.summary ?? null);
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiGet('/api/admin/eval/status');
      if (!res.ok) return;
      const s: EvalStatus = await res.json();
      setStatus(s);
      if (!s.running) {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        fetchReport();
      }
    } catch { /* ignore */ }
  }, [fetchReport]);

  useEffect(() => {
    fetchReport();
    fetchStatus();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchReport, fetchStatus]);

  const handleRunEval = async () => {
    try {
      const res = await apiPost('/api/admin/eval/run');
      const data = await res.json();
      if (data.started) {
        toast.success('Đã bắt đầu đánh giá. Quá trình mất ~10 phút.');
        setStatus(s => ({ ...s, running: true }));
        pollRef.current = setInterval(fetchStatus, 5000);
      } else {
        toast.warning(data.message);
      }
    } catch {
      toast.error('Không thể khởi động đánh giá.');
    }
  };

  const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Đánh giá RAG Pipeline"
        subtitle="Kiểm thử độ chính xác của hệ thống truy xuất và trả lời tự động."
        actions={
          <div className="flex items-center gap-2">
            {status.running && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20">
                <RefreshCw className="w-3.5 h-3.5 text-accent animate-spin" />
                <span className="text-[12px] text-accent font-medium">
                  Đang chạy {status.progress}/{status.total}...
                </span>
              </div>
            )}
            <button
              onClick={handleRunEval}
              disabled={status.running}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-[13px] font-medium
                         hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <PlayCircle className="w-4 h-4" />
              {status.running ? 'Đang chạy...' : 'Chạy đánh giá'}
            </button>
          </div>
        }
      />

      {/* Progress bar khi đang chạy */}
      {status.running && status.total > 0 && (
        <div className="w-full bg-border rounded-full h-2 overflow-hidden">
          <div
            className="bg-accent h-2 rounded-full transition-all duration-500"
            style={{ width: `${(status.progress / status.total) * 100}%` }}
          />
        </div>
      )}

      {isLoading ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}
          </div>
          <SkeletonPanel />
        </>
      ) : !hasReport ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-elevated border border-border flex items-center justify-center">
            <FileSearch className="w-8 h-8 text-text-muted opacity-50" />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-text-primary mb-1">Chưa có kết quả đánh giá</p>
            <p className="text-[13px] text-text-muted max-w-[320px] leading-relaxed">
              Nhấn <strong>Chạy đánh giá</strong> để kiểm thử hệ thống RAG với {15} câu hỏi mẫu.
              Quá trình mất khoảng 10 phút.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Pass Rate"
                value={pct(summary.pass_rate)}
                sub={`${summary.passed}/${summary.total} câu hỏi`}
                icon={Award}
                color="success"
              />
              <StatCard
                label="Hit Rate"
                value={pct(summary.hit_rate)}
                sub="Tỷ lệ tìm thấy trong tài liệu"
                icon={Target}
                color="accent"
              />
              <StatCard
                label="Keyword Score"
                value={pct(summary.keyword_score_avg)}
                sub="Độ chính xác từ khóa kỳ vọng"
                icon={CheckCircle}
                color={summary.keyword_score_avg >= 0.7 ? 'success' : 'warning'}
              />
              <StatCard
                label="Latency TB"
                value={`${summary.avg_latency}s`}
                sub="Thời gian phản hồi trung bình"
                icon={Clock}
                color="neutral"
              />
            </div>
          )}

          {/* Secondary stats */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="card p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-4.5 h-4.5 text-success" />
                </div>
                <div>
                  <p className="text-[11px] text-text-muted uppercase tracking-wider font-semibold">Rejection Rate</p>
                  <p className="text-[20px] font-bold text-text-primary tabular-nums">
                    {summary.rejection_rate != null ? pct(summary.rejection_rate) : 'N/A'}
                  </p>
                  <p className="text-[11px] text-text-muted">Từ chối câu hỏi ngoài phạm vi</p>
                </div>
              </div>
              <div className="card p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <FileSearch className="w-4.5 h-4.5 text-accent" />
                </div>
                <div>
                  <p className="text-[11px] text-text-muted uppercase tracking-wider font-semibold">Citation Accuracy</p>
                  <p className="text-[20px] font-bold text-text-primary tabular-nums">{pct(summary.citation_accuracy)}</p>
                  <p className="text-[11px] text-text-muted">Câu trả lời có/không citation đúng kỳ vọng</p>
                </div>
              </div>
              <div className="card p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-4.5 h-4.5 text-warning" />
                </div>
                <div>
                  <p className="text-[11px] text-text-muted uppercase tracking-wider font-semibold">Lỗi hệ thống</p>
                  <p className="text-[20px] font-bold text-text-primary tabular-nums">{summary.errors}</p>
                  <p className="text-[11px] text-text-muted">Câu hỏi gây exception</p>
                </div>
              </div>
            </div>
          )}

          {/* Detail table */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-text-primary">Chi tiết từng câu hỏi</h3>
              <p className="text-[12px] text-text-muted">Click vào hàng để xem câu trả lời</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-elevated">
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider">ID</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider">Câu hỏi</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider">Loại</th>
                    <th className="px-4 py-2.5 text-center text-[11px] font-semibold text-text-muted uppercase tracking-wider">Keyword</th>
                    <th className="px-4 py-2.5 text-center text-[11px] font-semibold text-text-muted uppercase tracking-wider">Citation</th>
                    <th className="px-4 py-2.5 text-center text-[11px] font-semibold text-text-muted uppercase tracking-wider">Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => <ResultRow key={r.id} r={r} index={i} />)}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default EvalPage;
