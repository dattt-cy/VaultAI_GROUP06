import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, AlertTriangle } from 'lucide-react';
import { AdminTable, StatusBadge } from '../../components/admin/AdminTable';
import { mockFeedbacks } from '../../mocks/adminMocks';
import { StatCard } from '../../components/admin/StatCard';

type Feedback = typeof mockFeedbacks[0];

const FeedbackPage: React.FC = () => {
  const [feedbacks] = useState(mockFeedbacks);
  const [filter, setFilter] = useState('');

  const likes       = feedbacks.filter(f => f.feedback_type === 'LIKE').length;
  const dislikes    = feedbacks.filter(f => f.feedback_type === 'DISLIKE').length;
  const hallucinated = feedbacks.filter(f => f.feedback_type === 'HALLUCINATED').length;

  const filtered = feedbacks.filter(f => !filter || f.feedback_type === filter);

  const formatDate = (iso: string) => new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  const columns = [
    { key: 'user', label: 'Người dùng', render: (f: Feedback) => <span className="font-medium text-text-primary">{f.user}</span> },
    { key: 'message_preview', label: 'Nội dung phản hồi', render: (f: Feedback) => (
      <span className="text-text-secondary text-[12px] line-clamp-2 max-w-xs">{f.message_preview}</span>
    )},
    { key: 'feedback_type', label: 'Loại', render: (f: Feedback) => <StatusBadge status={f.feedback_type} /> },
    { key: 'correction', label: 'Ghi chú sửa', render: (f: Feedback) => (
      f.correction
        ? <span className="text-[12px] text-warning bg-warning/10 border border-warning/20 px-2 py-0.5 rounded-md">{f.correction}</span>
        : <span className="text-text-muted text-[12px]">—</span>
    )},
    { key: 'created_at', label: 'Thời gian', render: (f: Feedback) => <span className="text-text-muted text-[12px]">{formatDate(f.created_at)}</span> },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-[20px] font-bold text-text-primary">Phản hồi người dùng</h1>
        <p className="text-[13px] text-text-muted mt-0.5">Đánh giá chất lượng câu trả lời của AI</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Hài lòng" value={likes} icon={ThumbsUp} color="success" />
        <StatCard label="Không hài lòng" value={dislikes} icon={ThumbsDown} color="warning" />
        <StatCard label="Ảo giác AI" value={hallucinated} icon={AlertTriangle} color="danger" />
      </div>

      {/* Filter */}
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
