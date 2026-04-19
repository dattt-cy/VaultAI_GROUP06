import React, { useState } from 'react';
import { mockRoles, mockCategories, mockPermissions } from '../../mocks/adminMocks';

type Perm = { can_view: boolean; can_upload: boolean; can_delete: boolean };
type Matrix = Record<number, Record<number, Perm>>;

const defaultPerm = (): Perm => ({ can_view: false, can_upload: false, can_delete: false });

export const PermissionMatrix: React.FC = () => {
  const [matrix, setMatrix] = useState<Matrix>(() => {
    const m: Matrix = {};
    mockRoles.forEach(r => {
      m[r.id] = {};
      mockCategories.forEach(c => {
        m[r.id][c.id] = { ...(mockPermissions[r.id]?.[c.id] ?? defaultPerm()) };
      });
    });
    return m;
  });
  const [saved, setSaved] = useState(false);

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

  const Checkbox: React.FC<{ checked: boolean; onChange: () => void; color: string }> = ({ checked, onChange, color }) => (
    <button
      onClick={onChange}
      className={`w-4 h-4 rounded border transition-colors ${checked ? `${color} border-transparent` : 'border-border bg-elevated'}`}
      title={checked ? 'Bỏ quyền' : 'Cấp quyền'}
    >
      {checked && <span className="flex items-center justify-center text-white text-[9px] font-bold">✓</span>}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-text-muted">Tick để cấp quyền cho từng vai trò trên mỗi danh mục</p>
        <div className="flex items-center gap-3 text-[11px] text-text-muted">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-accent inline-block" /> Xem</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-success inline-block" /> Upload</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-danger inline-block" /> Xóa</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-surface">
              <th className="px-4 py-2.5 text-[11px] font-semibold text-text-secondary uppercase tracking-wide border-b border-border w-36">Vai trò</th>
              {mockCategories.map(cat => (
                <th key={cat.id} className="px-4 py-2.5 text-[11px] font-semibold text-text-secondary uppercase tracking-wide border-b border-border text-center">
                  {cat.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mockRoles.map(role => (
              <tr key={role.id} className="border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
                <td className="px-4 py-3">
                  <div>
                    <p className="text-[13px] font-semibold text-text-primary">{role.name}</p>
                    <p className="text-[11px] text-text-muted">Lv.{role.access_level}</p>
                  </div>
                </td>
                {mockCategories.map(cat => {
                  const p = matrix[role.id]?.[cat.id] ?? defaultPerm();
                  return (
                    <td key={cat.id} className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <Checkbox checked={p.can_view}   onChange={() => toggle(role.id, cat.id, 'can_view')}   color="bg-accent" />
                        <Checkbox checked={p.can_upload} onChange={() => toggle(role.id, cat.id, 'can_upload')} color="bg-success" />
                        <Checkbox checked={p.can_delete} onChange={() => toggle(role.id, cat.id, 'can_delete')} color="bg-danger" />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between pt-1">
        {saved && <span className="text-[12px] text-success">Đã lưu thay đổi</span>}
        {!saved && <span />}
        <button
          onClick={() => setSaved(true)}
          className="px-4 py-1.5 rounded-lg bg-accent text-white text-[13px] font-semibold hover:bg-accent-hover transition-colors"
        >
          Lưu phân quyền
        </button>
      </div>
    </div>
  );
};
