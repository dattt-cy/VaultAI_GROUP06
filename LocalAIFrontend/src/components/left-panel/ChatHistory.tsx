import React from 'react';
import { MessageSquare, Plus } from 'lucide-react';
import type { ChatSession } from '../../hooks/useChatState';

function timeAgo(d: Date) {
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  const h = Math.floor(diff / 3600000);
  if (days > 0) return `${days} ngày trước`;
  if (h > 0) return `${h} giờ trước`;
  return 'Vừa xong';
}

interface ChatHistoryProps {
  sessions: ChatSession[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({ sessions, activeId, onSelect, onNew }) => (
  <div className="flex flex-col gap-0.5 py-1">
    <button
      onClick={onNew}
      className="flex items-center gap-2 mx-2 px-3 py-1.5 rounded-md text-xs text-text-secondary
                 bg-elevated border border-border hover:bg-accent/15 hover:text-accent hover:border-accent/40
                 transition-all duration-150 cursor-pointer"
    >
      <Plus className="w-3.5 h-3.5" />
      Cuộc trò chuyện mới
    </button>

    {sessions.map(s => (
      <button
        key={s.id}
        onClick={() => onSelect(String(s.id))}
        className={`sidebar-item mx-1 text-left ${String(s.id) === activeId ? 'active' : ''}`}
      >
        <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${String(s.id) === activeId ? 'text-accent' : 'text-text-muted'}`} />
        <div className="flex-1 min-w-0">
          <div className={`text-[15px] truncate ${String(s.id) === activeId ? 'text-accent font-medium' : 'text-text-primary'}`}>
            {s.title}
          </div>
          <div className="text-[14px] text-text-muted">{timeAgo(s.updatedAt)}</div>
        </div>
      </button>
    ))}
  </div>
);
