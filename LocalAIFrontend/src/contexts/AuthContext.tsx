import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const API_BASE = 'http://localhost:8000';
const USER_KEY = 'localai_user';

export interface AuthUser {
  id: number;
  username: string;
  full_name: string;
  role: string;
  department?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAdmin: boolean;
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
          department: data.department,
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
      department: data.department,
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

  return (
    <AuthContext.Provider value={{ user, isLoading, isAdmin: user?.role === 'admin', login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
