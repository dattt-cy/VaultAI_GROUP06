import React, { useState } from 'react';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { mockCategories } from '../../mocks/adminMocks';

type Category = typeof mockCategories[0];

const CategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState(mockCategories);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '' });

  const startEdit = (cat: Category) => {
    setEditId(cat.id);
    setEditForm({ name: cat.name, description: cat.description });
  };

  const saveEdit = () => {
    setCategories(prev => prev.map(c => c.id === editId ? { ...c, ...editForm } : c));
    setEditId(null);
  };

  const deleteCategory = (id: number) => {
    const cat = categories.find(c => c.id === id);
    if (cat && cat.document_count > 0) {
      alert(`Không thể xóa danh mục "${cat.name}" vì còn ${cat.document_count} tài liệu liên kết.`);
      return;
    }
    setCategories(prev => prev.filter(c => c.id !== id));
  };

  const handleCreate = () => {
    if (!createForm.name.trim()) return;
    setCategories(prev => [...prev, { id: Date.now(), ...createForm, document_count: 0, created_at: new Date().toISOString().split('T')[0] }]);
    setCreateForm({ name: '', description: '' });
    setShowCreate(false);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-text-primary">Danh mục tài liệu</h1>
          <p className="text-[13px] text-text-muted mt-0.5">{categories.length} danh mục</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-[13px] font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" /> Thêm danh mục
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-elevated border border-accent/30 rounded-xl p-4 space-y-3 animate-fade-in">
          <p className="text-[13px] font-semibold text-text-primary">Danh mục mới</p>
          <div className="flex gap-3">
            <input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="Tên danh mục" className="input-base flex-1" />
            <input value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} placeholder="Mô tả" className="input-base flex-1" />
            <button onClick={handleCreate} className="btn-icon w-9 h-9 border-success/40 hover:bg-success/10 hover:text-success hover:border-success/60"><Check className="w-4 h-4" /></button>
            <button onClick={() => setShowCreate(false)} className="btn-icon w-9 h-9 hover:text-danger hover:border-danger/50"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Category list */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface">
              {['Tên danh mục', 'Mô tả', 'Tài liệu', 'Ngày tạo', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-[11px] font-semibold text-text-secondary uppercase tracking-wide border-b border-border">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => (
              <tr key={cat.id} className="border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
                <td className="px-4 py-3">
                  {editId === cat.id ? (
                    <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="input-base py-1" autoFocus />
                  ) : (
                    <span className="text-[13px] font-semibold text-text-primary">{cat.name}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editId === cat.id ? (
                    <input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="input-base py-1" />
                  ) : (
                    <span className="text-[13px] text-text-secondary">{cat.description}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[13px] font-semibold ${cat.document_count > 0 ? 'text-accent' : 'text-text-muted'}`}>{cat.document_count}</span>
                </td>
                <td className="px-4 py-3 text-[12px] text-text-muted">{cat.created_at}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 justify-end">
                    {editId === cat.id ? (
                      <>
                        <button onClick={saveEdit} className="btn-icon w-7 h-7 hover:text-success hover:border-success/50"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditId(null)} className="btn-icon w-7 h-7 hover:text-danger hover:border-danger/50"><X className="w-3.5 h-3.5" /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(cat)} className="btn-icon w-7 h-7 hover:text-accent hover:border-accent/50"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteCategory(cat.id)} className="btn-icon w-7 h-7 hover:text-danger hover:border-danger/50"><Trash2 className="w-3.5 h-3.5" /></button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CategoriesPage;
