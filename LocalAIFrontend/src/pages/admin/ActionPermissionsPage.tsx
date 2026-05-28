import React, { useState, useEffect, useCallback } from 'react';
import {
  KeyRound, ShieldCheck, Check, X, ChevronDown, ChevronRight,
  Save, RotateCcw, Users,
} from 'lucide-react';
import { apiGet, apiPut } from '../../utils/apiClient';
import { PageHeader } from '../../components/admin/ui/PageHeader';
import { Skeleton } from '../../components/admin/ui/Skeleton';
import { useToast } from '../../components/admin/ui/Toast';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActionDef {
  key: string;
  label: string;
  description: string;
  default_min_level: number;
}

interface ActionGroup {
  name: string;
  actions: ActionDef[];
}

interface RoleInfo {
  id: number;
  name: string;
  access_level: number;
  user_count: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const LEVEL_COLOR: Record<number, string> = {
  1: 'bg-text-muted/15 text-text-muted border-text-muted/20',
  5: 'bg-accent/15 text-accent border-accent/30',
  9: 'bg-warning/15 text-warning border-warning/30',
  10: 'bg-danger/15 text-danger border-danger/30',
};

function levelColor(lvl: number) {
  if (lvl >= 10) return LEVEL_COLOR[10];
  if (lvl >= 9)  return LEVEL_COLOR[9];
  if (lvl >= 5)  return LEVEL_COLOR[5];
  return LEVEL_COLOR[1];
}

// ── Component ─────────────────────────────────────────────────────────────────

const ActionPermissionsPage: React.FC = () => {
  const toast = useToast();

  // Data
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [groups, setGroups] = useState<ActionGroup[]>([]);

  // Selected role + its permissions (draft editable)
  const [selectedRole, setSelectedRole] = useState<RoleInfo | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [savedPermissions, setSavedPermissions] = useState<Record<string, boolean>>({});

  // UI state
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const isDirty = JSON.stringify(permissions) !== JSON.stringify(savedPermissions);

  // ── Fetch roles + action registry ─────────────────────────────────────────

  const fetchRoles = useCallback(async () => {
    try {
      const res = await apiGet('/api/admin/roles');
      const data: RoleInfo[] = await res.json();
      setRoles(data);
      // Auto-select first non-admin role only on initial load (selectedRole still null)
      setSelectedRole(prev => {
        if (prev !== null) return prev;
        return data.find(r => r.name !== 'admin') ?? data[0] ?? null;
      });
    } catch {
      toast.error('Không tải được danh sách vai trò');
    } finally {
      setLoadingRoles(false);
    }
  }, [toast]);

  const fetchActions = useCallback(async () => {
    try {
      const res = await apiGet('/api/admin/actions');
      const data = await res.json();
      setGroups(data.groups ?? []);
    } catch {
      toast.error('Không tải được danh sách action');
    }
  }, [toast]);

  useEffect(() => {
    fetchRoles();
    fetchActions();
  }, [fetchRoles, fetchActions]);

  // ── Fetch permissions for selected role ───────────────────────────────────

  const fetchRolePerms = useCallback(async (roleId: number) => {
    setLoadingPerms(true);
    try {
      const res = await apiGet(`/api/admin/actions/roles/${roleId}`);
      const data = await res.json();
      setPermissions({ ...data.permissions });
      setSavedPermissions({ ...data.permissions });
    } catch {
      toast.error('Không tải được quyền của vai trò');
    } finally {
      setLoadingPerms(false);
    }
  }, [toast]);

  useEffect(() => {
    if (selectedRole) fetchRolePerms(selectedRole.id);
  }, [selectedRole, fetchRolePerms]);

  // ── Toggle single action ──────────────────────────────────────────────────

  const toggle = (key: string) => {
    if (selectedRole?.name === 'admin') return;
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Toggle entire group ───────────────────────────────────────────────────

  const toggleGroup = (group: ActionGroup, value: boolean) => {
    if (selectedRole?.name === 'admin') return;
    setPermissions(prev => {
      const next = { ...prev };
      group.actions.forEach(a => { next[a.key] = value; });
      return next;
    });
  };

  const groupState = (group: ActionGroup): 'all' | 'none' | 'partial' => {
    const vals = group.actions.map(a => permissions[a.key] ?? false);
    if (vals.every(Boolean)) return 'all';
    if (vals.every(v => !v)) return 'none';
    return 'partial';
  };

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      await apiPut(`/api/admin/actions/roles/${selectedRole.id}`, {
        permissions: Object.entries(permissions).map(([action_key, allowed]) => ({
          action_key, allowed,
        })),
      });
      setSavedPermissions({ ...permissions });
      toast.success('Đã lưu phân quyền');
    } catch {
      toast.error('Lưu phân quyền thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setPermissions({ ...savedPermissions });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Phân quyền thao tác"
        subtitle="Cấu hình chi tiết các thao tác được phép cho từng vai trò"
        icon={<KeyRound className="w-5 h-5 text-text-secondary" />}
      />

      <div className="flex gap-4 items-start">
        {/* ── Left: Role list ───────────────────────────────────────────── */}
        <div className="w-56 flex-shrink-0 bg-elevated border border-border rounded-xl overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border bg-surface/60">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">
              Vai trò
            </span>
          </div>
          <div className="py-1">
            {loadingRoles
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="px-3 py-2.5">
                    <Skeleton className="h-3 w-full" />
                  </div>
                ))
              : roles.map(role => {
                  const isSelected = selectedRole?.id === role.id;
                  const isAdmin = role.name === 'admin';
                  return (
                    <button
                      key={role.id}
                      onClick={() => {
                        if (!isSelected) setSelectedRole(role);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                        isSelected
                          ? 'bg-accent/10 text-accent'
                          : 'text-text-secondary hover:bg-hover hover:text-text-primary'
                      }`}
                    >
                      <ShieldCheck className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-accent' : isAdmin ? 'text-danger/60' : 'text-text-muted'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-medium capitalize truncate">{role.name}</span>
                          {isAdmin && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-danger/10 text-danger/80 font-semibold">ADMIN</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[10px] px-1.5 py-0 rounded border font-mono ${levelColor(role.access_level)}`}>
                            Lv.{role.access_level}
                          </span>
                          <span className="text-[10px] text-text-muted flex items-center gap-0.5">
                            <Users className="w-2.5 h-2.5" />{role.user_count}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
          </div>
        </div>

        {/* ── Right: Action matrix ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Toolbar */}
          {selectedRole && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-elevated border border-border rounded-xl">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className={`w-4 h-4 ${selectedRole.name === 'admin' ? 'text-danger/70' : 'text-accent'}`} />
                <span className="text-[14px] font-semibold text-text-primary capitalize">{selectedRole.name}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded border font-mono ${levelColor(selectedRole.access_level)}`}>
                  Lv.{selectedRole.access_level}
                </span>
                {selectedRole.name === 'admin' && (
                  <span className="text-[11px] text-text-muted italic">Admin có toàn quyền, không thể chỉnh sửa</span>
                )}
              </div>
              {selectedRole.name !== 'admin' && (
                <div className="flex items-center gap-2">
                  {isDirty && (
                    <button
                      onClick={handleReset}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[12px] text-text-secondary hover:bg-hover transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" /> Hoàn tác
                    </button>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={saving || !isDirty}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-[12px] font-semibold hover:bg-accent-hover transition-colors disabled:opacity-40"
                  >
                    {saving
                      ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin-fast" />
                      : <Save className="w-3 h-3" />
                    }
                    {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Groups */}
          {loadingPerms
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-elevated border border-border rounded-xl p-4 space-y-2">
                  <Skeleton className="h-4 w-32 mb-3" />
                  {Array.from({ length: 3 }).map((__, j) => (
                    <Skeleton key={j} className="h-9 w-full" />
                  ))}
                </div>
              ))
            : groups.map(group => {
                const collapsed = collapsedGroups.has(group.name);
                const state = groupState(group);
                const isAdmin = selectedRole?.name === 'admin';

                return (
                  <div key={group.name} className="bg-elevated border border-border rounded-xl overflow-hidden">
                    {/* Group header */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface/40 select-none">
                      <button
                        className="flex items-center gap-2 flex-1 min-w-0"
                        onClick={() =>
                          setCollapsedGroups(prev => {
                            const next = new Set(prev);
                            collapsed ? next.delete(group.name) : next.add(group.name);
                            return next;
                          })
                        }
                      >
                        {collapsed
                          ? <ChevronRight className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                          : <ChevronDown className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                        }
                        <span className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide">
                          {group.name}
                        </span>
                        <span className="text-[10px] text-text-muted ml-1">({group.actions.length})</span>
                      </button>

                      {/* Group bulk toggle */}
                      {!isAdmin && !collapsed && (
                        <div className="flex items-center gap-1.5 ml-3">
                          <button
                            onClick={() => toggleGroup(group, true)}
                            className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                              state === 'all'
                                ? 'bg-success/15 text-success border-success/30'
                                : 'border-border text-text-muted hover:bg-success/10 hover:text-success hover:border-success/30'
                            }`}
                          >
                            Tất cả
                          </button>
                          <button
                            onClick={() => toggleGroup(group, false)}
                            className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                              state === 'none'
                                ? 'bg-danger/10 text-danger border-danger/20'
                                : 'border-border text-text-muted hover:bg-danger/10 hover:text-danger hover:border-danger/20'
                            }`}
                          >
                            Không ai
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Actions list */}
                    {!collapsed && (
                      <div>
                        {group.actions.map((action, idx) => {
                          const allowed = isAdmin ? true : (permissions[action.key] ?? false);
                          return (
                            <div
                              key={action.key}
                              className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                                idx % 2 === 1 ? 'bg-surface/30' : ''
                              } ${!isAdmin ? 'cursor-pointer hover:bg-hover/50' : ''}`}
                              onClick={() => toggle(action.key)}
                            >
                              {/* Toggle */}
                              <div className={`relative flex-shrink-0 w-9 h-5 rounded-full transition-colors ${
                                allowed ? 'bg-accent' : 'bg-border'
                              } ${isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                  allowed ? 'translate-x-4' : 'translate-x-0'
                                }`} />
                              </div>

                              {/* Label */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[13px] font-medium ${allowed ? 'text-text-primary' : 'text-text-muted'}`}>
                                    {action.label}
                                  </span>
                                  <span className="text-[10px] font-mono text-text-muted/50">{action.key}</span>
                                </div>
                                {action.description && (
                                  <p className="text-[11px] text-text-muted mt-0.5 truncate">{action.description}</p>
                                )}
                              </div>

                              {/* Status badge */}
                              <div className={`flex-shrink-0 flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                allowed
                                  ? 'bg-success/10 text-success'
                                  : 'bg-danger/10 text-danger'
                              }`}>
                                {allowed
                                  ? <><Check className="w-2.5 h-2.5" /> Cho phép</>
                                  : <><X className="w-2.5 h-2.5" /> Từ chối</>
                                }
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
        </div>
      </div>
    </div>
  );
};

export default ActionPermissionsPage;
