import React, { useState, useEffect, useCallback } from 'react';
import {
  ThumbsUp, ThumbsDown, AlertTriangle, FileText,
  CheckCircle, ExternalLink, X, MessageSquare, Bot, Inbox,
} from 'lucide-react';
import { apiGet, apiPatch } from '../../utils/apiClient';
import { useNavigate } from 'react-router-dom';
import { DocumentViewer } from '../../components/document-panel/DocumentViewer';
import type { HighlightState } from '../../hooks/useDocumentHighlight';
import { PageHeader } from '../../components/admin/ui/PageHeader';
import { SkeletonPanel } from '../../components/admin/ui/Skeleton';
import { EmptyState } from '../../components/admin/ui/EmptyState';
import { useToast } from '../../components/admin/ui/Toast';

interface FeedbackCitation {
  document_id: number;
  document_title: string;
  chunk_index: number;
  excerpt: string;
  relevant_spans: string[];
}

interface FeedbackItem {
  id: number;
  message_id: number;
  reaction: string;
  user_comment: string;
  corrected_text: string;
  resolved: boolean;
  created_at: string;
  user_question: string | null;
  ai_answer: string | null;
  citations: FeedbackCitation[];
}

const REACTION_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  LIKE:         { label: 'Hài lòng',  color: 'text-success',  bg: 'bg-success/15',  border: 'border-success/30' },
  DISLIKE:      { label: 'Chưa tốt',  color: 'text-warning',  bg: 'bg-warning/15',  border: 'border-warning/30' },
  HALLUCINATED: { label: 'Ảo giác AI', color: 'text-danger',  bg: 'bg-danger/15',   border: 'border-danger/30'  },
};

