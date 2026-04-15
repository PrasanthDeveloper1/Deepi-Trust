import React, { createContext, useState, useContext, useEffect } from 'react';
import { db, isDemoMode, supabase } from '../config/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemoMode) {
      // Demo mode: restore session from localStorage
      const stored = localStorage.getItem('deepi_auth_user');
      if (stored) {
        try { setUser(JSON.parse(stored)); }
        catch (e) { localStorage.removeItem('deepi_auth_user'); }
      }
      setLoading(false);
    } else {
      // Supabase mode: listen for auth state changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          // Fetch profile
          const { data: profile } = await supabase
            .from('profiles').select('*').eq('id', session.user.id).single();
          if (profile) {
            setUser(profile);
          }
        } else {
          setUser(null);
        }
        setLoading(false);
      });
      // Check initial session
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles').select('*').eq('id', session.user.id).single();
          if (profile) setUser(profile);
        }
        setLoading(false);
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  const login = async (email, password) => {
    const result = await db.login(email, password);
    if (result.error) return { error: result.error };
    if (isDemoMode) {
      setUser(result.data);
      localStorage.setItem('deepi_auth_user', JSON.stringify(result.data));
    }
    // Supabase mode: auth state listener handles setUser automatically
    await db.addNotification({
      user_id: result.data.id,
      role: result.data.role,
      title: 'Welcome Back!',
      message: `Logged in successfully as ${result.data.role}`,
      type: 'info'
    });
    return { data: result.data };
  };

  const signup = async (userData) => {
    const result = await db.signup(userData);
    if (result.error) return { error: result.error };
    if (isDemoMode) {
      setUser(result.data);
      localStorage.setItem('deepi_auth_user', JSON.stringify(result.data));
    }
    await db.addNotification({
      user_id: result.data.id, // notify the user themselves
      role: result.data.role,
      title: 'Welcome to Deepi Trust!',
      message: `Your account has been created as ${result.data.role}. Welcome aboard!`,
      type: 'info'
    });
    return { data: result.data };
  };

  const logout = async () => {
    if (!isDemoMode) {
      await supabase.auth.signOut();
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
