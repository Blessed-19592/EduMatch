import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { clearCsrfToken, fetchCsrfToken } from '../api/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      try {
        // Establish/retrieve the browser session before checking /me.
        await fetchCsrfToken();
        const { data } = await api.get('/auth/me');
        if (active) {
          setUser(data.user);
          setStatus('authenticated');
        }
      } catch (error) {
        if (active) {
          if (error.response?.status !== 401) {
            console.warn('Session restoration could not be completed:', error.message);
          }
          setUser(null);
          setStatus('unauthenticated');
        }
      }
    };
    restoreSession();
    return () => { active = false; };
  }, []);

  const login = useCallback(async (credentials) => {
    const { data } = await api.post('/auth/login', credentials);
    // Login regenerates the server session, so the old CSRF token is invalid.
    clearCsrfToken();
    await fetchCsrfToken({ force: true });
    setUser(data.user);
    setStatus('authenticated');
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      clearCsrfToken();
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const { data } = await api.get('/auth/me');
    setUser(data.user);
    setStatus('authenticated');
    return data.user;
  }, []);

  const value = useMemo(() => ({ user, status, isAuthenticated: status === 'authenticated', login, logout, refreshUser }), [user, status, login, logout, refreshUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
