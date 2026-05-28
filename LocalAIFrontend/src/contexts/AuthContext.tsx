import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const API_BASE = 'http://localhost:8000';
const USER_KEY = 'localai_user';

export interface CategoryPermission {
  category_id: number;
  can_view: boolean;
  can_upload: boolean;
  can_delete: boolean;
}

export interface AuthUser {
  id: number;
  username: string;
  full_name: string;
  role: string;
  access_level: number;
  department?: string;
  category_permissions: CategoryPermission[];
  action_permissions: Record<string, boolean>;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAdmin: boolean;
  canAccess: (minLevel: number) => boolean;
  canDo: (actionKey: string) => boolean;
  refreshUser: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(true);

  // On mount: verify cookie still valid via /api/auth/me
  useEffect(() => {
    fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(data => {
        const u: AuthUser = {
          id: data.user_id,
          username: data.username,
          full_name: data.full_name,
          role: data.role,
          access_level: data.access_level ?? 1,
          department: data.department,
          category_permissions: data.category_permissions ?? [],
          action_permissions: data.action_permissions ?? {},
        };
        setUser(u);
        localStorage.setItem(USER_KEY, JSON.stringify(u));
      })
      .catch(() => {
        setUser(null);
        localStorage.removeItem(USER_KEY);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Đăng nhập thất bại');
    }
    const data = await res.json();
    const u: AuthUser = {
      id: data.user_id,
      username: data.username,
      full_name: data.full_name,
      role: data.role,
      access_level: data.access_level ?? 1,
      department: data.department,
      category_permissions: data.category_permissions ?? [],
      action_permissions: data.action_permissions ?? {},
    };
    setUser(u);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
    setUser(null);
    localStorage.removeItem(USER_KEY);
  }, []);

  const refreshUser = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    const u: AuthUser = {
      id: data.user_id,
      username: data.username,
      full_name: data.full_name,
      role: data.role,
      access_level: data.access_level ?? 1,
      department: data.department,
      category_permissions: data.category_permissions ?? [],
      action_permissions: data.action_permissions ?? {},
    };
    setUser(u);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
  }, []);

  // Re-sync permissions when tab regains focus (catches permission changes made elsewhere)
  useEffect(() => {
    const onFocus = () => { if (user) refreshUser(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user, refreshUser]);

  const canAccess = (minLevel: number) => (user?.access_level ?? 0) >= minLevel;
  const canDo = (actionKey: string) => user?.action_permissions?.[actionKey] ?? false;

  return (
    <AuthContext.Provider value={{ user, isLoading, isAdmin: user?.role === 'admin', canAccess, canDo, refreshUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
