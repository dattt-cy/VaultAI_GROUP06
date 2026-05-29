import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, Pencil, Trash2, X, Check, Building2, Users, AlertCircle,
  Search, Mail, Shield, Clock, ChevronRight, UserX, Loader2, UserPlus, UserMinus,
} from 'lucide-react';
import { apiGet, apiPost, apiPatch, apiDelete, API_BASE } from '../../utils/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';
import { useToast } from '../../components/admin/ui/Toast';
import { Skeleton } from '../../components/admin/ui/Skeleton';
import { EmptyState } from '../../components/admin/ui/EmptyState';

interface Department {
  id: number;
  name: string;
  description: string | null;
  user_count: number;
  created_at: string;
}

interface DeptUser {
  id: number;
  username: string;
  full_name: string;
  email: string | null;
  role: string | null;
  role_id: number;
  is_active: boolean;
  last_login: string | null;
  avatar_url: string | null;
}

const AVATAR_COLORS = [
  'from-violet-500 to-purple-700',
  'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-600',
  'from-pink-500 to-rose-600',
];
const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-500/10 text-red-400 border-red-500/20',
  user: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

function avatarGradient(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }
function initials(name: string) { return name.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase().slice(0, 2); }
function fmtDate(s: string | null) { return s && s !== 'None' ? new Date(s).toLocaleDateString('vi-VN') : '—'; }

const UserAvatar = ({ user, size = 'md' }: { user: DeptUser; size?: 'sm' | 'md' }) => {
  const sz = size === 'md' ? 'w-10 h-10 text-[13px]' : 'w-8 h-8 text-[11px]';
  if (user.avatar_url)
    return <img src={`${API_BASE}${user.avatar_url}`} alt={user.full_name} className={cn(sz, 'rounded-full object-cover flex-shrink-0')} />;
  return (
    <div className={cn(sz, 'rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold flex-shrink-0', avatarGradient(user.id))}>
      {initials(user.full_name)}
    </div>
  );
};

interface AllUser {
  id: number;
  username: string;
  full_name: string;
  email: string | null;
  department_id: number | null;
  avatar_url: string | null;
}

