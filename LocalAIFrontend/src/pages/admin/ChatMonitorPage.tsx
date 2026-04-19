import React, { useState } from 'react';
import { X, ChevronRight, MessageSquare } from 'lucide-react';
import { mockChatSessions } from '../../mocks/adminMocks';

type Session = typeof mockChatSessions[0];

const ChatMonitorPage: React.FC = () => {
  const [sessions] = useState(mockChatSessions);
  const [selected, setSelected] = useState<Session | null>(null);
  const [filterArchived, setFilterArchived] = useState('');

  const filtered = sessions.filter(s => {
    if (filterArchived === 'true') return s.is_archived;
    if (filterArchived === 'false') return !s.is_archived;
    return true;
  });

  const formatDate = (iso: string) => new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-text-primary">Giám sát Chat</h1>
          <p className="text-[13px] text-text-muted mt-0.5">{filtered.length} phiên trò chuyện</p>
        </div>
        <select value={filterArchived} onChange={e => setFilterArchived(e.target.value)} className="input-base w-auto py-2">
          <option value="">Tất cả</option>
          <option value="false">Đang hoạt động</option>
          <option value="true">Đã lưu trữ</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Session list */}
        <div className={`${selected ? 'lg:col-span-2' : 'lg:col-span-5'} bg-elevated border border-border rounded-xl overflow-hidden transition-all`}>
          <div className="panel-header"><MessageSquare className="w-3.5 h-3.5" /><span>Danh sách phiên</span></div>
          <div className="divide-y divide-border">
            {filtered.map(session => (
              <button
                key={session.id}
                onClick={() => setSelected(session)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-hover ${selected?.id === session.id ? 'bg-accent/10 border-l-2 border-accent' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-[13px] font-medium text-text-primary truncate">{session.notebook_name}</p>
                    {session.is_archived && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-border/30 text-text-muted border border-border font-medium flex-shrink-0">Archived</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-text-muted">
                    <span>{session.user}</span>
                    <span>·</span>
                    <span>{session.message_count} tin nhắn</span>
                    <span>·</span>
                    <span>{formatDate(session.created_at)}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-center py-8 text-[13px] text-text-muted">Không có phiên nào</p>
            )}
          </div>
        </div>

        {/* Conversation panel */}
        {selected && (
          <div className="lg:col-span-3 bg-elevated border border-border rounded-xl overflow-hidden flex flex-col animate-fade-in">
            <div className="panel-header">
              <div>
                <span>{selected.notebook_name}</span>
                <span className="text-text-muted normal-case font-normal ml-2">— {selected.user}</span>
              </div>
              <button onClick={() => setSelected(null)} className="btn-icon w-6 h-6"><X className="w-3 h-3" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[500px]">
              {selected.messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${msg.role === 'user' ? 'bg-accent text-white rounded-br-sm' : 'card-ai'}`}>
                    <p>{msg.content}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] opacity-60">
                      {msg.token_count && <span>{msg.token_count} tokens</span>}
                      {msg.latency_ms && <span>{msg.latency_ms}ms</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMonitorPage;
