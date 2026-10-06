'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getPublicClinics, PublicClinic } from '@/app/actions/public-booking';

export default function PublicClinicsDirectoryPage() {
  const [clinics, setClinics] = useState<PublicClinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const search = new URLSearchParams(window.location.search);
      const clinicId = search.get('clinic_id') || search.get('clinic');
      if (clinicId) {
        window.location.replace(`/book/${clinicId}`);
        return;
      }
    }

    async function fetchClinics() {
      try {
        setLoading(true);
        const res = await getPublicClinics();
        if (!res.success) {
          setError(res.error || 'Failed to load clinics');
        } else {
          setClinics(res.clinics);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error connecting to booking system');
      } finally {
        setLoading(false);
      }
    }
    fetchClinics();
  }, []);

  const filteredClinics = clinics.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.phone && c.phone.toLowerCase().includes(q));
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Public Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center text-white font-bold shadow-md shadow-red-500/25">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Clinic Appointment Booking
              </h1>
              <p className="text-xs text-slate-500">Public Patient Portal • Free Online Scheduling</p>
            </div>
          </div>

          <Link
            href="/login"
            className="text-xs font-semibold text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100/70 px-3.5 py-1.5 rounded-xl border border-sky-200/60 transition"
          >
            Staff Portal →
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <div className="bg-gradient-to-b from-sky-700 to-slate-900 dark:from-sky-900 dark:to-slate-950 text-white py-12 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center space-y-3">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-blue-100 backdrop-blur-xs border border-white/15">
            🏥 Online Consultation Scheduling
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            Select a Clinic to Book an Appointment
          </h2>
          <p className="text-sm sm:text-base text-sky-100/90 max-w-xl mx-auto">
            Choose your preferred hospital or clinic below to view doctor availability and reserve your consultation slot instantly. No account required.
          </p>

          {/* Search bar */}
          <div className="pt-4 max-w-md mx-auto">
            <div className="relative">
              <svg
                className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search clinics by name or phone..."
                className="w-full pl-11 pr-4 py-3 bg-white text-slate-900 placeholder-slate-400 rounded-2xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Clinic Listing */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10">
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-sm flex items-center gap-3">
            <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Available Clinics ({filteredClinics.length})
          </h3>
          <span className="text-xs text-slate-500">Click a clinic to choose a doctor</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between h-48"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="w-11 h-11 rounded-xl bg-gray-200 dark:bg-gray-700" />
                    <div className="h-5 w-14 rounded-full bg-gray-200 dark:bg-gray-700" />
                  </div>
                  <div className="h-5 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                  <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredClinics.length === 0 ? (
          <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 p-8 shadow-xs">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-800">No clinics found</p>
            <p className="text-xs text-slate-500 mt-1">
              {searchQuery ? 'Try clearing your search query.' : 'There are currently no clinics registered.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClinics.map((clinic) => (
              <Link
                key={clinic.id}
                href={`/book/${clinic.id}`}
                className="group p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-sky-400 hover:shadow-xs transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-700 font-bold flex items-center justify-center text-base shrink-0 group-hover:bg-sky-500 group-hover:text-white transition">
                      {clinic.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                      Active
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-slate-900 group-hover:text-sky-600 transition line-clamp-1">
                    {clinic.name}
                  </h4>

                  {clinic.phone ? (
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 font-mono">
                      <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {clinic.phone}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-1">Phone not listed</p>
                  )}
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-sky-600 group-hover:text-sky-700">
                  <span>View Doctors & Times</span>
                  <span className="group-hover:translate-x-1 transition">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 text-center text-xs text-slate-400 dark:text-slate-500">
        <p>© 2026 Hospital & Clinic System. Multi-tenant public booking engine.</p>
      </footer>
    </div>
  );
}