const ReactionBadge: React.FC<{ reaction: string }> = ({ reaction }) => {
  const m = REACTION_META[reaction] ?? { label: reaction, color: 'text-text-secondary', bg: 'bg-border/20', border: 'border-border' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${m.bg} ${m.color} ${m.border}`}>
      {m.label}
    </span>
  );
};

const FeedbackPage: React.FC = () => {
  const [feedbacks, setFeedbacks]   = useState<FeedbackItem[]>([]);
  const [filter, setFilter]         = useState('');
  const [total, setTotal]           = useState(0);
  const [selected, setSelected]     = useState<FeedbackItem | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ title: string; chunkIndex: number; excerpt: string } | null>(null);
  const [isLoading, setIsLoading]   = useState(true);
  const navigate = useNavigate();
  const toast = useToast();

  const fetchFeedback = useCallback(async () => {
    try {
      const res  = await apiGet('/api/admin/feedback?limit=200');
      const data = await res.json();
      setFeedbacks(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      toast.error('Không tải được phản hồi', String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchFeedback(); }, [fetchFeedback]);

  const handleResolve = async (id: number) => {
    try {
      await apiPatch(`/api/admin/feedback/${id}/resolve`);
      setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, resolved: !f.resolved } : f));
      setSelected(prev => prev?.id === id ? { ...prev, resolved: !prev.resolved } : prev);
      toast.success('Đã cập nhật trạng thái phản hồi');
    } catch (err) {
      toast.error('Không cập nhật được', String(err));
    }
  };

  const likes        = feedbacks.filter(f => f.reaction === 'LIKE').length;
  const dislikes     = feedbacks.filter(f => f.reaction === 'DISLIKE').length;
  const hallucinated = feedbacks.filter(f => f.reaction === 'HALLUCINATED').length;
  const pending      = feedbacks.filter(f => f.reaction !== 'LIKE' && !f.resolved).length;

  const filtered = feedbacks.filter(f => !filter || f.reaction === filter);

  const fmt = (iso: string) => new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <PageHeader title="Phản hồi người dùng" subtitle="Đánh giá chất lượng câu trả lời của AI" />
        <SkeletonPanel rows={5} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4 animate-fade-in">
      <PageHeader
        title="Phản hồi người dùng"
        subtitle={`Đánh giá chất lượng câu trả lời của AI · ${total.toLocaleString('vi-VN')} phản hồi`}
        actions={
          pending > 0 ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-danger/10 text-danger border border-danger/30 rounded-full text-[11px] font-semibold">
              <AlertTriangle className="w-3 h-3" />
              {pending} cần xử lý
            </span>
          ) : null
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Hài lòng',       value: likes,        icon: ThumbsUp,      bg: 'bg-success/8',  border: 'border-success/20', text: 'text-success' },
          { label: 'Không hài lòng', value: dislikes,     icon: ThumbsDown,    bg: 'bg-warning/8',  border: 'border-warning/20', text: 'text-warning' },
          { label: 'Ảo giác AI',     value: hallucinated, icon: AlertTriangle, bg: 'bg-danger/8',   border: 'border-danger/20',  text: 'text-danger'  },
        ].map(s => (
          <div key={s.label} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${s.bg} ${s.border}`}>
            <div className={`p-2 rounded-lg bg-surface ${s.text} flex-shrink-0`}>
              <s.icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-text-muted uppercase tracking-wide font-semibold">{s.label}</p>
              <p className={`text-[20px] font-bold ${s.text} tabular-nums leading-tight`}>{s.value.toLocaleString('vi-VN')}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[
          { key: '',            label: 'Tất cả' },
          { key: 'LIKE',        label: 'Hài lòng' },
          { key: 'DISLIKE',     label: 'Chưa tốt' },
          { key: 'HALLUCINATED',label: 'Ảo giác AI' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors cursor-pointer
              ${filter === key ? 'bg-accent text-white border-accent' : 'border-border text-text-secondary hover:bg-hover'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Split layout */}
      <div className="flex gap-4 flex-1 min-h-0" style={{ minHeight: 400 }}>

        {/* LEFT — list */}
        <div className={`flex flex-col rounded-xl border border-border overflow-hidden transition-all duration-200 ${selected ? 'w-[45%]' : 'w-full'}`}>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 && (
              <EmptyState
                icon={Inbox}
                title="Không có phản hồi nào"
                description={filter ? 'Thử bỏ bộ lọc để xem toàn bộ phản hồi.' : 'Chưa có người dùng nào để lại phản hồi.'}
                compact
              />
            )}
            {filtered.map(f => {
              const isActive = selected?.id === f.id;
              const needsAction = f.reaction !== 'LIKE' && !f.resolved;
              return (
                <div
                  key={f.id}
                  onClick={() => setSelected(isActive ? null : f)}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 cursor-pointer transition-colors
                    ${isActive ? 'bg-accent/10 border-l-2 border-l-accent' : 'hover:bg-hover'}`}
                >
                  {/* Reaction icon */}
                  <div className={`mt-0.5 shrink-0 w-7 h-7 rounded-full flex items-center justify-center
                    ${f.reaction === 'LIKE' ? 'bg-success/15' : f.reaction === 'DISLIKE' ? 'bg-warning/15' : 'bg-danger/15'}`}>
                    {f.reaction === 'LIKE'
                      ? <ThumbsUp className="w-3.5 h-3.5 text-success" />
                      : f.reaction === 'DISLIKE'
                      ? <ThumbsDown className="w-3.5 h-3.5 text-warning" />
                      : <AlertTriangle className="w-3.5 h-3.5 text-danger" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-text-primary truncate font-medium">
                      {f.user_question
                        ? (f.user_question.length > 60 ? f.user_question.slice(0, 60) + '…' : f.user_question)
                        : <span className="text-text-muted font-mono">#{f.message_id}</span>}
                    </p>
                    {f.user_comment && (
                      <p className="text-[11px] text-text-muted truncate mt-0.5">{f.user_comment}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-text-muted">{fmt(f.created_at)}</span>
                      {f.resolved
                        ? <span className="text-[10px] text-success font-medium">✓ Đã xử lý</span>
                        : needsAction
                        ? <span className="text-[10px] text-danger font-medium">● Cần xử lý</span>
                        : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT — detail panel */}
        {selected && (
          <div className="flex-1 rounded-xl border border-border overflow-hidden flex flex-col">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface shrink-0">
              <div className="flex items-center gap-2">
                <ReactionBadge reaction={selected.reaction} />
                {selected.resolved
                  ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-success/15 text-success border-success/30">
                      <CheckCircle className="w-3 h-3" /> Đã xử lý
                    </span>
                  : selected.reaction !== 'LIKE'
                  ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-danger/10 text-danger border-danger/30">
                      Cần xử lý
                    </span>
                  : null}
                <span className="text-[11px] text-text-muted">{fmt(selected.created_at)}</span>
              </div>
              <button onClick={() => setSelected(null)} className="text-text-muted hover:text-text-secondary transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Panel body */}
            <div className="overflow-y-auto flex-1 p-4 space-y-4">

              {/* User question */}
              {selected.user_question && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-accent" />
                    <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">Câu hỏi người dùng</p>
                  </div>
                  <div className="bg-accent/5 border border-accent/20 rounded-lg px-3 py-2.5">
                    <p className="text-[13px] text-text-primary">{selected.user_question}</p>
                  </div>
                </div>
              )}

              {/* User comment */}
              {selected.user_comment && (
                <div>
                  <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1.5">Phản hồi của người dùng</p>
                  <div className={`border rounded-lg px-3 py-2.5 ${
                    selected.reaction === 'LIKE' ? 'bg-success/5 border-success/20' :
                    selected.reaction === 'HALLUCINATED' ? 'bg-danger/5 border-danger/20' :
                    'bg-warning/5 border-warning/20'
                  }`}>
                    <p className="text-[13px] text-text-primary">{selected.user_comment}</p>
                  </div>
                </div>
              )}

              {/* AI answer */}
              {selected.ai_answer && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Bot className="w-3.5 h-3.5 text-text-muted" />
                    <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">Câu trả lời AI</p>
                  </div>
                  <div className="bg-surface border border-border rounded-lg px-3 py-2.5 max-h-44 overflow-y-auto">
                    <p className="text-[12px] text-text-secondary whitespace-pre-wrap leading-relaxed">{selected.ai_answer}</p>
                  </div>
                </div>
              )}

              {/* Citations */}
              {selected.citations.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-2">
                    Tài liệu AI đã dùng ({selected.citations.length} nguồn)
                  </p>
                  <div className="space-y-2">
                    {selected.citations.map((c, i) => (
                      <div key={i} className="bg-surface border border-border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <FileText className="w-3.5 h-3.5 text-accent shrink-0" />
                            <span className="text-[12px] font-medium text-text-primary truncate">{c.document_title}</span>
                            <span className="text-[10px] text-text-muted shrink-0">chunk #{c.chunk_index}</span>
                          </div>
                          <button
                            onClick={() => setPreviewDoc({ title: c.document_title, chunkIndex: c.chunk_index, excerpt: c.excerpt ?? '' })}
                            className="flex items-center gap-1 text-[11px] text-accent hover:underline cursor-pointer shrink-0 ml-2"
                          >
                            <ExternalLink className="w-3 h-3" /> Xem tài liệu
                          </button>
                        </div>
                        {c.excerpt && (
                          <p className="text-[11px] text-text-secondary bg-elevated rounded px-2 py-1.5 line-clamp-3 leading-relaxed">
                            {c.excerpt}
                          </p>
                        )}
                        {c.relevant_spans.length > 0 && (
                          <div className="mt-1.5 space-y-1">
                            <p className="text-[10px] text-text-muted">Đoạn AI đã trích dẫn:</p>
                            {c.relevant_spans.map((span, j) => (
                              <p key={j} className="text-[11px] bg-warning/10 border border-warning/20 text-warning px-2 py-1 rounded italic">
                                "{span}"
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Panel footer — actions */}
            {selected.reaction !== 'LIKE' && (
              <div className="shrink-0 border-t border-border px-4 py-3 bg-surface flex items-center justify-between gap-3">
                <p className="text-[12px] text-text-muted">
                  {selected.resolved
                    ? 'Đã xử lý — cập nhật tài liệu nguồn để AI cải thiện.'
                    : 'Xem tài liệu nguồn → cập nhật nội dung sai → AI tự cải thiện lần sau.'}
                </p>
                <button
                  onClick={() => handleResolve(selected.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium border transition-colors cursor-pointer shrink-0
                    ${selected.resolved
                      ? 'border-border text-text-secondary hover:bg-hover'
                      : 'bg-success text-white border-success hover:bg-success/90'}`}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  {selected.resolved ? 'Bỏ đánh dấu' : 'Đánh dấu đã xử lý'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Document preview modal */}
      {previewDoc && (() => {
        const highlight: HighlightState = {
          isVisible: true,
          citation: {
            id: `preview-${previewDoc.chunkIndex}`,
            sourceFile: previewDoc.title,
            page: 0,
            chunk_index: previewDoc.chunkIndex,
            excerpt: previewDoc.excerpt,
          },
          highlightLine: previewDoc.excerpt,
        };
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setPreviewDoc(null)}>
            <div
              className="bg-surface border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
              style={{ width: '700px', maxWidth: '95vw', height: '80vh' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-accent shrink-0" />
                  <span className="text-[13px] font-semibold text-text-primary truncate">{previewDoc.title}</span>
                  <span className="text-[11px] text-text-muted shrink-0">chunk #{previewDoc.chunkIndex}</span>
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <button
                    onClick={() => {
                      setPreviewDoc(null);
                      navigate(`/admin/documents?open=${encodeURIComponent(previewDoc.title)}`);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-[12px] font-medium transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Mở để chỉnh sửa
                  </button>
                  <button onClick={() => setPreviewDoc(null)} className="text-text-muted hover:text-text-secondary transition-colors cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <DocumentViewer filename={previewDoc.title} highlight={highlight} />
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default FeedbackPage;
