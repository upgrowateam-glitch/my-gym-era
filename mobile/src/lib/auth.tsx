// Login state for the whole app: who is signed in, and login / sign-up /
// logout actions. Uses the server's /api/auth endpoints; the login token is
// kept in secure storage so the user stays signed in between visits.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, setAuthToken, setSessionInvalidHandler } from './api';
import { getItem, removeItem, setItem } from './storage';
import type { Session, User } from './types';

const TOKEN_KEY = 'mge_token';

interface AuthState {
  /** true while the saved login is being checked at start-up */
  loading: boolean;
  user: User | null;
  /** message to show on the login page (e.g. session ended, server unreachable) */
  notice: string | null;
  login(email: string, password: string): Promise<void>;
  register(name: string, email: string, password: string): Promise<void>;
  /** Accepts an invitation link and signs in with the new account. */
  acceptInvitation(token: string, body: { name: string; email?: string; password: string }): Promise<void>;
  logout(): Promise<void>;
  /** Re-reads the signed-in user (e.g. after finishing onboarding). */
  refresh(): Promise<void>;
  setUser(user: User): void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const clearSession = useCallback(async () => {
    setAuthToken(null);
    await removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  // Restore the saved login when the app starts.
  useEffect(() => {
    setSessionInvalidHandler(() => {
      setNotice('Your session has ended. Please log in again.');
      void clearSession();
    });
    (async () => {
      try {
        const saved = await getItem(TOKEN_KEY);
        if (saved) {
          setAuthToken(saved);
          const res = await api.get<{ user: User }>('/api/auth/me');
          setUser(res.user);
        }
      } catch (e) {
        if (e instanceof ApiError && e.status === 0) {
          setNotice(e.message); // server unreachable: keep the token for next time
        } else {
          await clearSession();
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => setSessionInvalidHandler(null);
  }, [clearSession]);

  const startSession = useCallback(async (session: Session) => {
    setAuthToken(session.token);
    await setItem(TOKEN_KEY, session.token);
    setNotice(null);
    setUser(session.user);
  }, []);

  const value = useMemo<AuthState>(() => ({
    loading,
    user,
    notice,
    async login(email, password) {
      await startSession(await api.post<Session>('/api/auth/login', { email, password }));
    },
    async register(name, email, password) {
      await startSession(await api.post<Session>('/api/auth/register', { displayName: name, email, password }));
    },
    async acceptInvitation(token, body) {
      await startSession(await api.post<Session>(`/api/invitations/token/${encodeURIComponent(token)}/accept`, body));
    },
    async logout() {
      setNotice(null);
      await clearSession();
    },
    async refresh() {
      const res = await api.get<{ user: User }>('/api/auth/me');
      setUser(res.user);
    },
    setUser,
  }), [loading, user, notice, startSession, clearSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** The dashboard for each role. */
export function homeRouteFor(user: User): '/super-admin' | '/admin' | '/trainer' | '/home' {
  switch (user.role) {
    case 'super_admin': return '/super-admin';
    case 'admin': return '/admin';
    case 'trainer': return '/trainer';
    default: return '/home';
  }
}

/** Super admins have every access switch; admins only those turned on. */
export function can(user: User | null, permission: import('./types').Permission): boolean {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  return user.role === 'admin' && user.permissions.includes(permission);
}
