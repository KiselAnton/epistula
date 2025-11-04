import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

interface AuthState {
  token: string | null;
  userId: number | null;
  isRoot: boolean;
}

const AuthContext = createContext<AuthState>({ token: null, userId: null, isRoot: false });

function decodeJwt(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(atob(payload).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [isRoot, setIsRoot] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = localStorage.getItem('token');
    setToken(t);
    if (t) {
      const payload = decodeJwt(t);
      // Prefer common JWT fields: sub or user_id
      const uid = Number(payload?.sub ?? payload?.user_id ?? payload?.uid ?? NaN);
      setUserId(Number.isFinite(uid) ? uid : null);
      setIsRoot(Boolean(payload?.role === 'root' || payload?.is_root));
    } else {
      setUserId(null);
      setIsRoot(false);
    }
  }, []);

  const value = useMemo(() => ({ token, userId, isRoot }), [token, userId, isRoot]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
