import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, Users, ShieldCheck, Trash2, Edit2 } from 'lucide-react';
import { apiGet, apiPost, apiDelete, apiPut, apiPatch } from '../../utils/apiClient';
import { useAuth } from '../../contexts/AuthContext';

interface Role { id: number; name: string; access_level: number; description: string; user_count: number }

const RolesPage: React.FC = () => {
  const { canAccess } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Role | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({ name: '', access_level: 1, description: '' });
  const [saving, setSaving] = useState(false);

  const fetchRoles = useCallback(async () => {
    const res = await apiGet('/api/admin/roles');
    setRoles(await res.json());
  }, []);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editTarget) {
        await apiPatch(`/api/admin/roles/${editTarget.id}`, form);
      } else {
        await apiPost('/api/admin/roles', form);
      }
      await fetchRoles();
      closeModal();
    } finally {
      setSaving(false);
    }
  };

  const openModal = (role?: Role) => {
    if (role) {
      setEditTarget(role);
      setForm({ name: role.name, access_level: role.access_level, description: role.description || '' });
    } else {
      setEditTarget(null);
      setForm({ name: '', access_level: 1, description: '' });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditTarget(null);
  };

  const deleteRole = async (id: number) => {
    setDeleting(true);
    try {
      const res = await apiDelete(`/api/admin/roles/${id}`);
      if (res.status === 400) {
        const err = await res.json();
        alert(err.detail);
      } else {
        fetchRoles();
      }
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold text-text-primary">Vai trò</h1>
          <p className="text-[13px] text-text-muted mt-0.5">{roles.length} vai trò trong hệ thống</p>
        </div>
        {canAccess(10) && (
          <button
            onClick={() => openModal()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-[13px] font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Thêm vai trò
          </button>
        )}
      </div>

      {/* ── Role Table ── */}
      <div className="bg-elevated border border-border rounded-xl overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface/60">
              <th className="px-5 py-3 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wide">Tên vai trò</th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wide">Mô tả</th>
              <th className="px-5 py-3 text-center text-[11px] font-semibold text-text-muted uppercase tracking-wide w-28">Cấp độ</th>
              <th className="px-5 py-3 text-center text-[11px] font-semibold text-text-muted uppercase tracking-wide w-28">Người dùng</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {roles.map(role => {
              const isAdmin = role.name === 'admin';
              return (
                <tr key={role.id} className="group border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className={`w-4 h-4 flex-shrink-0 ${isAdmin ? 'text-danger/70' : 'text-text-muted'}`} />
                      <span className="text-[13px] font-semibold text-text-primary capitalize">{role.name}</span>
                      {isAdmin && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-danger/10 text-danger/80 font-medium">Admin</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-[13px] text-text-muted">
                      {role.description || <span className="italic opacity-40">—</span>}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-surface border border-border text-[12px] font-mono text-text-secondary">
                      Lv.{role.access_level}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-[13px] text-text-secondary">
                      <Users className="w-3.5 h-3.5 text-text-muted" />
                      {role.user_count}
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-center">
                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      {canAccess(10) && (
                        <button
                          onClick={() => openModal(role)}
                          className="btn-icon w-7 h-7 hover:text-accent hover:border-accent/40"
                          title="Chỉnh sửa"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      )}
                      {!isAdmin && canAccess(10) && (
                        <button
                          onClick={() => setDeleteTarget(role)}
                          className="btn-icon w-7 h-7 hover:text-danger hover:border-danger/40"
                          title="Xóa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {roles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-[13px] text-text-muted">
                  Chưa có vai trò nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Delete Confirm ── */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="bg-surface border border-border rounded-xl shadow-xl p-5 w-full max-w-sm mx-4 animate-fade-in"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-[15px] font-semibold text-text-primary mb-1">Xóa vai trò &ldquo;<span className="capitalize">{deleteTarget.name}</span>&rdquo;?</h3>
            <p className="text-[13px] text-text-muted mb-5">Hành động này không thể hoàn tác.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg border border-border text-[13px] text-text-secondary hover:bg-hover transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={() => deleteRole(deleteTarget.id)}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg bg-danger text-white text-[13px] font-semibold hover:bg-danger/80 transition-colors flex items-center justify-center gap-1.5"
              >
                {deleting
                  ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin-fast" />
                  : <Trash2 className="w-3.5 h-3.5" />
                }
                {deleting ? 'Đang xóa...' : 'Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create/Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-xl w-full max-w-sm p-5 shadow-xl animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-semibold text-text-primary">
                {editTarget ? 'Chỉnh sửa vai trò' : 'Thêm vai trò'}
              </h2>
              <button onClick={closeModal} className="btn-icon w-7 h-7"><X className="w-3.5 h-3.5" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[12px] text-text-secondary mb-1 block">Tên vai trò</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="input-base"
                  placeholder="vd: accountant"
                  disabled={editTarget?.name === 'admin'}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[12px] text-text-secondary mb-1 flex justify-between">
                  <span>Cấp độ truy cập</span>
                  <span className="text-text-primary font-semibold">Lv.{form.access_level}</span>
                </label>
                <input
                  type="range" min={1} max={9} step={1}
                  value={form.access_level}
                  onChange={e => setForm(f => ({ ...f, access_level: Number(e.target.value) }))}
                  disabled={editTarget?.name === 'admin'}
                  className="w-full h-1.5 rounded-full accent-[var(--color-accent)]"
                />
                <div className="flex justify-between text-[10px] text-text-muted mt-1.5">
                  <div className="flex flex-col"><span className="font-bold">1</span><span>Chỉ xem</span></div>
                  <div className="flex flex-col items-center"><span className="font-bold">5</span><span>Biên tập</span></div>
                  <div className="flex flex-col items-end"><span className="font-bold">9</span><span>Quản lý</span></div>
                </div>
              </div>
              <div>
                <label className="text-[12px] text-text-secondary mb-1 block">Mô tả</label>
                <input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="input-base"
                  placeholder="Mô tả ngắn..."
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={closeModal} className="flex-1 py-2 rounded-lg border border-border text-[13px] text-text-secondary hover:bg-hover transition-colors">
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="flex-1 py-2 rounded-lg bg-accent text-white text-[13px] font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {saving
                  ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin-fast" />
                  : (editTarget ? <Edit2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />)
                }
                {saving ? 'Đang lưu...' : (editTarget ? 'Cập nhật' : 'Tạo mới')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RolesPage;
