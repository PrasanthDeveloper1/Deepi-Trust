import React, { createContext, useState, useContext, useEffect } from 'react';
import { db, isDemoMode } from '../config/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session from sessionStorage (per-tab persistence)
    const stored = sessionStorage.getItem('deepi_user');
    if (stored) {
      try { setUser(JSON.parse(stored)); }
      catch { sessionStorage.removeItem('deepi_user'); }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const result = await db.login(email, password);
      if (result.error) return { error: result.error };
      setUser(result.data);
      sessionStorage.setItem('deepi_user', JSON.stringify(result.data));
      // Fire-and-forget notification
      db.addNotification({
        user_id: result.data.id, role: result.data.role,
        title: 'Welcome Back!', message: `Logged in as ${result.data.role}`, type: 'info'
      }).catch(() => {});
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
      sessionStorage.setItem('deepi_user', JSON.stringify(result.data));
      db.addNotification({
        user_id: result.data.id, role: result.data.role,
        title: 'Welcome!', message: `Account created as ${result.data.role}`, type: 'info'
      }).catch(() => {});
      return { data: result.data };
    } catch (e) {
      return { error: e.message || 'Signup failed' };
    }
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem('deepi_user');
  };

  const updateUser = (updates) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    setUser(updated);
    sessionStorage.setItem('deepi_user', JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updateUser, isDemoMode }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
