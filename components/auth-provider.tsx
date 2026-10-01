'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { Clinic, Staff } from '@/lib/types';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  staff: Staff | null;
  clinic: Clinic | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  staff: null,
  clinic: null,
  loading: true,
  signIn: async () => ({ error: 'Not implemented' }),
  signOut: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  const loadStaffAndClinic = useCallback(async (token?: string) => {
    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/auth/me', { headers });
      if (res.ok) {
        const data = await res.json();
        setStaff(data.staff);
        setClinic(data.clinic);
        if (data.user) {
          setUser((prev) => prev || data.user);
        }
      } else {
        setStaff(null);
        setClinic(null);
      }
    } catch (err) {
      console.error('Failed to load staff/clinic details:', err);
      setStaff(null);
      setClinic(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (session?.user) {
          setUser(session.user);
          await loadStaffAndClinic(session.access_token);
        } else {
          setUser(null);
          setStaff(null);
          setClinic(null);
        }
      } catch (err) {
        console.error('Error during initAuth:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (session?.user) {
        setUser(session.user);
        await loadStaffAndClinic(session.access_token);
      } else {
        setUser(null);
        setStaff(null);
        setClinic(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, [supabase, loadStaffAndClinic]);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      if (data.session) {
        setUser(data.user);
        await loadStaffAndClinic(data.session.access_token);
      }

      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Login failed' };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Sign out error:', e);
    } finally {
      setUser(null);
      setStaff(null);
      setClinic(null);
      router.push('/login');
    }
  };

  const refresh = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    await loadStaffAndClinic(session?.access_token);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        staff,
        clinic,
        loading,
        signIn,
        signOut,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
