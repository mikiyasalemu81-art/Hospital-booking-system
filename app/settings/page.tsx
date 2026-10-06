'use client';

import React, { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { useAuth } from '@/components/auth-provider';

const MIN_PASSWORD_LENGTH = 8;

export default function SettingsPage() {
  const { user, staff, clinic, changePassword } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all three password fields.');
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Your new password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The new password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('Your new password must be different from your current password.');
      return;
    }

    setSubmitting(true);
    const res = await changePassword(currentPassword, newPassword);
    setSubmitting(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setSuccess('Your password has been changed successfully. Use your new password the next time you sign in.');
  };

  const inputClass =
    'w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 shadow-2xs transition';

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Account Settings</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Manage your staff account security.</p>
        </div>

        {/* Account summary */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-xs p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Name</p>
            <p className="mt-1 font-semibold text-slate-900 dark:text-white truncate">{staff?.full_name || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email</p>
            <p className="mt-1 font-medium text-slate-800 dark:text-slate-200 truncate">{user?.email || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Clinic</p>
            <p className="mt-1 font-medium text-slate-800 dark:text-slate-200 truncate">{clinic?.name || '—'}</p>
          </div>
        </div>

        {/* Change password */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Change Password</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">You&apos;ll need your current password to set a new one.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowPasswords((v) => !v)}
              className="text-xs text-sky-600 hover:text-sky-700 font-semibold"
            >
              {showPasswords ? 'Hide passwords' : 'Show passwords'}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4" noValidate>
            {error && (
              <div role="alert" className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                {error}
              </div>
            )}
            {success && (
              <div role="status" className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                {success}
              </div>
            )}

            <div>
              <label htmlFor="current_password" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Current Password
              </label>
              <input
                id="current_password"
                type={showPasswords ? 'text' : 'password'}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="new_password" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                New Password
              </label>
              <input
                id="new_password"
                type={showPasswords ? 'text' : 'password'}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="confirm_password" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Confirm New Password
              </label>
              <input
                id="confirm_password"
                type={showPasswords ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="mt-1 text-xs text-red-600">Passwords do not match.</p>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 bg-sky-500 text-white rounded-xl text-xs font-semibold hover:bg-sky-600 disabled:opacity-50 transition shadow-xs"
              >
                {submitting ? 'Updating Password...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
