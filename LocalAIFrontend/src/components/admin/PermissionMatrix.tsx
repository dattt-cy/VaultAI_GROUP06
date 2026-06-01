import React, { useState, useEffect, useCallback } from 'react';
import { Eye, Upload, Trash2, Save, CheckCircle2, ChevronsUpDown, CheckCheck, X } from 'lucide-react';
import { apiGet, apiPut } from '../../utils/apiClient';

interface Role { id: number; name: string; access_level: number }
interface Category { id: number; name: string }
interface Perm { can_view: boolean; can_upload: boolean; can_delete: boolean }
type Matrix = Record<number, Record<number, Perm>>;

const defaultPerm = (): Perm => ({ can_view: false, can_upload: false, can_delete: false });

const PERM_CONFIG = [
  { key: 'can_view',   label: 'Xem',    Icon: Eye,    active: 'bg-accent/20 text-accent border-accent/50',    inactive: 'bg-surface text-text-muted/40 border-border/50' },
  { key: 'can_upload', label: 'Upload', Icon: Upload, active: 'bg-success/20 text-success border-success/50', inactive: 'bg-surface text-text-muted/40 border-border/50' },
  { key: 'can_delete', label: 'Xóa',   Icon: Trash2, active: 'bg-danger/20 text-danger border-danger/50',    inactive: 'bg-surface text-text-muted/40 border-border/50' },
] as const;

