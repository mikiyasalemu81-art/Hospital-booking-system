'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';

export default function LoginPage() {
  const router = useRouter();
  const { user, staff, signIn, loading: authLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Quick reset password state for testing/demo
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('mikiyasalemu81@gmail.com');
  const [newPassword, setNewPassword] = useState('Password123!');
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user && staff) {
      router.push('/dashboard');
    }
  }, [user, staff, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await signIn(email.trim(), password);
      if (res.error) {
        setError(res.error);
        setLoading(false);
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to sign in');
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setResetSuccess(null);
    setResetError(null);

    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, password: newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setResetError(data.error || 'Failed to update password');
      } else {
        setResetSuccess(`Password updated successfully! You can now log in with password: ${newPassword}`);
        setEmail(resetEmail);
        setPassword(newPassword);
      }
    } catch (err: any) {
      setResetError(err.message || 'Network error');
    } finally {
      setResetLoading(false);
    }
  };

  const fillDemoCredentials = () => {
    setEmail('mikiyasalemu81@gmail.com');
    setPassword('Password123!');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Healthcare Logo */}
        <div className="flex justify-center">
          <div className="h-14 w-14 rounded-2xl bg-teal-600 flex items-center justify-center text-white shadow-lg shadow-teal-600/30">
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Hospital & Clinic Portal
        </h2>
        <p className="mt-1 text-center text-sm text-slate-500">
          Staff authentication powered by Supabase
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200/80 rounded-2xl sm:px-10">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2.5">
                <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="leading-snug">
                  <p className="font-medium">Authentication Failed</p>
                  <p className="mt-0.5 text-xs text-red-600">{error}</p>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Staff Email Address
              </label>
              <div className="mt-1.5 relative">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@clinic.com"
                  className="block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-sm transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="mt-1.5 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-sm transition"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  'Sign In to Dashboard'
                )}
              </button>
            </div>

            {/* Link to Sign Up */}
            <div className="pt-2 text-center border-t border-slate-100">
              <p className="text-xs text-slate-600">
                Don&apos;t have a clinic account?{' '}
                <Link
                  href="/signup"
                  className="font-semibold text-teal-600 hover:text-teal-700 hover:underline"
                >
                  Sign Up
                </Link>
              </p>
            </div>
          </form>

          {/* Quick Credential / Testing Helper Box */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3.5 text-xs text-slate-600">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-teal-500 inline-block"></span>
                  Configured Staff Account
                </span>
                <button
                  type="button"
                  onClick={fillDemoCredentials}
                  className="text-teal-600 hover:text-teal-800 font-medium underline"
                >
                  Auto-fill
                </button>
              </div>
              <p className="font-mono text-slate-700 break-all">mikiyasalemu81@gmail.com</p>
              
              <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                <span className="text-slate-500">Need to set or reset password?</span>
                <button
                  type="button"
                  onClick={() => setShowResetModal(!showResetModal)}
                  className="text-teal-600 hover:text-teal-700 font-medium underline"
                >
                  {showResetModal ? 'Close' : 'Set Password'}
                </button>
              </div>
            </div>

            {/* In-place Password Setter */}
            {showResetModal && (
              <div className="mt-3 p-4 bg-teal-50/70 border border-teal-200 rounded-xl text-xs space-y-3">
                <p className="font-semibold text-teal-900">Set Account Password in Supabase</p>
                <p className="text-teal-700 leading-relaxed">
                  If you didn&apos;t set or don&apos;t recall the password for this staff email in Supabase, you can set it directly here:
                </p>

                {resetSuccess && (
                  <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-lg font-medium">
                    {resetSuccess}
                  </div>
                )}
                {resetError && (
                  <div className="p-2.5 bg-red-100 text-red-800 rounded-lg font-medium">
                    {resetError}
                  </div>
                )}

                <div className="space-y-2">
                  <div>
                    <label className="block text-slate-600 font-medium">Email</label>
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full mt-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium">New Password</label>
                    <input
                      type="text"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full mt-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleResetPassword}
                    disabled={resetLoading}
                    className="w-full py-2 bg-teal-700 hover:bg-teal-800 text-white font-medium rounded-lg disabled:opacity-50 transition"
                  >
                    {resetLoading ? 'Updating Supabase...' : 'Save & Auto-Fill Password'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
