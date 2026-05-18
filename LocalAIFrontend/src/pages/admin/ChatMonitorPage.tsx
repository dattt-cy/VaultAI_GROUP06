import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronRight, MessageSquare, Search, ChevronLeft, Inbox } from 'lucide-react';
import { apiGet } from '../../utils/apiClient';
import { PageHeader } from '../../components/admin/ui/PageHeader';
import { Skeleton } from '../../components/admin/ui/Skeleton';
import { EmptyState } from '../../components/admin/ui/EmptyState';
import { useToast } from '../../components/admin/ui/Toast';

interface Session {
  id: number;
  user_id: number;
  username: string | null;
  full_name: string | null;
  email: string | null;
  session_title: string;
  is_archived: boolean;
  message_count: number;
  created_at: string;
}

interface Message {
  id: number;
  sender_type: string;
  content: string;
  prompt_tokens: number;
  completion_tokens: number;
  latency_ms: number;
  created_at: string;
}

const PAGE_SIZE = 20;

const ChatMonitorPage: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState<Session | null>(null);
  const [filterArchived, setFilterArchived] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        skip: String(page * PAGE_SIZE),
        limit: String(PAGE_SIZE),
      });
      if (filterArchived) params.set('is_archived', filterArchived);
      if (search) params.set('search', search);
      const res = await apiGet(`/api/admin/chat/sessions?${params}`);
      const data = await res.json();
      setSessions(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      toast.error('Không tải được danh sách phiên', String(err));
    } finally {
      setLoading(false);
    }
  }, [page, filterArchived, search, toast]);

  const fetchMessages = useCallback(async (sessionId: number) => {
    try {
      const res = await apiGet(`/api/admin/chat/sessions/${sessionId}/messages`);
      setMessages(await res.json());
    } catch (err) {
      toast.error('Không tải được tin nhắn', String(err));
    }
  }, [toast]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(0); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const selectSession = (session: Session) => {
    setSelected(session);
    fetchMessages(session.id);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const formatDate = (iso: string) => new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader
        title="Giám sát Chat"
        subtitle={`${total.toLocaleString('vi-VN')} phiên trò chuyện`}
        icon={<MessageSquare className="w-5 h-5 text-text-secondary" />}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Tìm email, tên, username..."
            className="input-base pl-8 py-2 text-[13px] w-full"
          />
        </div>
        <select
          value={filterArchived}
          onChange={e => { setFilterArchived(e.target.value); setPage(0); }}
          className="input-base w-auto py-2 text-[13px]"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="false">Đang hoạt động</option>
          <option value="true">Đã lưu trữ</option>
        </select>
        {(search || filterArchived) && (
          <button
            onClick={() => { setSearchInput(''); setSearch(''); setFilterArchived(''); setPage(0); }}
            className="text-[12px] text-text-muted hover:text-text-primary px-2 py-1.5 rounded-lg border border-border hover:bg-hover"
          >
            Xóa bộ lọc
          </button>
        )}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Session list */}
        <div className={`${selected ? 'lg:col-span-2' : 'lg:col-span-5'} bg-elevated border border-border rounded-xl overflow-hidden transition-all flex flex-col`}>
          <div className="panel-header">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Danh sách phiên</span>
            </div>
            <span className="text-[11px] text-text-muted font-normal">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} / {total}
            </span>
          </div>

          <div className="divide-y divide-border flex-1">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-3/5" />
                    <Skeleton className="h-2.5 w-2/5" />
                  </div>
                  <Skeleton className="w-4 h-4" />
                </div>
              ))
            ) : sessions.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="Không có phiên nào"
                description={search || filterArchived ? 'Thử bỏ bộ lọc để xem toàn bộ.' : 'Chưa có phiên trò chuyện nào.'}
                compact
              />
            ) : (
              sessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => selectSession(session)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-hover ${selected?.id === session.id ? 'bg-accent/10 border-l-2 border-accent' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-[13px] font-medium text-text-primary truncate">
                        {session.session_title || `Session #${session.id}`}
                      </p>
                      {session.is_archived && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-border/30 text-text-muted border border-border font-medium flex-shrink-0">Archived</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-text-muted flex-wrap">
                      {session.email
                        ? <span className="text-accent/80">{session.email}</span>
                        : <span>User #{session.user_id}</span>
                      }
                      {session.username && !selected && (
                        <span className="opacity-50">@{session.username}</span>
                      )}
                      <span>·</span>
                      <span>{session.message_count} tin nhắn</span>
                      <span>·</span>
                      <span>{formatDate(session.created_at)}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
                </button>
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-surface">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="flex items-center gap-1 text-[12px] text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Trước
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let p = i;
                  if (totalPages > 7) {
                    if (page < 4) p = i;
                    else if (page > totalPages - 5) p = totalPages - 7 + i;
                    else p = page - 3 + i;
                  }
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-7 h-7 rounded-md text-[12px] font-medium transition-colors ${p === page ? 'bg-accent text-white' : 'text-text-secondary hover:bg-hover'}`}
                    >
                      {p + 1}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="flex items-center gap-1 text-[12px] text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Tiếp <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Message panel */}
        {selected && (
          <div className="lg:col-span-3 bg-elevated border border-border rounded-xl overflow-hidden flex flex-col animate-fade-in">
            <div className="panel-header">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="truncate">{selected.session_title || `Session #${selected.id}`}</span>
                <span className="text-text-muted normal-case font-normal text-[11px]">
                  {selected.full_name || `User #${selected.user_id}`}
                  {selected.email && <span className="ml-1 text-accent/70">&lt;{selected.email}&gt;</span>}
                </span>
              </div>
              <button onClick={() => setSelected(null)} className="btn-icon w-6 h-6 flex-shrink-0">
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[500px]">
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${msg.sender_type === 'user' ? 'bg-accent text-white rounded-br-sm' : 'card-ai'}`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] opacity-60">
                      {msg.completion_tokens > 0 && <span>{msg.completion_tokens} tokens</span>}
                      {msg.latency_ms > 0 && <span>{msg.latency_ms}ms</span>}
                    </div>
                  </div>
                </div>
              ))}
              {messages.length === 0 && (
                <EmptyState icon={Inbox} title="Không có tin nhắn" compact />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMonitorPage;
