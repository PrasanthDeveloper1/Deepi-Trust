import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { db, isDemoMode, supabase } from '../config/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Prevent onAuthStateChange from overriding explicit setUser during login/signup
  const skipAuthListener = useRef(false);

  useEffect(() => {
    if (isDemoMode) {
      const stored = localStorage.getItem('deepi_auth_user');
      if (stored) {
        try { setUser(JSON.parse(stored)); }
        catch (e) { localStorage.removeItem('deepi_auth_user'); }
      }
      setLoading(false);
    } else {
      // Supabase mode: listen for auth state changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        // Skip if login/signup is handling user state directly
        if (skipAuthListener.current) return;
        if (session?.user) {
          try {
            const { data: profile } = await supabase
              .from('profiles').select('*').eq('id', session.user.id).maybeSingle();
            if (profile) setUser(profile);
          } catch (e) { /* ignore fetch errors during auth transitions */ }
        } else {
          setUser(null);
        }
        setLoading(false);
      });
      // Check initial session
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session?.user) {
          try {
            const { data: profile } = await supabase
              .from('profiles').select('*').eq('id', session.user.id).maybeSingle();
            if (profile) setUser(profile);
          } catch (e) { /* ignore */ }
        }
        setLoading(false);
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  const login = async (email, password) => {
    try {
      skipAuthListener.current = true;
      const result = await db.login(email, password);
      if (result.error) { skipAuthListener.current = false; return { error: result.error }; }
      // Always set user explicitly — don't rely on onAuthStateChange
      setUser(result.data);
      if (isDemoMode) {
        localStorage.setItem('deepi_auth_user', JSON.stringify(result.data));
      }
      // Fire-and-forget notification (don't block login)
      db.addNotification({
        user_id: result.data.id,
        role: result.data.role,
        title: 'Welcome Back!',
        message: `Logged in successfully as ${result.data.role}`,
        type: 'info'
      }).catch(() => {});
      skipAuthListener.current = false;
      return { data: result.data };
    } catch (e) {
      skipAuthListener.current = false;
      return { error: e.message || 'Login failed' };
    }
  };

  const signup = async (userData) => {
    try {
      skipAuthListener.current = true;
      const result = await db.signup(userData);
      if (result.error) { skipAuthListener.current = false; return { error: result.error }; }
      // Always set user explicitly
      setUser(result.data);
      if (isDemoMode) {
        localStorage.setItem('deepi_auth_user', JSON.stringify(result.data));
      }
      // Fire-and-forget notification
      db.addNotification({
        user_id: result.data.id,
        role: result.data.role,
        title: 'Welcome to Deepi Trust!',
        message: `Your account has been created as ${result.data.role}. Welcome aboard!`,
        type: 'info'
      }).catch(() => {});
      skipAuthListener.current = false;
      return { data: result.data };
    } catch (e) {
      skipAuthListener.current = false;
      return { error: e.message || 'Signup failed' };
    }
  };

  const logout = async () => {
    if (!isDemoMode) {
      try { await supabase.auth.signOut(); } catch (e) { /* ignore */ }
    }
    setUser(null);
    localStorage.removeItem('deepi_auth_user');
  };

  const updateUser = (updates) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    setUser(updated);
    if (isDemoMode) {
      localStorage.setItem('deepi_auth_user', JSON.stringify(updated));
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updateUser, isDemoMode }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
