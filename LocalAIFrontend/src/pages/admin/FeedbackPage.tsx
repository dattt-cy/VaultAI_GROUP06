import React, { useState, useEffect, useCallback } from 'react';
import { ThumbsUp, ThumbsDown, AlertTriangle } from 'lucide-react';
import { AdminTable, StatusBadge } from '../../components/admin/AdminTable';
import { StatCard } from '../../components/admin/StatCard';
import { API_BASE } from '../../utils/apiClient';

interface FeedbackItem {
  id: number;
  message_id: number;
  reaction: string;
  user_comment: string;
  corrected_text: string;
  created_at: string;
}

const FeedbackPage: React.FC = () => {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [filter, setFilter] = useState('');
  const [total, setTotal] = useState(0);

  const fetchFeedback = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/admin/feedback?limit=200`);
    const data = await res.json();
    setFeedbacks(data.items ?? []);
    setTotal(data.total ?? 0);
  }, []);

  useEffect(() => { fetchFeedback(); }, [fetchFeedback]);

  const likes        = feedbacks.filter(f => f.reaction === 'LIKE').length;
  const dislikes     = feedbacks.filter(f => f.reaction === 'DISLIKE').length;
  const hallucinated = feedbacks.filter(f => f.reaction === 'HALLUCINATED').length;

  const filtered = feedbacks.filter(f => !filter || f.reaction === filter);

  const formatDate = (iso: string) => new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  const columns = [
    { key: 'message_id', label: 'Message', render: (f: FeedbackItem) => <span className="font-mono text-[12px] text-text-muted">#{f.message_id}</span> },
    { key: 'user_comment', label: 'Bình luận', render: (f: FeedbackItem) => (
      <span className="text-text-secondary text-[12px] line-clamp-2 max-w-xs">{f.user_comment || '—'}</span>
    )},
    { key: 'reaction', label: 'Loại', render: (f: FeedbackItem) => <StatusBadge status={f.reaction} /> },
    { key: 'corrected_text', label: 'Ghi chú sửa', render: (f: FeedbackItem) => (
      f.corrected_text
        ? <span className="text-[12px] text-warning bg-warning/10 border border-warning/20 px-2 py-0.5 rounded-md">{f.corrected_text}</span>
        : <span className="text-text-muted text-[12px]">—</span>
    )},
    { key: 'created_at', label: 'Thời gian', render: (f: FeedbackItem) => <span className="text-text-muted text-[12px]">{formatDate(f.created_at)}</span> },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-[20px] font-bold text-text-primary">Phản hồi người dùng</h1>
        <p className="text-[13px] text-text-muted mt-0.5">Đánh giá chất lượng câu trả lời của AI · {total} phản hồi</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Hài lòng" value={likes} icon={ThumbsUp} color="success" />
        <StatCard label="Không hài lòng" value={dislikes} icon={ThumbsDown} color="warning" />
        <StatCard label="Ảo giác AI" value={hallucinated} icon={AlertTriangle} color="danger" />
      </div>

      <div className="flex gap-2">
        {['', 'LIKE', 'DISLIKE', 'HALLUCINATED'].map(type => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${filter === type ? 'bg-accent text-white border-accent' : 'border-border text-text-secondary hover:bg-hover'}`}
          >
            {type || 'Tất cả'}
          </button>
        ))}
      </div>

      <AdminTable
        columns={columns}
        data={filtered}
        rowKey={f => f.id}
        emptyText="Không có phản hồi nào"
      />
    </div>
  );
};

export default FeedbackPage;
