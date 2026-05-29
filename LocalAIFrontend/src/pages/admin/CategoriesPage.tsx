import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, Check, FolderOpen } from 'lucide-react';
import { apiGet, apiPost, apiPatch, apiDelete } from '../../utils/apiClient';
import { PageHeader } from '../../components/admin/ui/PageHeader';
import { Skeleton } from '../../components/admin/ui/Skeleton';
import { EmptyState } from '../../components/admin/ui/EmptyState';
import { useToast } from '../../components/admin/ui/Toast';

interface Category {
  id: number;
  name: string;
  description: string;
  document_count: number;
  created_at: string;
}

const CategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();

  const fetchCategories = useCallback(async () => {
    try {
      const res = await apiGet('/api/admin/categories');
      setCategories(await res.json());
    } catch (err) {
      toast.error('Không tải được danh mục', String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const startEdit = (cat: Category) => {
    setEditId(cat.id);
    setEditForm({ name: cat.name, description: cat.description ?? '' });
  };

  const saveEdit = async () => {
    try {
      await apiPatch(`/api/admin/categories/${editId}`, editForm);
      setEditId(null);
      toast.success('Đã cập nhật danh mục');
      fetchCategories();
    } catch (err) {
      toast.error('Cập nhật thất bại', String(err));
    }
  };

  const deleteCategory = async (id: number, name: string) => {
    if (!window.confirm(`Xoá danh mục "${name}"? Hành động này không thể hoàn tác.`)) return;
    try {
      const res = await apiDelete(`/api/admin/categories/${id}`);
      if (res.status === 400) {
        const err = await res.json();
        toast.warning('Không thể xoá', err.detail);
      } else {
        toast.success('Đã xoá danh mục');
        fetchCategories();
      }
    } catch (err) {
      toast.error('Xoá thất bại', String(err));
    }
  };

  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      toast.warning('Nhập tên danh mục');
      return;
    }
    try {
      await apiPost('/api/admin/categories', createForm);
      setCreateForm({ name: '', description: '' });
      setShowCreate(false);
      toast.success('Đã tạo danh mục');
      fetchCategories();
    } catch (err) {
      toast.error('Tạo danh mục thất bại', String(err));
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Danh mục tài liệu"
        subtitle={`${categories.length.toLocaleString('vi-VN')} danh mục`}
        icon={<FolderOpen className="w-5 h-5 text-text-secondary" />}
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-[13px] font-semibold transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Thêm danh mục
          </button>
        }
      />

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
            {isLoading && Array.from({ length: 4 }).map((_, i) => (
              <tr key={`skel-${i}`} className="border-b border-border last:border-0">
                {Array.from({ length: 5 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><Skeleton className="h-3 w-full" /></td>
                ))}
              </tr>
            ))}
            {!isLoading && categories.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <EmptyState
                    icon={FolderOpen}
                    title="Chưa có danh mục"
                    description="Tạo danh mục để phân loại tài liệu."
                    compact
                  />
                </td>
              </tr>
            )}
            {!isLoading && categories.map(cat => (
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
                <td className="px-4 py-3 text-[12px] text-text-muted">{cat.created_at?.split('T')[0] ?? '—'}</td>
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
                        <button onClick={() => deleteCategory(cat.id, cat.name)} className="btn-icon w-7 h-7 hover:text-danger hover:border-danger/50"><Trash2 className="w-3.5 h-3.5" /></button>
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
