import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, Users, ShieldCheck } from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '../../utils/apiClient';
import { PermissionMatrix } from '../../components/admin/PermissionMatrix';

interface Role { id: number; name: string; access_level: number; description: string; user_count: number }
type Tab = 'roles' | 'permissions';

const RolesPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('roles');
  const [roles, setRoles] = useState<Role[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', access_level: 1, description: '' });
  const [saving, setSaving] = useState(false);

  const fetchRoles = useCallback(async () => {
    const res = await apiGet('/api/admin/roles');
    setRoles(await res.json());
  }, []);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await apiPost('/api/admin/roles', form);
      await fetchRoles();
      setShowModal(false);
      setForm({ name: '', access_level: 1, description: '' });
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async (id: number) => {
    const res = await apiDelete(`/api/admin/roles/${id}`);
    if (res.status === 400) {
      const err = await res.json();
      alert(err.detail);
    } else {
      fetchRoles();
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-[20px] font-bold text-text-primary">Vai trò & Phân quyền danh mục</h1>
        <p className="text-[13px] text-text-muted mt-0.5">Quản lý vai trò và cấp quyền truy cập tài liệu theo danh mục</p>
      </div>

      <div className="flex gap-1 bg-surface border border-border rounded-xl p-1 w-fit">
        {[{ key: 'roles', label: 'Danh sách vai trò' }, { key: 'permissions', label: 'Ma trận phân quyền' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as Tab)} className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${tab === t.key ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary hover:bg-hover'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'roles' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-[13px] font-semibold transition-colors">
              <Plus className="w-4 h-4" /> Thêm vai trò
            </button>
          </div>

          <div className="bg-elevated border border-border rounded-xl overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface border-b border-border">
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wide w-48">Tên vai trò</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wide">Mô tả</th>
                  <th className="px-5 py-3 text-center text-[11px] font-semibold text-text-muted uppercase tracking-wide w-28">Cấp độ</th>
                  <th className="px-5 py-3 text-center text-[11px] font-semibold text-text-muted uppercase tracking-wide w-28">Người dùng</th>
                  <th className="px-5 py-3 w-12" />
                </tr>
              </thead>
              <tbody>
                {roles.map((role, idx) => (
                  <tr key={role.id} className={`border-b border-border last:border-0 hover:bg-surface/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-surface/20'}`}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck className="w-4 h-4 text-accent flex-shrink-0" />
                        <span className="text-[13px] font-semibold text-text-primary">{role.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-[13px] text-text-muted">{role.description || <span className="italic opacity-50">Chưa có mô tả</span>}</span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-accent/15 text-accent text-[12px] font-bold">
                        Lv.{role.access_level}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-text-muted" />
                        <span className="text-[13px] text-text-secondary">{role.user_count}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {role.name !== 'admin' && (
                        <button onClick={() => deleteRole(role.id)} className="btn-icon w-7 h-7 hover:text-danger hover:border-danger/50">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'permissions' && (
        <div className="bg-elevated border border-border rounded-xl p-5">
          <PermissionMatrix />
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[16px] font-bold text-text-primary">Thêm vai trò mới</h2>
              <button onClick={() => setShowModal(false)} className="btn-icon w-7 h-7"><X className="w-3.5 h-3.5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[12px] text-text-secondary mb-1 block">Tên vai trò</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-base" placeholder="vd: accountant" />
              </div>
              <div>
                <label className="text-[12px] text-text-secondary mb-1 block">Cấp độ truy cập (1–10)</label>
                <input type="number" min={1} max={9} value={form.access_level} onChange={e => setForm(f => ({ ...f, access_level: Number(e.target.value) }))} className="input-base" />
              </div>
              <div>
                <label className="text-[12px] text-text-secondary mb-1 block">Mô tả</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input-base" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 rounded-lg border border-border text-text-secondary text-[13px] hover:bg-hover transition-colors">Hủy</button>
              <button onClick={handleCreate} disabled={saving} className="flex-1 py-2 rounded-lg bg-accent text-white text-[13px] font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50">
                {saving ? 'Đang tạo...' : 'Tạo vai trò'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RolesPage;
