import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Save, RefreshCw, LogOut, User } from 'lucide-react';
import { apiGet, apiPut, apiDelete } from '../../utils/apiClient';
import { PageHeader } from '../../components/admin/ui/PageHeader';
import { Skeleton, SkeletonPanel } from '../../components/admin/ui/Skeleton';
import { EmptyState } from '../../components/admin/ui/EmptyState';
import { useToast } from '../../components/admin/ui/Toast';

type Tab = 'policy' | 'sessions';

interface SecuritySettings {
  session_timeout_days: number;
  min_password_length: number;
  require_uppercase: boolean;
  require_number: boolean;
  require_special: boolean;
  max_login_attempts: number;
  lockout_duration_minutes: number;
}

interface ActiveSession {
  user_id: number;
  username: string;
  full_name: string;
  ip_address: string | null;
  last_login: string | null;
  is_active: boolean;
}

const SecuritySettingsPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('policy');
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [form, setForm] = useState<SecuritySettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [forceLogoutTarget, setForceLogoutTarget] = useState<ActiveSession | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const toast = useToast();

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') toast.success(msg); else toast.error(msg);
  };

  const fetchSettings = useCallback(async () => {
    try {
      const res = await apiGet('/api/admin/security/settings');
      if (!res.ok) throw new Error('Không thể tải cài đặt bảo mật');
      const data: SecuritySettings = await res.json();
      setSettings(data);
      setForm(data);
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await apiGet('/api/admin/security/active-sessions');
      if (!res.ok) throw new Error('Không thể tải phiên đăng nhập');
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);
  useEffect(() => { if (tab === 'sessions') fetchSessions(); }, [tab, fetchSessions]);

  const handleSave = async () => {
    if (!form || !settings) return;
    setSaving(true);
    try {
      const changes: Partial<SecuritySettings> = {};
      (Object.keys(form) as (keyof SecuritySettings)[]).forEach(k => {
        if (form[k] !== settings[k]) (changes as any)[k] = form[k];
      });
      if (Object.keys(changes).length === 0) {
        showToast('Không có thay đổi nào.', 'error');
        return;
      }
      const res = await apiPut('/api/admin/security/settings', changes);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || 'Lỗi khi lưu');
      }
      setSettings(form);
      showToast('Cài đặt bảo mật đã được lưu.');
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleForceLogout = async () => {
    if (!forceLogoutTarget) return;
    setLoggingOut(true);
    try {
      const res = await apiDelete(`/api/admin/security/sessions/${forceLogoutTarget.user_id}`);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || 'Lỗi force logout');
      }
      showToast(`Đã ghi nhận force logout cho '${forceLogoutTarget.username}'.`);
      setForceLogoutTarget(null);
      fetchSessions();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoggingOut(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return iso; }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Cài đặt Bảo mật"
        subtitle="Quản lý chính sách bảo mật và phiên đăng nhập"
        icon={<ShieldCheck className="w-5 h-5 text-text-secondary" />}
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-elevated border border-border rounded-lg p-1 w-fit">
        {([['policy', 'Chính sách'], ['sessions', 'Phiên hoạt động']] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Policy Tab — loading */}
      {tab === 'policy' && !form && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SkeletonPanel rows={2} />
          <SkeletonPanel rows={3} />
        </div>
      )}

      {/* Policy Tab */}
      {tab === 'policy' && form && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Session */}
            <div className="bg-elevated border border-border rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <ShieldCheck size={15} className="text-accent" />
                <h2 className="text-sm font-semibold text-text-primary">Phiên đăng nhập</h2>
              </div>
              <NumberInput
                label="Thời hạn phiên (ngày)"
                value={form.session_timeout_days}
                onChange={v => setForm(f => f ? { ...f, session_timeout_days: v } : f)}
                min={1} max={90}
              />
            </div>

            {/* Lockout */}
            <div className="bg-elevated border border-border rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <ShieldCheck size={15} className="text-accent" />
                <h2 className="text-sm font-semibold text-text-primary">Khóa tài khoản</h2>
              </div>
              <NumberInput
                label="Số lần đăng nhập sai tối đa"
                value={form.max_login_attempts}
                onChange={v => setForm(f => f ? { ...f, max_login_attempts: v } : f)}
                min={1} max={20}
              />
              <NumberInput
                label="Thời gian khóa (phút)"
                value={form.lockout_duration_minutes}
                onChange={v => setForm(f => f ? { ...f, lockout_duration_minutes: v } : f)}
                min={1} max={1440}
              />
            </div>
          </div>

          {/* Password Policy */}
          <div className="bg-elevated border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <ShieldCheck size={15} className="text-accent" />
              <h2 className="text-sm font-semibold text-text-primary">Chính sách mật khẩu</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NumberInput
                label="Độ dài tối thiểu"
                value={form.min_password_length}
                onChange={v => setForm(f => f ? { ...f, min_password_length: v } : f)}
                min={4} max={32}
              />
              <div className="space-y-3 pt-1">
                {([
                  ['require_uppercase', 'Yêu cầu chữ hoa (A-Z)'],
                  ['require_number', 'Yêu cầu chữ số (0-9)'],
                  ['require_special', 'Yêu cầu ký tự đặc biệt (!@#...)'],
                ] as [keyof SecuritySettings, string][]).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <div
                      onClick={() => setForm(f => f ? { ...f, [key]: !f[key] } : f)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${form[key] ? 'bg-accent' : 'bg-border'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${form[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </div>
                    <span className="text-sm text-text-secondary">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              Lưu cài đặt
            </button>
          </div>
        </div>
      )}

      {/* Sessions Tab */}
      {tab === 'sessions' && (
        <div className="bg-elevated border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">Phiên đăng nhập gần đây</h2>
            <button onClick={fetchSessions} disabled={loadingSessions} className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary">
              <RefreshCw size={12} className={loadingSessions ? 'animate-spin' : ''} />
              Làm mới
            </button>
          </div>
          {loadingSessions ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" rounded="lg" />)}
            </div>
          ) : sessions.length === 0 ? (
            <EmptyState icon={User} title="Không có phiên nào" compact />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="text-left px-4 py-3 text-text-muted font-medium">Người dùng</th>
                  <th className="text-left px-4 py-3 text-text-muted font-medium">IP</th>
                  <th className="text-left px-4 py-3 text-text-muted font-medium">Đăng nhập lúc</th>
                  <th className="text-left px-4 py-3 text-text-muted font-medium">Trạng thái</th>
                  <th className="text-right px-4 py-3 text-text-muted font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.user_id} className="border-b border-border last:border-0 hover:bg-surface/50">
                    <td className="px-4 py-3">
                      <p className="text-text-primary font-medium">{s.full_name}</p>
                      <p className="text-text-muted text-xs">@{s.username}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-text-muted">{s.ip_address || '—'}</td>
                    <td className="px-4 py-3 text-text-muted text-xs">{formatDate(s.last_login)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${s.is_active ? 'bg-success/15 text-success border-success/30' : 'bg-danger/15 text-danger border-danger/30'}`}>
                        {s.is_active ? 'Hoạt động' : 'Bị khoá'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setForceLogoutTarget(s)}
                        className="flex items-center gap-1.5 ml-auto px-2.5 py-1.5 text-xs rounded-lg text-text-muted hover:text-warning hover:bg-warning/10 transition-colors cursor-pointer"
                      >
                        <LogOut size={11} />
                        Force logout
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Force Logout Confirm */}
      {forceLogoutTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => !loggingOut && setForceLogoutTarget(null)}
        >
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
            <h2 className="text-[15px] font-semibold text-text-primary mb-2">Xác nhận Force Logout</h2>
            <p className="text-[13px] text-text-secondary mb-4">
              Bạn muốn force logout <span className="font-semibold text-text-primary">{forceLogoutTarget.full_name}</span> (@{forceLogoutTarget.username})?
              <br />
              <span className="text-[11px] text-text-muted mt-1 block">Token hiện tại sẽ hết hạn tự nhiên (JWT stateless).</span>
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setForceLogoutTarget(null)} disabled={loggingOut} className="px-4 py-2 text-[13px] rounded-lg border border-border text-text-secondary hover:bg-hover transition-colors cursor-pointer">Huỷ</button>
              <button onClick={handleForceLogout} disabled={loggingOut} className="px-4 py-2 text-[13px] rounded-lg bg-warning text-white font-semibold hover:bg-warning/85 disabled:opacity-50 flex items-center gap-2 cursor-pointer">
                {loggingOut && <RefreshCw size={12} className="animate-spin" />}
                Force Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const NumberInput: React.FC<{ label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }> = ({ label, value, onChange, min, max }) => (
  <div>
    <label className="block text-xs text-text-muted mb-1">{label}</label>
    <input
      type="number"
      value={value}
      min={min} max={max}
      onChange={e => onChange(parseInt(e.target.value) || 0)}
      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
    />
  </div>
);

export default SecuritySettingsPage;
