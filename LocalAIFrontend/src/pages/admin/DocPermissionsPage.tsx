import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Building2, FileText, FolderOpen, Check, Minus, Search,
  Users, ChevronRight, Save, Loader2, FileX, Info,
} from 'lucide-react';
import { apiGet, apiPut } from '../../utils/apiClient';
import { cn } from '../../lib/utils';

interface Department {
  id: number; name: string; description: string | null;
  user_count: number; doc_count: number;
}

interface DocRow {
  id: number; title: string;
  category_id: number | null; category_name: string | null;
  file_size_bytes: number; ingestion_status: string;
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'bg-success/20 text-success border-success/30',
  PROCESSING: 'bg-blue-400/20 text-blue-400 border-blue-400/30',
  PENDING: 'bg-warning/20 text-warning border-warning/30',
  FAILED: 'bg-danger/20 text-danger border-danger/30',
};

function formatSize(bytes: number) {
  if (bytes >= 1_000_000) return (bytes / 1_000_000).toFixed(1) + ' MB';
  if (bytes >= 1_000) return (bytes / 1_000).toFixed(0) + ' KB';
  return bytes + ' B';
}

// ── Tri-state folder checkbox ────────────────────────────────────────────
const FolderCheckbox = ({ state, onClick }: { state: 'all' | 'some' | 'none'; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all',
      state === 'all' && 'bg-success border-success',
      state === 'some' && 'bg-warning/80 border-warning',
      state === 'none' && 'border-border bg-elevated hover:border-success/60',
    )}
  >
    {state === 'all' && <Check className="w-3 h-3 text-white" />}
    {state === 'some' && <Minus className="w-3 h-3 text-white" />}
  </button>
);

const DocCheckbox = ({ allowed, onClick }: { allowed: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all',
      allowed ? 'bg-success border-success' : 'border-border bg-elevated hover:border-success/60',
    )}
  >
    {allowed && <Check className="w-3 h-3 text-white" />}
  </button>
);

