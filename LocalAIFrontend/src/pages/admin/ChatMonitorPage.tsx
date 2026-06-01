import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronRight, MessageSquare, Search, ChevronLeft, Inbox, RefreshCw, Bot, User, ExternalLink } from 'lucide-react';
import { apiGet } from '../../utils/apiClient';
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

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

const getInitials = (name: string | null, email: string | null) => {
  if (name) return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  if (email) return email[0].toUpperCase();
  return 'U';
};

const ChatMonitorPage: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [selected, setSelected] = useState<Session | null>(null);
  const [filterArchived, setFilterArchived] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const fetchSessions = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const params = new URLSearchParams({ skip: String(page * PAGE_SIZE), limit: String(PAGE_SIZE) });
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
      setRefreshing(false);
    }
  }, [page, filterArchived, search, toast]);

  const fetchMessages = useCallback(async (sessionId: number) => {
    setMessagesLoading(true);
    try {
      const res = await apiGet(`/api/admin/chat/sessions/${sessionId}/messages`);
      setMessages(await res.json());
    } catch (err) {
      toast.error('Không tải được tin nhắn', String(err));
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(0); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Auto-scroll to bottom when messages load
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const selectSession = (session: Session) => {
    setSelected(session);
    fetchMessages(session.id);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex flex-col h-full gap-4 animate-fade-in">
      {/* Compact header row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <MessageSquare className="w-4 h-4 text-text-secondary flex-shrink-0" />
          <h1 className="text-[17px] font-semibold text-text-primary leading-tight">Giám sát Chat</h1>
          <span className="text-[12px] text-text-muted bg-border/30 px-2 py-0.5 rounded-full border border-border">
            {total.toLocaleString('vi-VN')} phiên
          </span>
        </div>

        {/* Filters inline with header */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Tìm email, tên..."
              className="input-base pl-8 py-1.5 text-[12px] w-[200px]"
            />
          </div>
          <select
            value={filterArchived}
            onChange={e => { setFilterArchived(e.target.value); setPage(0); }}
            className="input-base w-auto py-1.5 text-[12px]"
          >
            <option value="">Tất cả</option>
            <option value="false">Đang hoạt động</option>
            <option value="true">Đã lưu trữ</option>
          </select>
          {(search || filterArchived) && (
            <button
              onClick={() => { setSearchInput(''); setSearch(''); setFilterArchived(''); setPage(0); }}
              className="text-[11px] text-text-muted hover:text-text-primary px-2 py-1.5 rounded-lg border border-border hover:bg-hover"
            >
              Xóa lọc
            </button>
          )}
          <button
            onClick={() => fetchSessions(true)}
            disabled={refreshing}
            className="btn-icon w-7 h-7 flex-shrink-0"
            title="Làm mới"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Fixed 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 flex-1 min-h-0">
        {/* Session list */}
        <div className="lg:col-span-2 bg-elevated border border-border rounded-xl overflow-hidden flex flex-col">
          <div className="panel-header">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Danh sách phiên</span>
            </div>
            {total > 0 && (
              <span className="text-[11px] text-text-muted font-normal">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} / {total}
              </span>
            )}
          </div>

          <div className="divide-y divide-border flex-1 overflow-y-auto">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-3/5" />
                    <Skeleton className="h-2.5 w-2/5" />
                  </div>
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
                  {/* User avatar initials */}
                  <div className="w-8 h-8 rounded-full bg-accent/15 text-accent flex items-center justify-center text-[11px] font-semibold flex-shrink-0">
                    {getInitials(session.full_name, session.email)}
                  </div>
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
                        ? <span className="text-accent/80 truncate max-w-[120px]">{session.email}</span>
                        : <span>User #{session.user_id}</span>
                      }
                      <span>·</span>
                      <span>{session.message_count} tin</span>
                      <span>·</span>
                      <span>{formatDate(session.created_at)}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                </button>
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-surface">
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
                      className={`w-6 h-6 rounded-md text-[11px] font-medium transition-colors ${p === page ? 'bg-accent text-white' : 'text-text-secondary hover:bg-hover'}`}
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

        {/* Message panel — always rendered, shows placeholder when no session */}
        <div className="lg:col-span-3 bg-elevated border border-border rounded-xl overflow-hidden flex flex-col">
          {selected ? (
            <>
              {/* Panel header */}
              <div className="panel-header">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-7 h-7 rounded-full bg-accent/15 text-accent flex items-center justify-center text-[10px] font-semibold flex-shrink-0">
                    {getInitials(selected.full_name, selected.email)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium leading-tight">
                      {selected.session_title || `Session #${selected.id}`}
                    </p>
                    <div className="flex items-center gap-1 text-[11px] text-text-muted font-normal normal-case">
                      <span>{selected.full_name || `User #${selected.user_id}`}</span>
                      {selected.email && (
                        <>
                          <span>·</span>
                          <a
                            href={`/admin/users?q=${encodeURIComponent(selected.email)}`}
                            className="text-accent/70 hover:text-accent flex items-center gap-0.5 transition-colors"
                            onClick={e => e.stopPropagation()}
                          >
                            {selected.email}
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="btn-icon w-6 h-6 flex-shrink-0">
                  <X className="w-3 h-3" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                {messagesLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className={`flex gap-2.5 ${i % 2 === 0 ? 'justify-start' : 'justify-end flex-row-reverse'}`}>
                        <Skeleton className="w-7 h-7 rounded-full flex-shrink-0" />
                        <div className="space-y-1.5 max-w-[60%]">
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-4/5" />
                          <Skeleton className="h-2.5 w-2/5" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <EmptyState icon={Inbox} title="Không có tin nhắn" compact />
                ) : (
                  messages.map(msg => {
                    const isUser = msg.sender_type === 'user';
                    return (
                      <div key={msg.id} className={`flex items-end gap-2 ${isUser ? 'justify-end flex-row-reverse' : 'justify-start'}`}>
                        {/* Avatar */}
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mb-0.5 ${isUser ? 'bg-accent/20 text-accent' : 'bg-border/50 text-text-muted'}`}>
                          {isUser
                            ? <User className="w-3 h-3" />
                            : <Bot className="w-3 h-3" />
                          }
                        </div>

                        <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                          <div className={`rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${isUser ? 'bg-accent text-white rounded-br-sm' : 'card-ai rounded-bl-sm'}`}>
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          </div>

                          {/* Timestamp + stats */}
                          <div className={`flex items-center gap-2 text-[10px] text-text-muted px-1 ${isUser ? 'flex-row-reverse' : ''}`}>
                            <span>{formatTime(msg.created_at)}</span>
                            {msg.completion_tokens > 0 && (
                              <span className="opacity-70">{msg.completion_tokens} tokens</span>
                            )}
                            {msg.latency_ms > 0 && (
                              <span className="opacity-70">{msg.latency_ms}ms</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Session stats footer */}
              {!messagesLoading && messages.length > 0 && (
                <div className="px-4 py-2 border-t border-border bg-surface flex items-center gap-3 text-[11px] text-text-muted">
                  <span>{messages.length} tin nhắn</span>
                  <span>·</span>
                  <span>
                    {messages.reduce((s, m) => s + (m.completion_tokens || 0) + (m.prompt_tokens || 0), 0).toLocaleString('vi-VN')} tokens tổng
                  </span>
                  <span>·</span>
                  <span>
                    TB {Math.round(messages.filter(m => m.latency_ms > 0).reduce((s, m) => s + m.latency_ms, 0) / Math.max(1, messages.filter(m => m.latency_ms > 0).length))}ms
                  </span>
                </div>
              )}
            </>
          ) : (
            /* Placeholder khi chưa chọn session */
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-muted p-8">
              <div className="w-12 h-12 rounded-full bg-border/30 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 opacity-40" />
              </div>
              <div className="text-center">
                <p className="text-[13px] font-medium text-text-secondary">Chọn một phiên để xem tin nhắn</p>
                <p className="text-[12px] text-text-muted mt-0.5">Click vào bất kỳ phiên nào ở bên trái</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMonitorPage;
