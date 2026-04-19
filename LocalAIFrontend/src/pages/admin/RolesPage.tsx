import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { mockRoles } from '../../mocks/adminMocks';
import { PermissionMatrix } from '../../components/admin/PermissionMatrix';

type Role = typeof mockRoles[0];
type Tab = 'roles' | 'permissions';

const RolesPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('roles');
  const [roles, setRoles] = useState(mockRoles);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', access_level: 1, description: '' });

  const handleCreate = () => {
    setRoles(prev => [...prev, { id: Date.now(), ...form }]);
    setShowModal(false);
    setForm({ name: '', access_level: 1, description: '' });
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-[20px] font-bold text-text-primary">Vai trò & Phân quyền danh mục</h1>
        <p className="text-[13px] text-text-muted mt-0.5">Quản lý vai trò và cấp quyền truy cập tài liệu theo danh mục</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface border border-border rounded-xl p-1 w-fit">
        {[{ key: 'roles', label: 'Danh sách vai trò' }, { key: 'permissions', label: 'Ma trận phân quyền' }].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as Tab)}
            className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${tab === t.key ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary hover:bg-hover'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'roles' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-[13px] font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" /> Thêm vai trò
            </button>
          </div>

          <div className="grid gap-3">
            {roles.map(role => (
              <div key={role.id} className="bg-elevated border border-border rounded-xl p-4 flex items-center justify-between hover:border-accent/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-accent/15 flex items-center justify-center">
                    <span className="text-[13px] font-bold text-accent">{role.access_level}</span>
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-text-primary">{role.name}</p>
                    <p className="text-[12px] text-text-muted">{role.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-text-muted">Cấp độ {role.access_level}</span>
                  {role.name !== 'admin' && (
                    <button
                      onClick={() => setRoles(prev => prev.filter(r => r.id !== role.id))}
                      className="btn-icon w-7 h-7 hover:text-danger hover:border-danger/50"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'permissions' && (
        <div className="bg-elevated border border-border rounded-xl p-5">
          <PermissionMatrix />
        </div>
      )}

      {/* Create modal */}
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
              <button onClick={handleCreate} className="flex-1 py-2 rounded-lg bg-accent text-white text-[13px] font-semibold hover:bg-accent-hover transition-colors">Tạo vai trò</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RolesPage;
