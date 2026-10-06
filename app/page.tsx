'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';

export default function HomePage() {
  const router = useRouter();
  const { user, staff, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user && staff) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [user, staff, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="w-72 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col items-center gap-4 animate-pulse">
        <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    </div>
  );
}
