'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured, friendlyAuthError, SUPABASE_NOT_CONFIGURED_MESSAGE } from '@/lib/supabase/config';
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
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  staff: null,
  clinic: null,
  loading: true,
  signIn: async () => ({ error: 'Not implemented' }),
  signOut: async () => {},
  refresh: async () => {},
  changePassword: async () => ({ error: 'Not implemented' }),
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
    if (!isSupabaseConfigured) {
      console.error(
        '[auth] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are missing or invalid in this build.'
      );
      return { error: SUPABASE_NOT_CONFIGURED_MESSAGE };
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('[auth] signIn error:', error);
        return { error: friendlyAuthError(error) };
      }

      if (data.session) {
        setUser(data.user);
        await loadStaffAndClinic(data.session.access_token);
      }

      return { error: null };
    } catch (err: unknown) {
      console.error('[auth] signIn exception:', err);
      return { error: friendlyAuthError(err) };
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!isSupabaseConfigured) return { error: SUPABASE_NOT_CONFIGURED_MESSAGE };

    const email = user?.email;
    if (!email) return { error: 'Your session has expired. Please sign in again.' };

    try {
      // 1. Verify the current password by re-authenticating the same user.
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (verifyError) {
        const msg = verifyError.message?.toLowerCase() || '';
        if (msg.includes('invalid login credentials')) {
          return { error: 'Your current password is incorrect.' };
        }
        return { error: friendlyAuthError(verifyError) };
      }

      // 2. Update to the new password via Supabase Auth.
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        const msg = updateError.message?.toLowerCase() || '';
        if (msg.includes('different from the old')) {
          return { error: 'Your new password must be different from your current password.' };
        }
        if (msg.includes('weak') || msg.includes('at least')) {
          return { error: updateError.message };
        }
        if (msg.includes('reauthentication')) {
          return {
            error:
              'Your account requires re-authentication to change the password. Please sign out, sign in again, and retry.',
          };
        }
        return { error: friendlyAuthError(updateError) };
      }

      return { error: null };
    } catch (err: unknown) {
      return { error: friendlyAuthError(err) };
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
        changePassword,
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