// ── Main ─────────────────────────────────────────────────────────────────
const DocPermissionsPage: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  // permissions[deptId] = Set<docId>
  const [permissions, setPermissions] = useState<Record<number, Set<number>>>({});
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedDept, setSavedDept] = useState<number | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [docSearch, setDocSearch] = useState('');

  // Group docs by category
  const categories = useMemo(() => {
    const map = new Map<string, DocRow[]>();
    docs.forEach(d => {
      const key = d.category_name ?? '(Chưa phân loại)';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    });
    return map;
  }, [docs]);

  const filteredCategories = useMemo(() => {
    const q = docSearch.toLowerCase();
    if (!q) return categories;
    const result = new Map<string, DocRow[]>();
    categories.forEach((catDocs, cat) => {
      const matched = catDocs.filter(d => d.title.toLowerCase().includes(q));
      if (matched.length > 0 || cat.toLowerCase().includes(q)) {
        result.set(cat, matched.length > 0 ? matched : catDocs);
      }
    });
    return result;
  }, [categories, docSearch]);

  // Load departments + docs on mount
  useEffect(() => {
    Promise.all([
      apiGet('/api/admin/dept-doc-permissions/departments').then(r => r.json()),
      apiGet('/api/admin/dept-doc-permissions/documents').then(r => r.json()),
    ]).then(([depts, docsData]: [Department[], DocRow[]]) => {
      setDepartments(depts);
      setDocs(docsData);
      if (depts.length > 0) selectDeptById(depts[0]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectDeptById = useCallback(async (dept: Department) => {
    setSelectedDept(dept);
    setDocSearch('');
    setSavedDept(null);
    if (permissions[dept.id] !== undefined) return; // already loaded
    setLoadingPerms(true);
    try {
      const res = await apiGet(`/api/admin/dept-doc-permissions?department_id=${dept.id}`);
      const data: { department_id: number; doc_ids: number[] } = await res.json();
      setPermissions(prev => ({ ...prev, [data.department_id]: new Set(data.doc_ids) }));
    } finally {
      setLoadingPerms(false);
    }
  }, [permissions]);

  const deptPerm = (deptId: number) => permissions[deptId] ?? new Set<number>();

  const folderState = (deptId: number, catDocs: DocRow[]): 'all' | 'some' | 'none' => {
    const perm = deptPerm(deptId);
    const allowed = catDocs.filter(d => perm.has(d.id)).length;
    if (allowed === catDocs.length && catDocs.length > 0) return 'all';
    if (allowed > 0) return 'some';
    return 'none';
  };

  const toggleDoc = (deptId: number, docId: number) => {
    setPermissions(prev => {
      const cur = new Set(prev[deptId] ?? []);
      cur.has(docId) ? cur.delete(docId) : cur.add(docId);
      return { ...prev, [deptId]: cur };
    });
    setSavedDept(null);
  };

  const toggleFolder = (deptId: number, catDocs: DocRow[]) => {
    const state = folderState(deptId, catDocs);
    setPermissions(prev => {
      const cur = new Set(prev[deptId] ?? []);
      if (state === 'all') catDocs.forEach(d => cur.delete(d.id));
      else catDocs.forEach(d => cur.add(d.id));
      return { ...prev, [deptId]: cur };
    });
    setSavedDept(null);
  };

  const toggleFolder2 = (cat: string) => {
    setExpandedFolders(prev => {
      const s = new Set(prev);
      s.has(cat) ? s.delete(cat) : s.add(cat);
      return s;
    });
  };

  const savePermissions = async () => {
    if (!selectedDept) return;
    setSaving(true);
    const doc_ids = Array.from(deptPerm(selectedDept.id));
    await apiPut('/api/admin/dept-doc-permissions', { department_id: selectedDept.id, doc_ids });
    setSaving(false);
    setSavedDept(selectedDept.id);
    // refresh dept list doc_count
    setDepartments(prev =>
      prev.map(d => d.id === selectedDept.id ? { ...d, doc_count: doc_ids.length } : d)
    );
  };

  const totalAllowed = selectedDept ? deptPerm(selectedDept.id).size : 0;

  return (
    <div className="flex flex-col gap-4 animate-fade-in" style={{ height: 'calc(100vh - 7rem)' }}>
      {/* Header */}
      <div>
        <h1 className="text-[20px] font-bold text-text-primary">Phân quyền Tài liệu</h1>
        <p className="text-[13px] text-text-muted mt-0.5">
          Cấp quyền truy cập tài liệu theo phòng ban — nhân viên thuộc phòng ban sẽ tự động có quyền
        </p>
      </div>

      {/* Info banner */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-accent/5 border border-accent/20 text-[12px] text-text-secondary">
        <Info className="w-4 h-4 text-accent flex-shrink-0" />
        Chọn phòng ban bên trái → tick tài liệu muốn cho phép → nhấn <strong className="text-text-primary mx-1">Lưu thay đổi</strong>.
        Nhân viên thuộc phòng ban sẽ thấy tài liệu khi chat.
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* ── LEFT: Department list ── */}
        <div className="w-[260px] flex-shrink-0 bg-elevated border border-border rounded-xl flex flex-col overflow-hidden">
          {/* Panel header */}
          <div className="px-4 py-3 border-b border-border flex-shrink-0">
            <p className="text-[12px] font-semibold text-text-primary uppercase tracking-wide">Phòng ban</p>
          </div>
          <div className="divide-y divide-border overflow-y-auto flex-1">
            {departments.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <Building2 className="w-8 h-8 text-text-muted/30 mb-2" />
                <p className="text-[12px] text-text-muted">Chưa có phòng ban</p>
              </div>
            )}
            {departments.map(dept => {
              const active = selectedDept?.id === dept.id;
              const docCount = permissions[dept.id]?.size ?? dept.doc_count;
              return (
                <button
                  key={dept.id}
                  onClick={() => selectDeptById(dept)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors',
                    active ? 'bg-accent/10 border-l-[3px] border-accent' : 'hover:bg-hover border-l-[3px] border-transparent',
                  )}
                >
                  <div className={cn('p-1.5 rounded-lg flex-shrink-0', active ? 'bg-accent/20' : 'bg-surface')}>
                    <Building2 className={cn('w-3.5 h-3.5', active ? 'text-accent' : 'text-text-muted')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-[13px] font-semibold truncate', active ? 'text-accent' : 'text-text-primary')}>
                      {dept.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-text-muted">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{dept.user_count} người</span>
                      <span>·</span>
                      <span className={cn('flex items-center gap-1', docCount > 0 ? 'text-success' : '')}>
                        <FileText className="w-3 h-3" />{docCount} doc
                      </span>
                    </div>
                  </div>
                  {active && <ChevronRight className="w-3.5 h-3.5 text-accent flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: Documents ── */}
        <div className="flex-1 min-w-0 bg-elevated border border-border rounded-xl flex flex-col overflow-hidden">
          {selectedDept ? (
            <>
              {/* Right header */}
              <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0 gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-accent/10 flex-shrink-0">
                    <Building2 className="w-4 h-4 text-accent" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-text-primary truncate">{selectedDept.name}</p>
                    <p className="text-[11px] text-text-muted">
                      <span className={cn('font-semibold', totalAllowed > 0 ? 'text-success' : 'text-text-muted')}>{totalAllowed}</span>
                      {' '}/{' '}{docs.length} tài liệu được cấp quyền
                    </p>
                  </div>
                </div>
                <button
                  onClick={savePermissions}
                  disabled={saving}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-colors flex-shrink-0 disabled:opacity-50',
                    savedDept === selectedDept.id
                      ? 'bg-success/20 text-success border border-success/30'
                      : 'bg-accent text-white hover:bg-accent-hover',
                  )}
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {saving ? 'Đang lưu...' : savedDept === selectedDept.id ? 'Đã lưu ✓' : 'Lưu thay đổi'}
                </button>
              </div>

              {/* Search */}
              <div className="px-4 py-2.5 border-b border-border flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                  <input
                    value={docSearch}
                    onChange={e => setDocSearch(e.target.value)}
                    placeholder="Tìm tài liệu..."
                    className="input-base pl-9 py-1.5 text-[12px] w-full"
                  />
                </div>
              </div>

              {/* Document tree */}
              <div className="flex-1 overflow-y-auto">
                {loadingPerms ? (
                  <div className="flex items-center justify-center py-16 gap-2 text-text-muted">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-[13px]">Đang tải...</span>
                  </div>
                ) : docs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                    <FileX className="w-12 h-12 text-text-muted/30 mb-3" />
                    <p className="text-[14px] font-semibold text-text-primary mb-1">Chưa có tài liệu COMPANY</p>
                    <p className="text-[12px] text-text-muted">Upload tài liệu với phạm vi "Công ty" để phân quyền tại đây</p>
                  </div>
                ) : filteredCategories.size === 0 ? (
                  <div className="flex items-center justify-center py-16 text-[13px] text-text-muted">
                    Không tìm thấy tài liệu phù hợp
                  </div>
                ) : (
                  Array.from(filteredCategories.entries()).map(([cat, catDocs]) => {
                    const state = folderState(selectedDept.id, catDocs);
                    const expanded = expandedFolders.has(cat);
                    const allowedCount = catDocs.filter(d => deptPerm(selectedDept.id).has(d.id)).length;
                    return (
                      <div key={cat} className="border-b border-border last:border-0">
                        {/* Folder row */}
                        <div className="flex items-center gap-2 px-4 py-3 bg-surface/40 hover:bg-surface/70 transition-colors">
                          <button
                            onClick={() => toggleFolder2(cat)}
                            className="flex items-center gap-2 flex-1 min-w-0 text-left"
                          >
                            <ChevronRight className={cn('w-3.5 h-3.5 text-text-muted transition-transform flex-shrink-0', expanded && 'rotate-90')} />
                            <FolderOpen className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                            <span className="text-[13px] font-semibold text-text-primary">{cat}</span>
                            <span className={cn(
                              'text-[11px] font-medium ml-1',
                              allowedCount === catDocs.length ? 'text-success' : allowedCount > 0 ? 'text-warning' : 'text-text-muted',
                            )}>
                              {allowedCount}/{catDocs.length}
                            </span>
                          </button>
                          <FolderCheckbox state={state} onClick={() => toggleFolder(selectedDept.id, catDocs)} />
                        </div>

                        {/* Doc rows */}
                        {expanded && catDocs.map(doc => {
                          const allowed = deptPerm(selectedDept.id).has(doc.id);
                          return (
                            <div
                              key={doc.id}
                              className={cn(
                                'flex items-center gap-3 px-4 py-2.5 pl-11 border-t border-border/40 transition-colors cursor-pointer',
                                allowed ? 'hover:bg-success/5' : 'hover:bg-hover/40',
                              )}
                              onClick={() => toggleDoc(selectedDept.id, doc.id)}
                            >
                              <FileText className={cn('w-3.5 h-3.5 flex-shrink-0', allowed ? 'text-success' : 'text-text-muted')} />
                              <div className="flex-1 min-w-0">
                                <p className={cn('text-[13px] truncate', allowed ? 'text-text-primary font-medium' : 'text-text-secondary')}>
                                  {doc.title}
                                </p>
                                <p className="text-[11px] text-text-muted">{formatSize(doc.file_size_bytes)}</p>
                              </div>
                              <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', STATUS_COLORS[doc.ingestion_status] ?? 'bg-surface border-border text-text-muted')}>
                                {doc.ingestion_status}
                              </span>
                              <DocCheckbox allowed={allowed} onClick={() => toggleDoc(selectedDept.id, doc.id)} />
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <div className="p-4 rounded-2xl bg-accent/5 mb-4">
                <Building2 className="w-12 h-12 text-accent/30" />
              </div>
              <p className="text-[15px] font-semibold text-text-primary mb-1">Chọn phòng ban</p>
              <p className="text-[13px] text-text-muted max-w-xs">
                Nhấn vào một phòng ban bên trái để cấp quyền tài liệu cho phòng ban đó.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocPermissionsPage;
