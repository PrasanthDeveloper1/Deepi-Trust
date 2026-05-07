import React, { createContext, useState, useContext, useEffect } from 'react';
import { db, isDemoMode, supabase, loadSession, saveSession, clearSession } from '../config/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      if (isDemoMode) {
        const stored = localStorage.getItem('deepi_auth_user');
        if (stored) {
          try { setUser(JSON.parse(stored)); }
          catch { localStorage.removeItem('deepi_auth_user'); }
        }
      } else {
        // Restore session from localStorage (manual persistence)
        const session = loadSession();
        if (session) {
          try {
            await supabase.auth.setSession(session);
            const { data: profile } = await supabase
              .from('profiles').select('*').eq('id', (await supabase.auth.getUser()).data?.user?.id).maybeSingle();
            if (profile) setUser(profile);
            else clearSession(); // stale session
          } catch {
            clearSession();
          }
        }
      }
      setLoading(false);
    };
    init();
  }, []);

  const login = async (email, password) => {
    try {
      const result = await db.login(email, password);
      if (result.error) return { error: result.error };
      setUser(result.data);
      if (isDemoMode) localStorage.setItem('deepi_auth_user', JSON.stringify(result.data));
      // Fire-and-forget notification
      db.addNotification({ user_id: result.data.id, role: result.data.role, title: 'Welcome Back!', message: `Logged in as ${result.data.role}`, type: 'info' }).catch(() => {});
      return { data: result.data };
    } catch (e) {
      return { error: e.message || 'Login failed' };
    }
  };

  const signup = async (userData) => {
    try {
      const result = await db.signup(userData);
      if (result.error) return { error: result.error };
      setUser(result.data);
      if (isDemoMode) localStorage.setItem('deepi_auth_user', JSON.stringify(result.data));
      db.addNotification({ user_id: result.data.id, role: result.data.role, title: 'Welcome!', message: `Account created as ${result.data.role}`, type: 'info' }).catch(() => {});
      return { data: result.data };
    } catch (e) {
      return { error: e.message || 'Signup failed' };
    }
  };

  const logout = async () => {
    if (!isDemoMode) {
      try { await supabase.auth.signOut(); } catch {}
      clearSession();
    }
    setUser(null);
    localStorage.removeItem('deepi_auth_user');
  };

  const updateUser = (updates) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    setUser(updated);
    if (isDemoMode) localStorage.setItem('deepi_auth_user', JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updateUser, isDemoMode }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