export const PermissionMatrix: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [matrix, setMatrix] = useState<Matrix>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    const [rolesRes, catsRes, permsRes] = await Promise.all([
      apiGet('/api/admin/roles'),
      apiGet('/api/admin/categories'),
      apiGet('/api/admin/permissions'),
    ]);
    const rolesData: Role[] = await rolesRes.json();
    const catsData: Category[] = await catsRes.json();
    const permsData: Array<{ role_id: number; category_id: number } & Perm> = await permsRes.json();

    const m: Matrix = {};
    rolesData.forEach(r => {
      m[r.id] = {};
      catsData.forEach(c => { m[r.id][c.id] = { ...defaultPerm() }; });
    });
    permsData.forEach(p => {
      if (m[p.role_id]) {
        m[p.role_id][p.category_id] = { can_view: p.can_view, can_upload: p.can_upload, can_delete: p.can_delete };
      }
    });

    setRoles(rolesData);
    setCategories(catsData);
    setMatrix(m);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggle = (roleId: number, catId: number, field: keyof Perm) => {
    setMatrix(prev => ({
      ...prev,
      [roleId]: {
        ...prev[roleId],
        [catId]: { ...prev[roleId][catId], [field]: !prev[roleId][catId][field] },
      },
    }));
    setSaved(false);
  };

  // ── Bulk: set all categories for a role ──
  const setRowAll = (roleId: number, perm: Partial<Perm>) => {
    setMatrix(prev => {
      const updated = { ...prev[roleId] };
      categories.forEach(c => { updated[c.id] = { ...updated[c.id], ...perm }; });
      return { ...prev, [roleId]: updated };
    });
    setSaved(false);
  };

  // ── Bulk: set all roles for a category ──
  const setColAll = (catId: number, perm: Partial<Perm>) => {
    setMatrix(prev => {
      const updated = { ...prev };
      roles.forEach(r => { updated[r.id] = { ...updated[r.id], [catId]: { ...updated[r.id][catId], ...perm } }; });
      return updated;
    });
    setSaved(false);
  };

  // Check if a row has ALL perms on or off
  const rowAllOn  = (roleId: number, field: keyof Perm) => categories.every(c => matrix[roleId]?.[c.id]?.[field]);
  const rowAllOff = (roleId: number, field: keyof Perm) => categories.every(c => !matrix[roleId]?.[c.id]?.[field]);
  const colAllOn  = (catId: number,  field: keyof Perm) => roles.every(r => matrix[r.id]?.[catId]?.[field]);

  const savePermissions = async () => {
    setSaving(true);
    const items = roles.flatMap(r =>
      categories.map(c => ({
        role_id: r.id,
        category_id: c.id,
        ...(matrix[r.id]?.[c.id] ?? defaultPerm()),
      }))
    );
    await apiPut('/api/admin/permissions', items);
    setSaving(false);
    setSaved(true);
  };

  if (roles.length === 0 || categories.length === 0) {
    return <div className="flex items-center justify-center py-12 text-text-muted text-[13px]">Đang tải...</div>;
  }

  return (
    <div className="space-y-5">
      {/* Legend */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-[13px] text-text-muted">
          Click ô đơn lẻ, hoặc dùng nút <span className="text-accent font-medium">theo hàng / cột</span> để bật/tắt hàng loạt
        </p>
        <div className="flex items-center gap-2">
          {PERM_CONFIG.map(p => {
            const Icon = p.Icon;
            return (
              <span key={p.key} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium ${p.active}`}>
                <Icon className="w-3 h-3" /> {p.label}
              </span>
            );
          })}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full border-collapse text-left min-w-[600px]">
          <thead>
            {/* ── Column bulk-action header ── */}
            <tr className="bg-surface/50 border-b border-border/50">
              <th className="px-5 py-2 text-[10px] font-bold text-text-muted uppercase tracking-wider w-52">
                <div className="flex items-center gap-1 text-text-muted/60">
                  <ChevronsUpDown className="w-3 h-3" />
                  Cột / Hàng
                </div>
              </th>
              {categories.map(cat => (
                <th key={cat.id} className="px-3 py-2">
                  <div className="flex flex-col items-center gap-1">
                    {/* 3 column-toggle buttons */}
                    {PERM_CONFIG.map(({ key, Icon, active, inactive }) => {
                      const allOn = colAllOn(cat.id, key as keyof Perm);
                      return (
                        <button
                          key={key}
                          onClick={() => setColAll(cat.id, { [key]: !allOn })}
                          title={`${allOn ? 'Tắt' : 'Bật'} "${key.replace('can_', '')}" toàn cột`}
                          className={`w-full flex items-center justify-center gap-1 py-0.5 px-1.5 rounded border text-[9px] font-bold transition-all ${allOn ? active : inactive} hover:opacity-80`}
                        >
                          <Icon className="w-2.5 h-2.5 flex-shrink-0" />
                          {allOn ? 'Tắt' : 'Bật'}
                        </button>
                      );
                    })}
                  </div>
                </th>
              ))}
            </tr>

            {/* ── Category name header ── */}
            <tr className="bg-surface/80">
              <th className="px-5 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-border">
                Vai trò
              </th>
              {categories.map(cat => (
                <th key={cat.id} className="px-3 py-3 text-[12px] font-semibold text-text-secondary border-b border-border text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center text-accent text-[10px] font-bold">
                      {cat.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="max-w-[90px] truncate text-[11px]">{cat.name}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {roles.map((role, idx) => (
              <tr
                key={role.id}
                className={`border-b border-border last:border-0 transition-colors ${idx % 2 === 0 ? 'bg-elevated' : 'bg-surface/30'} hover:bg-accent/5`}
              >
                {/* ── Role cell + row bulk actions ── */}
                <td className="px-5 py-3 w-52">
                  <div className="flex flex-col gap-2">
                    <div>
                      <span className="text-[13px] font-bold text-text-primary capitalize">{role.name}</span>
                      <span className="ml-2 text-[10px] text-text-muted">Lv.{role.access_level}</span>
                    </div>
                    {/* Row bulk buttons */}
                    <div className="flex flex-wrap gap-1">
                      {/* Grant all */}
                      <button
                        onClick={() => setRowAll(role.id, { can_view: true, can_upload: true, can_delete: true })}
                        title="Cấp toàn quyền tất cả danh mục"
                        className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent/10 text-accent border border-accent/30 text-[10px] font-semibold hover:bg-accent/20 transition-colors"
                      >
                        <CheckCheck className="w-3 h-3" /> Tất cả
                      </button>
                      {/* View only */}
                      <button
                        onClick={() => setRowAll(role.id, { can_view: true, can_upload: false, can_delete: false })}
                        title="Chỉ cấp quyền Xem"
                        className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent/10 text-accent border border-accent/30 text-[10px] font-semibold hover:bg-accent/20 transition-colors"
                      >
                        <Eye className="w-3 h-3" /> Chỉ xem
                      </button>
                      {/* Clear all */}
                      <button
                        onClick={() => setRowAll(role.id, { can_view: false, can_upload: false, can_delete: false })}
                        title="Thu hồi tất cả quyền"
                        className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-danger/10 text-danger border border-danger/30 text-[10px] font-semibold hover:bg-danger/20 transition-colors"
                      >
                        <X className="w-3 h-3" /> Xóa hết
                      </button>
                    </div>
                  </div>
                </td>

                {/* ── Permission pills per category ── */}
                {categories.map(cat => {
                  const p = matrix[role.id]?.[cat.id] ?? defaultPerm();
                  const anyOn = p.can_view || p.can_upload || p.can_delete;
                  return (
                    <td key={cat.id} className={`px-3 py-3 transition-colors ${anyOn ? '' : 'opacity-40'}`}>
                      <div className="flex flex-col items-center gap-1">
                        {PERM_CONFIG.map(({ key, label, Icon, active, inactive }) => {
                          const isOn = p[key as keyof Perm];
                          return (
                            <button
                              key={key}
                              onClick={() => toggle(role.id, cat.id, key as keyof Perm)}
                              title={`${isOn ? 'Thu hồi' : 'Cấp'} quyền ${label}`}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold transition-all duration-150 ${isOn ? active : inactive} hover:opacity-80`}
                            >
                              <Icon className="w-2.5 h-2.5" />
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Save bar */}
      <div className="flex items-center justify-between pt-1">
        <div>
          {saved && (
            <span className="flex items-center gap-1.5 text-[12px] text-success animate-fade-in">
              <CheckCircle2 className="w-3.5 h-3.5" /> Đã lưu thay đổi thành công
            </span>
          )}
        </div>
        <button
          onClick={savePermissions}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-accent text-white text-[13px] font-semibold hover:bg-accent-hover transition-all shadow-sm hover:shadow-accent/30 hover:shadow-md disabled:opacity-50"
        >
          {saving
            ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin-fast" />Đang lưu...</>
            : <><Save className="w-3.5 h-3.5" />Lưu phân quyền</>
          }
        </button>
      </div>
    </div>
  );
};
