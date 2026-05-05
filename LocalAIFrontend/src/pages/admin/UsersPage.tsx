import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Search, X, Edit2, Trash2, ShieldCheck, ShieldOff,
  Mail, Building2, Calendar, Clock, Camera, ChevronDown, Check, Eye
} from 'lucide-react';
import { apiGet, apiPost, apiPatch, apiDelete } from '../../utils/apiClient';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';

const API_BASE = 'http://localhost:8000';

interface Role { id: number; name: string; access_level: number }
interface Department { id: number; name: string; description: string | null }
interface User {
  id: number; username: string; full_name: string; email: string | null;
  department: string | null; department_id: number | null; role_id: number; is_active: boolean;
  last_login: string | null; created_at: string | null; avatar_url: string | null;
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-gradient-to-r from-red-500/10 to-orange-500/10 text-red-500 border-red-500/20 shadow-sm shadow-red-500/5',
  user:  'bg-gradient-to-r from-blue-500/10 to-cyan-500/10 text-blue-500 border-blue-500/20 shadow-sm shadow-blue-500/5',
};

const AVATAR_COLORS = [
  'from-violet-500 to-purple-700',
  'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-600',
  'from-pink-500 to-rose-600',
];

function avatarGradient(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }
function initials(name: string) { return name.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase().slice(0, 2); }
function fmtDate(iso: string | null) { return iso && iso !== 'None' ? new Date(iso).toLocaleDateString('vi-VN') : '—'; }

const UserAvatar = ({ user, size = 'md' }: { user: User; size?: 'sm' | 'md' | 'lg' }) => {
  const sz = size === 'lg' ? 'w-20 h-20 text-[22px]' : size === 'md' ? 'w-11 h-11 text-[14px]' : 'w-8 h-8 text-[11px]';
  if (user.avatar_url)
    return <img src={`${API_BASE}${user.avatar_url}`} alt={user.full_name} className={cn(sz, 'rounded-full object-cover flex-shrink-0')} />;
  return (
    <div className={cn(sz, 'rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold flex-shrink-0', avatarGradient(user.id))}>
      {initials(user.full_name)}
    </div>
  );
};