// ── Add Members Modal ────────────────────────────────────────────────────
const AddMembersModal = ({
  deptId, deptName, onClose, onDone,
}: {
  deptId: number; deptName: string; onClose: () => void; onDone: () => void;
}) => {
  const [allUsers, setAllUsers] = useState<AllUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    apiGet('/api/admin/users')
      .then(r => r.json())
      .then((data: AllUser[]) => {
        setAllUsers(data.filter(u => u.department_id !== deptId));
      })
      .finally(() => setLoading(false));
  }, [deptId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return !q ? allUsers : allUsers.filter(u =>
      u.full_name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.email ?? '').toLowerCase().includes(q)
    );
  }, [allUsers, search]);

  const toggle = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAdd = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      await Promise.all([...selected].map(uid =>
        apiPatch(`/api/admin/users/${uid}`, { department_id: deptId })
      ));
      toast.success(`Đã thêm ${selected.size} nhân viên vào phòng ban`);
      onDone();
    } catch {
      toast.error('Có lỗi khi thêm nhân viên');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-surface border border-border rounded-2xl shadow-2xl animate-fade-in w-full max-w-lg mx-4 flex flex-col" style={{ maxHeight: '80vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-accent/10">
              <UserPlus className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-text-primary">Thêm nhân viên</h2>
              <p className="text-[11px] text-text-muted">Vào {deptName}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-hover text-text-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-border flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm theo tên, username, email..."
              className="input-base pl-9 py-2 text-[13px] w-full"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-text-muted">
              <Loader2 className="w-4 h-4 animate-spin" /><span className="text-[13px]">Đang tải...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-text-muted">
              <UserX className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-[13px]">{search ? 'Không tìm thấy' : 'Tất cả nhân viên đã trong phòng ban này'}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(u => {
                const sel = selected.has(u.id);
                return (
                  <button
                    key={u.id}
                    onClick={() => toggle(u.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 transition-colors text-left',
                      sel ? 'bg-accent/8' : 'hover:bg-hover'
                    )}
                  >
                    <div className={cn('w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                      sel ? 'bg-accent border-accent' : 'border-border'
                    )}>
                      {sel && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className={cn('w-9 h-9 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0', AVATAR_COLORS[u.id % AVATAR_COLORS.length])}>
                      {initials(u.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-text-primary truncate">{u.full_name}</p>
                      <p className="text-[11px] text-text-muted truncate">@{u.username}{u.email ? ` · ${u.email}` : ''}</p>
                    </div>
                    {u.department_id && (
                      <span className="text-[10px] text-text-muted bg-elevated border border-border px-2 py-0.5 rounded-full flex-shrink-0">Phòng khác</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-border flex-shrink-0 bg-elevated/40 rounded-b-2xl">
          <span className="text-[12px] text-text-muted">
            {selected.size > 0 ? `Đã chọn ${selected.size} nhân viên` : 'Chưa chọn ai'}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3.5 py-1.5 rounded-lg border border-border text-text-secondary text-[13px] hover:bg-hover transition-colors">Hủy</button>
            <button
              onClick={handleAdd}
              disabled={selected.size === 0 || saving}
              className="px-4 py-1.5 rounded-lg bg-accent text-white text-[13px] font-semibold hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Đang thêm...</> : <><UserPlus className="w-3.5 h-3.5" />Thêm {selected.size > 0 ? selected.size : ''}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Dept list item ──────────────────────────────────────────────────────
const DeptCard = ({
  dept, active, onClick, onEdit, onDelete, canEdit, canDelete,
}: {
  dept: Department; active: boolean; canEdit: boolean; canDelete: boolean;
  onClick: () => void; onEdit: () => void; onDelete: () => void;
}) => (
  <button
    onClick={onClick}
    className={cn(
      'w-full text-left px-3.5 py-3 rounded-xl border transition-all group relative',
      active
        ? 'bg-accent/10 border-accent/40 shadow-sm'
        : 'bg-elevated border-border hover:bg-surface/60 hover:border-border',
    )}
  >
    <div className="flex items-center gap-3">
      <div className={cn('p-2 rounded-lg flex-shrink-0 transition-colors', active ? 'bg-accent/20' : 'bg-surface group-hover:bg-accent/10')}>
        <Building2 className={cn('w-4 h-4', active ? 'text-accent' : 'text-text-muted group-hover:text-accent')} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-[13px] font-semibold truncate', active ? 'text-accent' : 'text-text-primary')}>{dept.name}</p>
        <p className="text-[11px] text-text-muted mt-0.5 flex items-center gap-1">
          <Users className="w-3 h-3" /> {dept.user_count} nhân viên
        </p>
      </div>
      <ChevronRight className={cn('w-3.5 h-3.5 flex-shrink-0 transition-transform', active ? 'text-accent rotate-0' : 'text-text-muted opacity-0 group-hover:opacity-100')} />
    </div>
    {/* action buttons – appear on hover */}
    {(canEdit || canDelete) && (
      <div className="absolute top-2 right-2 hidden group-hover:flex gap-1" onClick={e => e.stopPropagation()}>
        {canEdit && (
          <button onClick={onEdit} className="w-6 h-6 rounded-md bg-surface border border-border flex items-center justify-center hover:text-accent hover:border-accent/40 transition-colors" title="Sửa">
            <Pencil className="w-3 h-3" />
          </button>
        )}
        {canDelete && (
          <button onClick={onDelete} className="w-6 h-6 rounded-md bg-surface border border-border flex items-center justify-center hover:text-danger hover:border-danger/40 transition-colors" title="Xóa">
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    )}
  </button>
);

// ── Main Page ───────────────────────────────────────────────────────────
const DepartmentsPage: React.FC = () => {
  const { canDo } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [deptUsers, setDeptUsers] = useState<DeptUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const [showAddMembers, setShowAddMembers] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<number | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();

  const showToast = (msg: string, ok = true) => {
    if (ok) toast.success(msg); else toast.error(msg);
  };

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await apiGet('/api/admin/departments');
      const data: Department[] = await res.json();
      setDepartments(data);
      setSelectedDept(prev => prev ? (data.find(d => d.id === prev.id) ?? null) : null);
    } catch (err) {
      toast.error('Không tải được phòng ban', String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchDeptUsers = useCallback(async (deptId: number) => {
    setLoadingUsers(true);
    try {
      const res = await apiGet(`/api/admin/departments/${deptId}/users`);
      const data = await res.json();
      setDeptUsers(data.users ?? []);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => { fetchDepartments(); }, [fetchDepartments]);

  const selectDept = (dept: Department) => {
    setSelectedDept(dept);
    setUserSearch('');
    fetchDeptUsers(dept.id);
  };

  // ── CRUD ──────────────────────────────────────────────────────────────
  const startEdit = (dept: Department) => {
    setEditId(dept.id);
    setEditForm({ name: dept.name, description: dept.description ?? '' });
    setError(null);
  };

  const saveEdit = async () => {
    if (!editForm.name.trim()) return;
    setSaving(true);
    try {
      const res = await apiPatch(`/api/admin/departments/${editId}`, editForm);
      if (res.ok) {
        setEditId(null);
        await fetchDepartments();
        showToast('Cập nhật phòng ban thành công');
      } else {
        const err = await res.json();
        setError(err.detail ?? 'Lỗi cập nhật');
      }
    } finally { setSaving(false); }
  };

  const handleCreate = async () => {
    if (!createForm.name.trim()) return;
    setSaving(true);
    try {
      const res = await apiPost('/api/admin/departments', createForm);
      if (res.ok) {
        setCreateForm({ name: '', description: '' });
        setShowCreate(false);
        await fetchDepartments();
        showToast('Tạo phòng ban thành công');
      } else {
        const err = await res.json();
        setError(err.detail ?? 'Lỗi tạo phòng ban');
      }
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    const res = await apiDelete(`/api/admin/departments/${id}`);
    if (res.ok || res.status === 204) {
      if (selectedDept?.id === id) { setSelectedDept(null); setDeptUsers([]); }
      setDeleteConfirmId(null);
      await fetchDepartments();
      showToast('Đã xóa phòng ban');
    } else {
      const err = await res.json();
      setDeleteConfirmId(null);
      showToast(err.detail ?? 'Lỗi xóa phòng ban', false);
    }
  };

  const handleRemoveUser = async (userId: number) => {
    setRemovingUserId(userId);
    try {
      const res = await apiPatch(`/api/admin/users/${userId}`, { department_id: null });
      if (res.ok) {
        toast.success('Đã xóa nhân viên khỏi phòng ban');
        if (selectedDept) fetchDeptUsers(selectedDept.id);
        fetchDepartments();
      } else {
        toast.error('Không thể xóa nhân viên');
      }
    } finally {
      setRemovingUserId(null);
    }
  };

  const filteredUsers = deptUsers.filter(u => {
    const q = userSearch.toLowerCase();
    return !q || u.full_name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q);
  });

  const totalUsers = departments.reduce((s, d) => s + d.user_count, 0);

  return (
    <div className="flex gap-5 animate-fade-in" style={{ minHeight: 'calc(100vh - 8rem)' }}>

      {/* ── LEFT: Department list ── */}
      <div className="w-[300px] flex-shrink-0 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[18px] font-bold text-text-primary">Phòng ban</h1>
            <p className="text-[12px] text-text-muted">{departments.length} phòng · {totalUsers} nhân viên</p>
          </div>
          {canDo('admin.departments.create') && (
            <button
              onClick={() => { setShowCreate(true); setError(null); }}
              className="w-8 h-8 rounded-lg bg-accent hover:bg-accent-hover text-white flex items-center justify-center transition-colors"
              title="Thêm phòng ban"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Create inline form */}
        {showCreate && (
          <div className="bg-elevated border border-accent/30 rounded-xl p-3 space-y-2 animate-fade-in">
            <p className="text-[12px] font-semibold text-text-primary">Phòng ban mới</p>
            {error && <p className="text-[11px] text-danger flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
            <input
              value={createForm.name}
              onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="Tên phòng ban *"
              className="input-base text-[12px] py-1.5 w-full"
              autoFocus
            />
            <input
              value={createForm.description}
              onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="Mô tả (tùy chọn)"
              className="input-base text-[12px] py-1.5 w-full"
            />
            <div className="flex gap-1.5">
              <button onClick={handleCreate} disabled={saving || !createForm.name.trim()} className="flex-1 py-1.5 rounded-lg bg-accent text-white text-[12px] font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50">
                {saving ? 'Đang tạo...' : 'Tạo'}
              </button>
              <button onClick={() => { setShowCreate(false); setError(null); }} className="px-3 py-1.5 rounded-lg border border-border text-text-secondary text-[12px] hover:bg-hover transition-colors">
                Hủy
              </button>
            </div>
          </div>
        )}

        {/* Dept list */}
        <div className="flex flex-col gap-2 overflow-y-auto flex-1 pr-0.5">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[68px] w-full" rounded="xl" />
            ))
          ) : departments.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="Chưa có phòng ban"
              description={canDo('admin.departments.create') ? 'Bấm + để tạo phòng ban đầu tiên.' : 'Liên hệ admin để được tạo phòng ban.'}
              compact
            />
          ) : (
            departments.map(dept => (
              editId === dept.id ? (
                /* Inline edit card */
                <div key={dept.id} className="bg-elevated border border-accent/40 rounded-xl p-3 space-y-2 animate-fade-in">
                  {error && <p className="text-[11px] text-danger flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
                  <input
                    value={editForm.name}
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    className="input-base text-[12px] py-1.5 w-full"
                    autoFocus
                  />
                  <input
                    value={editForm.description}
                    onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Mô tả"
                    className="input-base text-[12px] py-1.5 w-full"
                  />
                  <div className="flex gap-1.5">
                    <button onClick={saveEdit} disabled={saving} className="flex-1 py-1.5 rounded-lg bg-accent text-white text-[12px] font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50">
                      {saving ? '...' : <><Check className="w-3 h-3 inline mr-1" />Lưu</>}
                    </button>
                    <button onClick={() => { setEditId(null); setError(null); }} className="px-3 py-1.5 rounded-lg border border-border text-text-secondary text-[12px] hover:bg-hover transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <DeptCard
                  key={dept.id}
                  dept={dept}
                  active={selectedDept?.id === dept.id}
                  onClick={() => selectDept(dept)}
                  onEdit={() => startEdit(dept)}
                  onDelete={() => setDeleteConfirmId(dept.id)}
                  canEdit={canDo('admin.departments.edit')}
                  canDelete={canDo('admin.departments.delete')}
                />
              )
            ))
          )}
        </div>
      </div>

      {/* ── RIGHT: Employees panel ── */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        {selectedDept ? (
          <>
            {/* Panel header */}
            <div className="bg-elevated border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-accent/10">
                    <Building2 className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h2 className="text-[16px] font-bold text-text-primary">{selectedDept.name}</h2>
                    <p className="text-[12px] text-text-muted mt-0.5">{selectedDept.description ?? 'Chưa có mô tả'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-center">
                    <p className="text-[20px] font-bold text-text-primary">{selectedDept.user_count}</p>
                    <p className="text-[11px] text-text-muted">nhân viên</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Search + table */}
            <div className="bg-elevated border border-border rounded-xl overflow-hidden flex flex-col flex-1">
              {/* Search bar */}
              <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                  <input
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    placeholder="Tìm nhân viên theo tên, email..."
                    className="input-base pl-9 py-2 text-[13px] w-full"
                  />
                </div>
                {canDo('admin.departments.members') && (
                  <button
                    onClick={() => setShowAddMembers(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-white text-[13px] font-semibold hover:bg-accent-hover transition-colors flex-shrink-0"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Thêm nhân viên
                  </button>
                )}
              </div>

              {/* User table */}
              {loadingUsers ? (
                <div className="flex items-center justify-center py-16 gap-2 text-text-muted">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-[13px]">Đang tải...</span>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <UserX className="w-12 h-12 text-text-muted/30 mb-3" />
                  <p className="text-[14px] font-semibold text-text-primary mb-1">
                    {userSearch ? 'Không tìm thấy' : 'Chưa có nhân viên'}
                  </p>
                  <p className="text-[12px] text-text-muted">
                    {userSearch ? 'Thử tìm với từ khóa khác' : 'Phòng ban này chưa có nhân viên nào được phân công'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface/50 text-[11px] text-text-muted uppercase tracking-wider font-semibold">
                        <th className="px-5 py-3.5">Nhân viên</th>
                        <th className="px-5 py-3.5">Email</th>
                        <th className="px-5 py-3.5 text-center">Vai trò</th>
                        <th className="px-5 py-3.5 text-center">Trạng thái</th>
                        <th className="px-5 py-3.5">Đăng nhập cuối</th>
                        {canDo('admin.departments.members') && <th className="px-5 py-3.5 w-12" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredUsers.map(u => (
                        <tr key={u.id} className="hover:bg-surface/40 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <UserAvatar user={u} size="md" />
                              <div>
                                <p className="text-[13px] font-semibold text-text-primary">{u.full_name}</p>
                                <p className="text-[11px] text-text-muted font-mono">@{u.username}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            {u.email ? (
                              <div className="flex items-center gap-1.5 text-[12px] text-text-muted">
                                <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="truncate max-w-[180px]">{u.email}</span>
                              </div>
                            ) : (
                              <span className="text-[12px] text-text-muted italic">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-center">
                            <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-full border inline-flex items-center gap-1', ROLE_COLORS[u.role ?? ''] ?? 'bg-surface border-border text-text-muted')}>
                              <Shield className="w-3 h-3" />{u.role ?? '—'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <span className={cn('w-2 h-2 rounded-full', u.is_active ? 'bg-success' : 'bg-text-muted')} />
                              <span className={cn('text-[12px] font-medium', u.is_active ? 'text-success' : 'text-text-muted')}>
                                {u.is_active ? 'Hoạt động' : 'Vô hiệu'}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1.5 text-[12px] text-text-muted">
                              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                              {fmtDate(u.last_login)}
                            </div>
                          </td>
                          {canDo('admin.departments.members') && (
                            <td className="px-3 py-3 text-center">
                              <button
                                onClick={() => handleRemoveUser(u.id)}
                                disabled={removingUserId === u.id}
                                title="Xóa khỏi phòng ban"
                                className="w-7 h-7 rounded-lg flex items-center justify-center border border-border text-text-muted hover:border-danger/50 hover:text-danger hover:bg-danger/5 transition-colors disabled:opacity-40 mx-auto"
                              >
                                {removingUserId === u.id
                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                  : <UserMinus className="w-3 h-3" />}
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Footer count */}
              {!loadingUsers && filteredUsers.length > 0 && (
                <div className="px-5 py-3 border-t border-border text-[12px] text-text-muted">
                  Hiển thị {filteredUsers.length} / {deptUsers.length} nhân viên
                </div>
              )}
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-border bg-elevated/30">
            <div className="p-4 rounded-2xl bg-accent/5 mb-4">
              <Building2 className="w-12 h-12 text-accent/40" />
            </div>
            <p className="text-[16px] font-semibold text-text-primary mb-1">Chọn phòng ban</p>
            <p className="text-[13px] text-text-muted max-w-xs">
              Nhấn vào một phòng ban bên trái để xem danh sách nhân viên thuộc phòng ban đó.
            </p>
          </div>
        )}
      </div>

      {/* ── Add Members Modal ── */}
      {showAddMembers && selectedDept && (
        <AddMembersModal
          deptId={selectedDept.id}
          deptName={selectedDept.name}
          onClose={() => setShowAddMembers(false)}
          onDone={() => {
            setShowAddMembers(false);
            fetchDeptUsers(selectedDept.id);
            fetchDepartments();
          }}
        />
      )}

      {/* ── Delete confirm modal ── */}
      {deleteConfirmId !== null && (() => {
        const dept = departments.find(d => d.id === deleteConfirmId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-surface border border-border rounded-2xl p-6 shadow-2xl animate-fade-in w-full max-w-sm mx-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-danger/10">
                  <Trash2 className="w-5 h-5 text-danger" />
                </div>
                <h2 className="text-[16px] font-bold text-text-primary">Xác nhận xóa</h2>
              </div>
              <p className="text-[13px] text-text-secondary mb-1">
                Bạn có chắc muốn xóa phòng ban <span className="font-semibold text-text-primary">"{dept?.name}"</span>?
              </p>
              {dept && dept.user_count > 0 && (
                <div className="flex items-start gap-2 text-[12px] text-warning bg-warning/10 border border-warning/20 rounded-lg px-3 py-2 mt-3">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  Phòng ban đang có <strong>{dept.user_count}</strong> nhân viên, không thể xóa. Hãy chuyển họ sang phòng ban khác trước.
                </div>
              )}
              <div className="flex gap-2 mt-5">
                <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-2 rounded-lg border border-border text-text-secondary text-[13px] hover:bg-hover transition-colors">Hủy</button>
                <button
                  onClick={() => handleDelete(deleteConfirmId)}
                  disabled={!!(dept && dept.user_count > 0)}
                  className="flex-1 py-2 rounded-lg bg-danger text-white text-[13px] font-semibold hover:bg-danger/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Xóa phòng ban
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};

export default DepartmentsPage;
