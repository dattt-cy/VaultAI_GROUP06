import React, { useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { AdminTable, StatusBadge, ActiveToggle } from '../../components/admin/AdminTable';
import { mockUsers, mockRoles } from '../../mocks/adminMocks';

type User = typeof mockUsers[0];

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState(mockUsers);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ username: '', full_name: '', email: '', department: '', role: 'user', password: '' });

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchQ = !q || u.username.toLowerCase().includes(q) || u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchRole = !filterRole || u.role === filterRole;
    const matchActive = filterActive === '' ? true : u.is_active === (filterActive === 'true');
    return matchQ && matchRole && matchActive;
  });

  const toggleActive = (id: number) => setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: !u.is_active } : u));

  const handleCreate = () => {
    const newUser: User = {
      id: Date.now(),
      ...form,
      is_active: true,
      last_login: '—',
      created_at: new Date().toISOString(),
    };
    setUsers(prev => [newUser, ...prev]);
    setShowModal(false);
    setForm({ username: '', full_name: '', email: '', department: '', role: 'user', password: '' });
  };

  const formatDate = (iso: string) => iso === '—' ? '—' : new Date(iso).toLocaleDateString('vi-VN');

  const columns = [
    { key: 'username', label: 'Tên đăng nhập', render: (u: User) => <span className="font-mono text-[13px] text-accent">{u.username}</span> },
    { key: 'full_name', label: 'Họ tên' },
    { key: 'email', label: 'Email', render: (u: User) => <span className="text-text-secondary">{u.email}</span> },
    { key: 'department', label: 'Phòng ban', render: (u: User) => <span className="text-text-secondary">{u.department}</span> },
    { key: 'role', label: 'Vai trò', render: (u: User) => <StatusBadge status={u.role} /> },
    { key: 'is_active', label: 'Trạng thái', render: (u: User) => <ActiveToggle active={u.is_active} /> },
    { key: 'last_login', label: 'Đăng nhập cuối', render: (u: User) => <span className="text-text-muted text-[12px]">{formatDate(u.last_login)}</span> },
    {
      key: 'actions', label: 'Thao tác',
      render: (u: User) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleActive(u.id)}
            className={`text-[11px] px-2 py-0.5 rounded-md border transition-colors font-medium ${u.is_active ? 'border-danger/40 text-danger hover:bg-danger/10' : 'border-success/40 text-success hover:bg-success/10'}`}
          >
            {u.is_active ? 'Vô hiệu' : 'Kích hoạt'}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-text-primary">Quản lý người dùng</h1>
          <p className="text-[13px] text-text-muted mt-0.5">{filtered.length} / {users.length} người dùng</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-[13px] font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" /> Thêm người dùng
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm kiếm..." className="input-base pl-9 py-2" />
        </div>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="input-base w-auto py-2 pr-8">
          <option value="">Tất cả vai trò</option>
          {mockRoles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
        </select>
        <select value={filterActive} onChange={e => setFilterActive(e.target.value)} className="input-base w-auto py-2 pr-8">
          <option value="">Tất cả trạng thái</option>
          <option value="true">Hoạt động</option>
          <option value="false">Vô hiệu</option>
        </select>
      </div>

      <AdminTable columns={columns} data={filtered} rowKey={u => u.id} emptyText="Không tìm thấy người dùng" />

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[16px] font-bold text-text-primary">Thêm người dùng mới</h2>
              <button onClick={() => setShowModal(false)} className="btn-icon w-7 h-7"><X className="w-3.5 h-3.5" /></button>
            </div>
            <div className="space-y-3">
              {[
                { key: 'username', label: 'Tên đăng nhập', type: 'text' },
                { key: 'password', label: 'Mật khẩu', type: 'password' },
                { key: 'full_name', label: 'Họ và tên', type: 'text' },
                { key: 'email', label: 'Email', type: 'email' },
                { key: 'department', label: 'Phòng ban', type: 'text' },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label className="text-[12px] text-text-secondary mb-1 block">{label}</label>
                  <input
                    type={type}
                    value={(form as Record<string, string>)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="input-base"
                  />
                </div>
              ))}
              <div>
                <label className="text-[12px] text-text-secondary mb-1 block">Vai trò</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="input-base">
                  {mockRoles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 rounded-lg border border-border text-text-secondary text-[13px] hover:bg-hover transition-colors">Hủy</button>
              <button onClick={handleCreate} className="flex-1 py-2 rounded-lg bg-accent text-white text-[13px] font-semibold hover:bg-accent-hover transition-colors">Tạo người dùng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