const emptyForm = { username: '', full_name: '', email: '', department_id: '' as string | number, role_id: 2, password: '' };

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState('');
  const [filterRoleId, setFilterRoleId] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [selected, setSelected] = useState<User | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showView, setShowView] = useState(false);
  const [showDeleteId, setShowDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const { user: currentUser, canAccess } = useAuth();

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  };

  const fetchUsers = useCallback(async () => {
    const res = await apiGet('/api/admin/users');
    const data: User[] = await res.json();
    setUsers(data);
    setSelected(prev => prev ? (data.find(u => u.id === prev.id) ?? null) : null);
  }, []);

  const fetchRoles = useCallback(async () => {
    const res = await apiGet('/api/admin/roles');
    setRoles(await res.json());
  }, []);

  const fetchDepartments = useCallback(async () => {
    const res = await apiGet('/api/admin/departments');
    setDepartments(await res.json());
  }, []);

  useEffect(() => { fetchUsers(); fetchRoles(); fetchDepartments(); }, [fetchUsers, fetchRoles, fetchDepartments]);

  const roleName = (role_id: number) => roles.find(r => r.id === role_id)?.name ?? String(role_id);

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchQ = !q || u.username.toLowerCase().includes(q) || u.full_name.toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q) || (u.department ?? '').toLowerCase().includes(q);
    const matchRole = !filterRoleId || u.role_id === Number(filterRoleId);
    const matchActive = filterActive === '' || u.is_active === (filterActive === 'true');
    return matchQ && matchRole && matchActive;
  });

  const toggleActive = async (id: number) => {
    const res = await apiPatch(`/api/admin/users/${id}/toggle-active`);
    if (res.ok) {
      await fetchUsers();
      showToast(users.find(u => u.id === id)?.is_active ? 'Đã vô hiệu hoá tài khoản' : 'Đã kích hoạt tài khoản');
    }
  };

  const handleCreate = async () => {
    if (!form.username || !form.password || !form.full_name) return;
    setSaving(true);
    try {
      const res = await apiPost('/api/admin/users', {
        ...form,
        department_id: form.department_id ? Number(form.department_id) : null,
      });
      if (res.ok) {
        await fetchUsers();
        setShowCreate(false);
        setForm(emptyForm);
        showToast('Tạo người dùng thành công');
      } else {
        const err = await res.json();
        showToast(err.detail ?? 'Lỗi tạo người dùng', false);
      }
    } finally { setSaving(false); }
  };

  const handleEdit = async () => {
    if (!selected) return;
    setSaving(true);
    const payload: Record<string, unknown> = {
      full_name: form.full_name, email: form.email || null,
      department_id: form.department_id ? Number(form.department_id) : null,
      role_id: form.role_id,
    };
    if (form.password) payload.password = form.password;
    try {
      const res = await apiPatch(`/api/admin/users/${selected.id}`, payload);
      if (res.ok) {
        await fetchUsers();
        setShowEdit(false);
        showToast('Cập nhật thành công');
      } else {
        showToast('Lỗi cập nhật', false);
      }
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    const res = await apiDelete(`/api/admin/users/${id}`);
    if (res.ok || res.status === 204) {
      await fetchUsers();
      setShowDeleteId(null);
      if (selected?.id === id) setSelected(null);
      showToast('Đã xoá người dùng');
    } else {
      showToast('Lỗi xoá người dùng', false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selected || !e.target.files?.[0]) return;
    setAvatarLoading(true);
    const fd = new FormData();
    fd.append('file', e.target.files[0]);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/admin/users/${selected.id}/avatar`, {
        method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (res.ok) { await fetchUsers(); showToast('Cập nhật ảnh đại diện thành công'); }
      else showToast('Lỗi upload ảnh', false);
    } finally { setAvatarLoading(false); e.target.value = ''; }
  };

  const openEdit = (u: User) => {
    setForm({ username: u.username, full_name: u.full_name, email: u.email ?? '', department_id: u.department_id ?? '', role_id: u.role_id, password: '' });
    setShowEdit(true);
  };

  const activeCount = users.filter(u => u.is_active).length;

  return (
    <div className="flex gap-5 animate-fade-in" style={{ minHeight: 'calc(100vh - 8rem)' }}>
      {/* ── Left: list ── */}
      <div className="flex flex-col flex-1 min-w-0 gap-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-bold text-text-primary">Quản lý người dùng</h1>
            <p className="text-[13px] text-text-muted mt-0.5">
              {filtered.length} / {users.length} người dùng &middot; {activeCount} hoạt động
            </p>
          </div>
          {canAccess(9) && (
            <button
              onClick={() => { setForm(emptyForm); setShowCreate(true); }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-accent hover:bg-accent-hover text-white rounded-xl text-[13px] font-semibold transition-colors flex-shrink-0"
            >
              <Plus className="w-4 h-4" /> Thêm người dùng
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-44">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm kiếm tên, email, phòng ban..." className="input-base pl-9 py-2 text-[13px] w-full" />
          </div>
          <div className="relative">
            <select value={filterRoleId} onChange={e => setFilterRoleId(e.target.value)} className="input-base py-2 pl-3 pr-8 text-[13px] appearance-none">
              <option value="">Tất cả vai trò</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
          </div>
          <div className="relative">
            <select value={filterActive} onChange={e => setFilterActive(e.target.value)} className="input-base py-2 pl-3 pr-8 text-[13px] appearance-none">
              <option value="">Tất cả trạng thái</option>
              <option value="true">Hoạt động</option>
              <option value="false">Vô hiệu</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
          </div>
        </div>

        {/* Table View */}
        <div className="bg-elevated border border-border rounded-xl overflow-hidden shadow-sm mt-2">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="border-b border-border bg-surface/50 text-[12px] text-text-muted uppercase tracking-wider font-semibold">
                  <th className="px-5 py-4 font-semibold w-[20%]">Người dùng</th>
                  <th className="px-5 py-4 font-semibold w-[20%]">Email</th>
                  <th className="px-5 py-4 font-semibold w-[15%]">Phòng ban</th>
                  <th className="px-5 py-4 font-semibold text-center w-[15%]">Vai trò</th>
                  <th className="px-5 py-4 font-semibold text-center w-[10%]">Trạng thái</th>
                  <th className="px-5 py-4 font-semibold w-[10%]">Đăng nhập cuối</th>
                  <th className="px-5 py-4 font-semibold text-right w-[10%]">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center text-text-muted text-[13px]">
                      Không tìm thấy người dùng
                    </td>
                  </tr>
                ) : (
                  filtered.map(u => {
                    const rname = roleName(u.role_id);
                    return (
                      <tr key={u.id} className="hover:bg-surface/40 transition-colors group">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <UserAvatar user={u} size="md" />
                            <div>
                              <p className="text-[14px] font-semibold text-text-primary">{u.full_name}</p>
                              <p className="text-[12px] text-text-muted font-mono">@{u.username}</p>
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
                            <span className="text-[12px] text-text-muted italic">Chưa có email</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {u.department ? (
                            <div className="flex items-center gap-1.5 text-[12px] text-text-muted">
                              <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate max-w-[150px]">{u.department}</span>
                            </div>
                          ) : (
                            <span className="text-[12px] text-text-muted italic">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-full border inline-block', ROLE_COLORS[rname] ?? 'bg-surface border-border text-text-muted')}>
                            {rname}
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
                            <span>{fmtDate(u.last_login)}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => { setSelected(u); setShowView(true); }}
                              className="w-8 h-8 rounded-lg bg-surface hover:bg-elevated text-text-secondary hover:text-text-primary flex items-center justify-center transition-colors border border-border"
                              title="Xem chi tiết"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {canAccess(9) && (!['admin'].includes(rname.toLowerCase()) && currentUser?.id !== u.id) && (
                              <button
                                onClick={() => toggleActive(u.id)}
                                className={cn('w-8 h-8 rounded-lg flex items-center justify-center transition-colors border',
                                  u.is_active
                                    ? 'border-warning/40 text-warning hover:bg-warning/10'
                                    : 'border-success/40 text-success hover:bg-success/10'
                                )}
                                title={u.is_active ? 'Vô hiệu hoá' : 'Kích hoạt'}
                              >
                                {u.is_active ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                              </button>
                            )}
                            {canAccess(9) && (
                              <button
                                onClick={() => { openEdit(u); setSelected(u); }}
                                className="w-8 h-8 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent flex items-center justify-center transition-colors border border-accent/20"
                                title="Sửa"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            {canAccess(9) && (!['admin'].includes(rname.toLowerCase()) && currentUser?.id !== u.id) && (
                              <button
                                onClick={() => setShowDeleteId(u.id)}
                                className="w-8 h-8 rounded-lg bg-danger/10 hover:bg-danger/20 text-danger flex items-center justify-center transition-colors border border-danger/20"
                                title="Xoá"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── View Slide Drawer ── */}
      {showView && selected && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setShowView(false)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[420px] bg-elevated border-l border-border shadow-2xl flex flex-col"
               style={{ animation: 'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-[16px] font-bold text-text-primary">Chi tiết người dùng</h2>
              <button onClick={() => setShowView(false)} className="btn-icon w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col items-center py-6 gap-2 border-b border-border">
                <UserAvatar user={selected} size="lg" />
                <div className="text-center mt-2">
                  <p className="text-[16px] font-bold text-text-primary">{selected.full_name}</p>
                  <p className="text-[13px] text-text-muted font-mono">@{selected.username}</p>
                </div>
                <span className={cn('text-[11px] font-bold px-3 py-1 rounded-full border mt-1', ROLE_COLORS[roleName(selected.role_id)] ?? 'bg-surface border-border text-text-muted')}>
                  {roleName(selected.role_id)}
                </span>
              </div>

              <div className="space-y-5 p-5">
                {[
                  { icon: Mail, label: 'Email', val: selected.email },
                  { icon: Building2, label: 'Phòng ban', val: selected.department },
                  { icon: Calendar, label: 'Ngày tạo', val: fmtDate(selected.created_at) },
                  { icon: Clock, label: 'Đăng nhập cuối', val: fmtDate(selected.last_login) },
                ].map(({ icon: Icon, label, val }) => (
                  <div key={label} className="flex flex-col">
                    <p className="text-[12px] text-text-muted mb-0.5 flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" />{label}</p>
                    <p className="text-[14px] text-text-primary pl-5">{val ?? '—'}</p>
                  </div>
                ))}

                <div className="flex flex-col">
                  <p className="text-[12px] text-text-muted mb-1 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" />Trạng thái</p>
                  <div className="pl-5 flex items-center gap-2">
                    <span className={cn('w-2.5 h-2.5 rounded-full', selected.is_active ? 'bg-success' : 'bg-text-muted')} />
                    <span className="text-[14px] text-text-primary">{selected.is_active ? 'Đang hoạt động' : 'Vô hiệu hoá'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <style>{`
            @keyframes slideInRight {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
          `}</style>
        </>
      )}

      {/* ── Create modal ── */}
      {showCreate && (
        <Modal title="Thêm người dùng mới" onClose={() => setShowCreate(false)}>
          <UserForm form={form} setForm={setForm} roles={roles} departments={departments} showPassword canAssignAdmin={canAccess(10)} />
          <div className="flex gap-2 mt-5">
            <button onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-lg border border-border text-text-secondary text-[13px] hover:bg-hover transition-colors">Hủy</button>
            <button
              onClick={handleCreate} disabled={saving || !form.username || !form.password || !form.full_name}
              className="flex-1 py-2 rounded-lg bg-accent text-white text-[13px] font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {saving ? 'Đang tạo...' : 'Tạo người dùng'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Edit modal ── */}
      {showEdit && selected && (
        <Modal title={`Chỉnh sửa — ${selected.full_name}`} onClose={() => setShowEdit(false)}>
          <div className="flex justify-center mb-6">
            <div className="relative">
              <UserAvatar user={selected} size="lg" />
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarLoading}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-accent hover:bg-accent-hover border-2 border-elevated flex items-center justify-center transition-colors disabled:opacity-50 shadow-md cursor-pointer"
                title="Đổi ảnh đại diện"
              >
                {avatarLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Camera className="w-4 h-4 text-white" />}
              </button>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>
          </div>
          <UserForm form={form} setForm={setForm} roles={roles} departments={departments} showPassword passwordOptional canAssignAdmin={canAccess(10)} />
          <div className="flex gap-2 mt-5">
            <button onClick={() => setShowEdit(false)} className="flex-1 py-2 rounded-lg border border-border text-text-secondary text-[13px] hover:bg-hover transition-colors">Hủy</button>
            <button
              onClick={handleEdit} disabled={saving}
              className="flex-1 py-2 rounded-lg bg-accent text-white text-[13px] font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {saving ? 'Đang lưu...' : <><Check className="w-3.5 h-3.5" /> Lưu thay đổi</>}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Delete confirm ── */}
      {showDeleteId !== null && (
        <Modal title="Xác nhận xoá" onClose={() => setShowDeleteId(null)} width="sm">
          <p className="text-[13px] text-text-secondary">
            Bạn có chắc muốn xoá người dùng <span className="font-semibold text-text-primary">{users.find(u => u.id === showDeleteId)?.full_name}</span>? Hành động này không thể hoàn tác.
          </p>
          <div className="flex gap-2 mt-5">
            <button onClick={() => setShowDeleteId(null)} className="flex-1 py-2 rounded-lg border border-border text-text-secondary text-[13px] hover:bg-hover transition-colors">Hủy</button>
            <button
              onClick={() => handleDelete(showDeleteId)}
              className="flex-1 py-2 rounded-lg bg-danger text-white text-[13px] font-semibold hover:bg-danger/80 transition-colors"
            >
              Xoá người dùng
            </button>
          </div>
        </Modal>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className={cn(
          'fixed bottom-5 right-5 z-[100] px-4 py-2.5 rounded-xl text-[13px] font-medium shadow-lg flex items-center gap-2 animate-fade-in',
          toast.ok ? 'bg-success/20 border border-success/40 text-success' : 'bg-danger/20 border border-danger/40 text-danger'
        )}>
          {toast.ok ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
};

/* ── Reusable sub-components ── */

const Modal = ({ title, onClose, children, width = 'md' }: { title: string; onClose: () => void; children: React.ReactNode; width?: 'sm' | 'md' }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
    <div className={cn('bg-surface border border-border rounded-2xl p-6 shadow-2xl animate-fade-in', width === 'sm' ? 'w-full max-w-sm' : 'w-full max-w-md')}>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[16px] font-bold text-text-primary">{title}</h2>
        <button onClick={onClose} className="btn-icon w-7 h-7"><X className="w-3.5 h-3.5" /></button>
      </div>
      {children}
    </div>
  </div>
);

interface FormProps {
  form: typeof emptyForm;
  setForm: React.Dispatch<React.SetStateAction<typeof emptyForm>>;
  roles: Role[];
  departments: Department[];
  showPassword?: boolean;
  passwordOptional?: boolean;
  canAssignAdmin?: boolean;
}

const UserForm = ({ form, setForm, roles, departments, showPassword, passwordOptional, canAssignAdmin = false }: FormProps) => {
  const fields: { key: keyof typeof emptyForm; label: string; type: string; required?: boolean }[] = [
    { key: 'username', label: 'Tên đăng nhập', type: 'text', required: true },
    { key: 'full_name', label: 'Họ và tên', type: 'text', required: true },
    { key: 'email', label: 'Email', type: 'email' },
  ];
  if (showPassword) fields.splice(1, 0, { key: 'password', label: passwordOptional ? 'Mật khẩu mới (tuỳ chọn)' : 'Mật khẩu', type: 'password', required: !passwordOptional });

  return (
    <div className="space-y-3">
      {fields.map(({ key, label, type, required }) => (
        <div key={key}>
          <label className="text-[12px] text-text-secondary mb-1 block">
            {label}{required && <span className="text-danger ml-0.5">*</span>}
          </label>
          <input
            type={type}
            value={form[key] as string}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            className="input-base text-[13px]"
            autoComplete={type === 'password' ? 'new-password' : undefined}
          />
        </div>
      ))}
      {/* Phòng ban dropdown */}
      <div>
        <label className="text-[12px] text-text-secondary mb-1 block">Phòng ban</label>
        <div className="relative">
          <select
            value={form.department_id}
            onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}
            className="input-base text-[13px] appearance-none pr-8"
          >
            <option value="">— Chưa phân công —</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
        </div>
      </div>
      {/* Vai trò dropdown */}
      <div>
        <label className="text-[12px] text-text-secondary mb-1 block">Vai trò</label>
        <div className="relative">
          <select
            value={form.role_id}
            onChange={e => setForm(f => ({ ...f, role_id: Number(e.target.value) }))}
            className="input-base text-[13px] appearance-none pr-8"
          >
            {roles.filter(r => canAssignAdmin || r.name !== 'admin').map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
        </div>
      </div>
    </div>
  );
};

export default UsersPage;
