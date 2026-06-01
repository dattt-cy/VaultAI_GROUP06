import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Book, MoreVertical, Trash2, Bot, LogOut, MessageSquare, Search, Pencil, ArrowUpDown, Pin, PinOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE } from '../utils/apiClient';

interface Notebook {
  id: number;
  title: string;
  updatedAt: Date;
  messageCount: number;
  lastMessage?: string;
  isPinned: boolean;
}

function timeAgo(date: Date): string {
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return 'Vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} ngày trước`;
  return date.toLocaleDateString('vi-VN');
}

const CARD_COLORS = [
  'from-blue-500 to-indigo-500',
  'from-violet-500 to-purple-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-cyan-500 to-blue-500',
];

type SortKey = 'updatedAt' | 'title' | 'messageCount';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAdmin, canAccess, logout } = useAuth();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Notebook | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Notebook | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortAsc, setSortAsc] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const fetchNotebooks = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/chat/sessions`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setNotebooks(
        (data.sessions ?? []).map((s: any) => ({
          id: s.id,
          title: s.title,
          updatedAt: new Date(s.updated_at),
          messageCount: s.message_count,
          lastMessage: s.last_message,
          isPinned: s.is_pinned ?? false,
        }))
      );
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchNotebooks(); }, [fetchNotebooks]);

  useEffect(() => {
    if (renameTarget) setTimeout(() => renameInputRef.current?.focus(), 50);
  }, [renameTarget]);

  const deleteNotebook = async (id: number) => {
    setDeleting(true);
    try {
      await fetch(`${API_BASE}/api/chat/sessions/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setNotebooks(prev => prev.filter(n => n.id !== id));
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
      setMenuOpen(null);
    }
  };

  const renameNotebook = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    setRenaming(true);
    try {
      const res = await fetch(`${API_BASE}/api/chat/sessions/${renameTarget.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: renameValue.trim() }),
      });
      if (res.ok) {
        setNotebooks(prev =>
          prev.map(n => n.id === renameTarget.id ? { ...n, title: renameValue.trim() } : n)
        );
      }
    } finally {
      setRenaming(false);
      setRenameTarget(null);
    }
  };

  const togglePin = async (nb: Notebook) => {
    const newVal = !nb.isPinned;
    setNotebooks(prev => prev.map(n => n.id === nb.id ? { ...n, isPinned: newVal } : n));
    setMenuOpen(null);
    try {
      await fetch(`${API_BASE}/api/chat/sessions/${nb.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned: newVal }),
      });
    } catch {
      setNotebooks(prev => prev.map(n => n.id === nb.id ? { ...n, isPinned: !newVal } : n));
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(key === 'title'); }
  };

  const displayedNotebooks = useMemo(() => {
    let list = notebooks.filter(n =>
      n.title.toLowerCase().includes(search.toLowerCase())
    );
    list = [...list].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      let cmp = 0;
      if (sortKey === 'updatedAt') cmp = a.updatedAt.getTime() - b.updatedAt.getTime();
      else if (sortKey === 'title') cmp = a.title.localeCompare(b.title, 'vi');
      else cmp = a.messageCount - b.messageCount;
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [notebooks, search, sortKey, sortAsc]);

  const initials = user?.full_name
    .split(' ')
    .map(w => w[0])
    .slice(-2)
    .join('')
    .toUpperCase() ?? 'AI';

  return (
    <div className="h-screen bg-base flex flex-col font-sans overflow-hidden" onClick={() => setMenuOpen(null)}>

      {/* ── Top Navigation ── */}
      <header className="h-16 flex items-center justify-between px-6 bg-surface border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-accent" />
          </div>
          <span className="text-[16px] font-bold tracking-wide text-text-primary">
            VaultAI <span className="font-medium text-text-muted">Notebook</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          {canAccess(5) && (
            <button
              onClick={() => navigate('/admin')}
              className="text-[11px] px-2 py-0.5 rounded-full bg-danger/10 text-danger border border-danger/20 font-semibold hover:bg-danger/20 transition-colors cursor-pointer"
            >
              {isAdmin ? 'Admin' : 'Quản lý'}
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-accent flex items-center justify-center text-white text-[12px] font-bold">
              {initials}
            </div>
            <span className="text-[13px] text-text-secondary hidden sm:block">{user?.full_name}</span>
          </div>
          <button
            onClick={handleLogout}
            title="Đăng xuất"
            className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl w-full mx-auto px-3 sm:px-8 py-5 sm:py-10">

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="text-[22px] font-bold text-text-primary tracking-tight">Sổ ghi chú của tôi</h2>
              <p className="text-[13px] text-text-muted mt-0.5">
                {notebooks.length > 0 ? `${notebooks.length} sổ · ${notebooks.reduce((s, n) => s + n.messageCount, 0)} tin nhắn` : 'Mỗi cuộc trò chuyện là một sổ ghi chú'}
              </p>
            </div>

            {/* Search + Sort toolbar */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
                <input
                  type="text"
                  placeholder="Tìm kiếm..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-[13px] bg-surface border border-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors w-44"
                />
              </div>

              <div className="flex items-center gap-1 bg-surface border border-border rounded-xl px-1.5 py-1">
                <ArrowUpDown className="w-3 h-3 text-text-muted ml-1" />
                {([['updatedAt', 'Mới nhất'], ['title', 'Tên'], ['messageCount', 'Tin nhắn']] as [SortKey, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => toggleSort(key)}
                    className={`px-2 py-0.5 text-[11px] font-medium rounded-lg transition-colors ${
                      sortKey === key ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    {label}{sortKey === key ? (sortAsc ? ' ↑' : ' ↓') : ''}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Notebook Grid ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">

            {/* Create New Card */}
            <div
              onClick={() => navigate('/workspace?id=new')}
              className="group flex flex-col items-center justify-center h-52 bg-surface border border-border border-dashed rounded-2xl cursor-pointer hover:border-accent hover:bg-accent/5 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors mb-3">
                <Plus className="w-6 h-6 text-accent" />
              </div>
              <span className="text-[13px] font-semibold text-text-primary">Tạo sổ ghi chú mới</span>
              <span className="text-[11px] text-text-muted mt-1">Bắt đầu cuộc trò chuyện mới</span>
            </div>

            {/* Loading skeleton */}
            {loading && Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-52 bg-surface border border-border rounded-2xl animate-pulse" />
            ))}

            {/* Empty / no-results state */}
            {!loading && notebooks.length === 0 && (
              <div className="col-span-4 flex flex-col items-center justify-center py-16 text-text-muted gap-3">
                <MessageSquare className="w-10 h-10 opacity-30" />
                <p className="text-[14px]">Chưa có sổ ghi chú nào. Hãy tạo cuộc trò chuyện đầu tiên!</p>
              </div>
            )}

            {!loading && notebooks.length > 0 && displayedNotebooks.length === 0 && (
              <div className="col-span-4 flex flex-col items-center justify-center py-16 text-text-muted gap-3">
                <Search className="w-10 h-10 opacity-30" />
                <p className="text-[14px]">Không tìm thấy sổ nào khớp với "{search}"</p>
              </div>
            )}

            {/* Notebook Cards */}
            {displayedNotebooks.map((nb, idx) => (
              <div
                key={nb.id}
                onClick={() => navigate(`/workspace?id=${nb.id}`)}
                className={`group relative flex flex-col h-52 bg-surface border rounded-2xl cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-300 overflow-hidden ${nb.isPinned ? 'border-accent/50 shadow-sm shadow-accent/10' : 'border-border hover:border-accent/40'}`}
              >
                {/* Color ribbon */}
                <div className={`h-1.5 w-full bg-gradient-to-r ${CARD_COLORS[idx % CARD_COLORS.length]} opacity-70 group-hover:opacity-100 transition-opacity`} />

                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                    <div className="w-10 h-10 rounded-xl bg-base flex items-center justify-center shadow-sm relative">
                      <Book className={`w-5 h-5 bg-gradient-to-r ${CARD_COLORS[idx % CARD_COLORS.length]} bg-clip-text text-accent`} />
                      {nb.isPinned && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-accent rounded-full flex items-center justify-center">
                          <Pin className="w-2 h-2 text-white" />
                        </span>
                      )}
                    </div>

                    {/* Menu button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === nb.id ? null : nb.id); }}
                      className="p-1.5 rounded-full text-text-muted hover:bg-hover hover:text-text-primary transition-colors -mr-1 opacity-0 group-hover:opacity-100"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Dropdown menu */}
                    {menuOpen === nb.id && (
                      <div
                        className="absolute top-12 right-3 z-20 bg-surface border border-border rounded-xl shadow-xl py-1 min-w-[160px]"
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); togglePin(nb); }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-text-secondary hover:bg-hover transition-colors"
                        >
                          {nb.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                          {nb.isPinned ? 'Bỏ ghim' : 'Ghim lên đầu'}
                        </button>
                        <button
                          onClick={() => { setRenameTarget(nb); setRenameValue(nb.title); setMenuOpen(null); }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-text-secondary hover:bg-hover transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Đổi tên
                        </button>
                        <button
                          onClick={() => { setDeleteTarget(nb); setMenuOpen(null); }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-danger hover:bg-danger/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Xóa sổ ghi chú
                        </button>
                      </div>
                    )}
                  </div>

                  <h3 className="text-[14px] font-bold text-text-primary leading-snug mt-auto mb-1.5 line-clamp-2 group-hover:text-accent transition-colors">
                    {nb.title}
                  </h3>

                  {nb.lastMessage && (
                    <p className="text-[11px] text-text-muted/70 truncate mb-1">{nb.lastMessage}</p>
                  )}

                  <div className="flex items-center gap-1.5 text-[11px] text-text-muted font-medium">
                    <span>{timeAgo(nb.updatedAt)}</span>
                    <span className="w-1 h-1 rounded-full bg-border" />
                    <span>{nb.messageCount} tin nhắn</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ── Rename Dialog ── */}
      {renameTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => !renaming && setRenameTarget(null)}
        >
          <div
            className="bg-surface border border-border rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 animate-fade-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                <Pencil className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-text-primary">Đổi tên sổ ghi chú</h3>
                <p className="text-[12px] text-text-muted mt-0.5">Nhập tên mới cho cuộc trò chuyện</p>
              </div>
            </div>

            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') renameNotebook(); if (e.key === 'Escape') setRenameTarget(null); }}
              maxLength={120}
              className="w-full px-3 py-2.5 text-[13px] bg-base border border-border rounded-xl text-text-primary focus:outline-none focus:border-accent transition-colors mb-4"
            />

            <div className="flex gap-2">
              <button
                onClick={() => setRenameTarget(null)}
                disabled={renaming}
                className="flex-1 px-4 py-2 rounded-xl text-[13px] font-semibold border border-border text-text-secondary hover:bg-hover transition-colors disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={renameNotebook}
                disabled={renaming || !renameValue.trim()}
                className="flex-1 px-4 py-2 rounded-xl text-[13px] font-semibold bg-accent text-white hover:bg-accent/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {renaming ? (
                  <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin-fast" />Đang lưu...</>
                ) : (
                  <><Pencil className="w-3.5 h-3.5" />Lưu</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Dialog ── */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="bg-surface border border-border rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 animate-fade-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-danger" />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-text-primary">Xóa sổ ghi chú?</h3>
                <p className="text-[12px] text-text-muted mt-0.5">Hành động này không thể hoàn tác</p>
              </div>
            </div>

            <p className="text-[13px] text-text-secondary mb-5 bg-base rounded-xl px-3 py-2.5 border border-border line-clamp-2">
              &ldquo;{deleteTarget.title}&rdquo;
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 px-4 py-2 rounded-xl text-[13px] font-semibold border border-border text-text-secondary hover:bg-hover transition-colors disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={() => deleteNotebook(deleteTarget.id)}
                disabled={deleting}
                className="flex-1 px-4 py-2 rounded-xl text-[13px] font-semibold bg-danger text-white hover:bg-danger/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin-fast" />Đang xóa...</>
                ) : (
                  <><Trash2 className="w-3.5 h-3.5" />Xóa</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
