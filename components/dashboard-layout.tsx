'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './auth-provider';
import { useTheme } from './theme-provider';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

/* ── Logo (red cross, used in sidebar header) ───────────────── */
function ClinicLogo({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      aria-label="ClinicHub logo"
    >
      <rect width="36" height="36" rx="10" fill="#ef4444" />
      <path
        d="M18 8v20M8 18h20"
        stroke="white"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ── Sun / Moon toggle icon ─────────────────────────────────── */
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="p-2 rounded-xl text-slate-500 hover:text-sky-600 hover:bg-sky-50 dark:text-slate-400 dark:hover:text-sky-400 dark:hover:bg-sky-950/40 transition"
    >
      {theme === 'dark' ? (
        /* Sun */
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="5" />
          <path strokeLinecap="round" d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ) : (
        /* Moon */
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      )}
    </button>
  );
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, staff, clinic, loading, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !staff)) {
      router.replace('/login');
    }
  }, [user, staff, loading, router]);

  // Dynamically update browser tab title
  useEffect(() => {
    if (clinic?.name) {
      const sectionNames: Record<string, string> = {
        '/dashboard': 'Dashboard',
        '/booking': 'Appointments',
        '/doctors': 'Doctors',
        '/patients': 'Patients',
        '/doctor-performance': 'Doctor Performance',
        '/reports': 'Reports',
        '/settings': 'Settings',
      };
      const section = sectionNames[pathname] || 'Portal';
      document.title = `${clinic.name} — ${section}`;
    }
  }, [clinic?.name, pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 animate-pulse">
        {/* Sidebar skeleton */}
        <div className="hidden md:flex md:w-64 flex-col border-r border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-xl bg-gray-200 dark:bg-gray-700" />
            <div className="space-y-1.5 flex-1">
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </div>
          <div className="space-y-3 px-2 pt-4">
            <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="space-y-2">
              <div className="h-9 w-full bg-gray-200 dark:bg-gray-700 rounded-xl" />
              <div className="h-9 w-full bg-gray-200 dark:bg-gray-700 rounded-xl" />
              <div className="h-9 w-full bg-gray-200 dark:bg-gray-700 rounded-xl" />
            </div>
          </div>
          <div className="space-y-3 px-2 pt-2">
            <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="space-y-2">
              <div className="h-9 w-full bg-gray-200 dark:bg-gray-700 rounded-xl" />
              <div className="h-9 w-full bg-gray-200 dark:bg-gray-700 rounded-xl" />
            </div>
          </div>
        </div>

        {/* Content skeleton */}
        <div className="flex-1 flex flex-col">
          {/* Header skeleton */}
          <div className="h-16 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 flex items-center justify-between">
            <div className="h-5 w-36 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700" />
            </div>
          </div>
          {/* Main content skeleton */}
          <div className="p-6 md:p-8 space-y-6 flex-1">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="h-28 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4">
                <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
                <div className="h-7 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
              <div className="h-28 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4">
                <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
                <div className="h-7 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
              <div className="h-28 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4">
                <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
                <div className="h-7 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
              <div className="h-28 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4">
                <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
                <div className="h-7 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            </div>
            <div className="h-80 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800" />
          </div>
        </div>
      </div>
    );
  }

  if (!user || !staff) return null;

  const navSections: NavSection[] = [
    {
      title: 'Overview',
      items: [
        {
          name: 'Dashboard',
          href: '/dashboard',
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          ),
        },
        {
          name: 'Doctor Performance',
          href: '/doctor-performance',
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'Patients & Doctors',
      items: [
        {
          name: 'Doctors',
          href: '/doctors',
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          ),
        },
        {
          name: 'Patients',
          href: '/patients',
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'Booking & Reports',
      items: [
        {
          name: 'Booking',
          href: '/booking',
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          ),
        },
        {
          name: 'Reports',
          href: '/reports',
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'Settings',
      items: [
        {
          name: 'Settings',
          href: '/settings',
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
        },
      ],
    },
  ];

  // Breadcrumb resolver
  let currentSection = 'Overview';
  let currentPageTitle = 'Dashboard Overview';
  let currentPageShort = 'Dashboard';

  if (pathname === '/dashboard') {
    currentSection = 'Overview'; currentPageTitle = 'Dashboard Overview'; currentPageShort = 'Dashboard';
  } else if (pathname === '/doctor-performance') {
    currentSection = 'Overview'; currentPageTitle = 'Doctor Performance'; currentPageShort = 'Performance';
  } else if (pathname === '/doctors') {
    currentSection = 'Patients & Doctors'; currentPageTitle = 'Doctors & Schedules'; currentPageShort = 'Doctors';
  } else if (pathname === '/patients') {
    currentSection = 'Patients & Doctors'; currentPageTitle = 'Patients Directory'; currentPageShort = 'Patients';
  } else if (pathname === '/booking') {
    currentSection = 'Booking & Reports'; currentPageTitle = 'Appointments Booking'; currentPageShort = 'Booking';
  } else if (pathname === '/reports') {
    currentSection = 'Booking & Reports'; currentPageTitle = 'Daily Reports & Attendance'; currentPageShort = 'Reports';
  } else if (pathname === '/settings') {
    currentSection = 'Settings'; currentPageTitle = 'Account Settings'; currentPageShort = 'Settings';
  }

  /* ── Shared sidebar markup ───────────────────────────────────── */
  const sidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      {/* Clinic header */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
        <ClinicLogo size={36} />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
            {clinic?.name || 'ClinicHub'}
          </h2>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">Staff Portal</p>
          </div>
        </div>
      </div>

      {/* Nav sections */}
      <div className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-1">
            <div className="px-3 pb-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {section.title}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={isActive ? 'text-sky-500 dark:text-sky-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors'}>
                        {item.icon}
                      </span>
                      <span className="truncate">{item.name}</span>
                    </div>
                    {isActive && (
                      <span className="w-1.5 h-3.5 rounded-full bg-sky-500 dark:bg-sky-400 shrink-0" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {/* Public booking quick link */}
        <div className="pt-2 mx-1">
          <div className="p-3 bg-teal-50 dark:bg-teal-950/40 rounded-xl border border-teal-100 dark:border-teal-900 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-teal-900 dark:text-teal-300">Public Booking</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-300 font-medium">Live</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              Patients can book appointments directly via your public link.
            </p>
            {clinic?.id && (
              <Link
                href={`/book/${clinic.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-200 transition"
              >
                <span>Open public page</span>
                <span>↗</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Staff profile & logout */}
      <div className="p-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300 flex items-center justify-center font-bold text-xs shrink-0">
            {staff.full_name?.charAt(0).toUpperCase() || 'S'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{staff.full_name}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={signOut}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-900 transition"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile / Tablet Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white dark:bg-slate-900 z-50 shadow-2xl">
            <div className="absolute top-3 right-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                aria-label="Close menu"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        {/* Top Navbar */}
        <header className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              aria-label="Open sidebar menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="min-w-0">
              {/* Breadcrumbs */}
              <nav className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 mb-0.5 truncate">
                <Link href="/dashboard" className="hover:text-sky-500 dark:hover:text-sky-400 transition-colors">
                  {clinic?.name || 'Clinic'}
                </Link>
                <span>/</span>
                <span className="text-slate-500 dark:text-slate-400 font-medium">{currentSection}</span>
                <span>/</span>
                <span className="text-slate-900 dark:text-white font-semibold">{currentPageShort}</span>
              </nav>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight truncate">
                {currentPageTitle}
              </h1>
            </div>
          </div>

          {/* Right side: quick links + theme toggle + staff badge */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Quick links */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
              <Link
                href="/booking"
                className={`px-2.5 py-1 rounded-lg transition font-medium ${
                  pathname === '/booking'
                    ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                + Book
              </Link>
              <Link
                href="/patients"
                className={`px-2.5 py-1 rounded-lg transition font-medium ${
                  pathname === '/patients'
                    ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Patients
              </Link>
              <Link
                href="/reports"
                className={`px-2.5 py-1 rounded-lg transition font-medium ${
                  pathname === '/reports'
                    ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Reports
              </Link>
            </div>

            {/* Theme toggle */}
            <ThemeToggle />

            {/* Staff badge */}
            <div className="hidden md:flex items-center gap-2 bg-slate-50 dark:bg-slate-800 py-1 px-2.5 rounded-full text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
              <span className="truncate max-w-[130px] font-semibold text-slate-800 dark:text-slate-100">
                {staff.full_name}
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
