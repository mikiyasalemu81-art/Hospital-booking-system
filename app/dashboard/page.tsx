'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/dashboard-layout';
import { useAuth } from '@/components/auth-provider';
import { Doctor, Patient, formatWorkDays, formatTime } from '@/lib/types';

export default function DashboardPage() {
  const { staff, clinic } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      Promise.resolve().then(() => setOrigin(window.location.origin));
    }
  }, []);

  const clinicId = clinic?.id || staff?.clinic_id || '';
  const bookingUrl = clinicId ? `${origin || ''}/book/${clinicId}` : '';

  const handleCopyLink = async () => {
    if (!bookingUrl) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(bookingUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = bookingUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        const [docsRes, patientsRes] = await Promise.all([
          fetch('/api/doctors'),
          fetch('/api/patients'),
        ]);

        if (docsRes.ok) {
          const docsData = await docsRes.json();
          setDoctors(docsData.doctors || []);
        }

        if (patientsRes.ok) {
          const patientsData = await patientsRes.json();
          setPatients(patientsData.patients || []);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  // Dynamically update browser tab title to clinic name
  useEffect(() => {
    if (clinic?.name) {
      document.title = `${clinic.name} — Dashboard`;
    }
  }, [clinic?.name]);

  const activeDoctorsCount = doctors.filter((d) => d.active).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-7 border border-slate-200/70 dark:border-slate-800 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-900">
                Staff Dashboard
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Clinic: <strong className="text-slate-800 dark:text-slate-200">{clinic?.name || 'Clinic'}</strong>
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {clinic?.name ? `${clinic.name}` : `Hello, ${staff?.full_name || 'Staff Member'}!`}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Welcome back, {staff?.full_name || 'Staff'}. Manage doctors, consultation slots, patient profiles, and records for {clinic?.name || 'your clinic'}.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5 shrink-0">
            <Link
              href="/booking"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold shadow-xs transition"
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Book Appointment
            </Link>
            <Link
              href="/doctors"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-2xs transition"
            >
              <svg className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Doctor
            </Link>
            <Link
              href="/patients"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-2xs transition"
            >
              <svg className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Patient
            </Link>
          </div>
        </div>

        {/* Your Booking Link Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-5 sm:p-6 shadow-xs relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Your Booking Link</h3>
                <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 px-2.5 py-0.5 rounded-full border border-teal-200 dark:border-teal-900">
                  Permanent • Never Expires
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Share this public booking link with your patients via SMS, email, or website. Patients can schedule appointments directly with{' '}
                <strong className="text-slate-700 dark:text-slate-200">{clinic?.name || 'your clinic'}</strong> without an account.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-80 lg:w-96">
                <input
                  type="text"
                  readOnly
                  value={bookingUrl || 'Loading permanent booking link...'}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-200 select-all focus:outline-none focus:border-sky-500 transition shadow-2xs"
                  title="Click to select entire URL"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 dark:text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 transition"
                  title={copied ? 'Copied!' : 'Copy to clipboard'}
                >
                  {copied ? (
                    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  disabled={!bookingUrl}
                  className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-xs transition ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-sky-500 hover:bg-sky-600 text-white'
                  }`}
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy Link
                    </>
                  )}
                </button>

                {bookingUrl && (
                  <a
                    href={bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium shadow-xs transition"
                    title="Open booking link in new tab"
                  >
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Preview
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Stats Row */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                  <div className="w-9 h-9 rounded-xl bg-gray-200 dark:bg-gray-700"></div>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <div className="h-8 w-14 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                  <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                </div>
                <div className="mt-3 h-2.5 w-32 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Total Doctors
                </span>
                <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{doctors.length}</span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  {activeDoctorsCount} active
                </span>
              </div>
              <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                Assigned to {clinic?.name || 'this clinic'}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Total Patients
                </span>
                <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{patients.length}</span>
                <span className="text-xs text-sky-600 dark:text-sky-400 font-medium">Registered</span>
              </div>
              <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                Filtered by clinic records
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Clinic Phone
                </span>
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
              </div>
              <div className="mt-3">
                <span className="text-base font-bold text-slate-900 dark:text-white truncate block font-mono">
                  {clinic?.phone || 'Not set'}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                Primary contact line
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Clinic Timezone
                </span>
                <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="mt-3">
                <span className="text-base font-bold text-slate-900 dark:text-white truncate block">
                  {clinic?.timezone || 'UTC'}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                Schedule synchronization zone
              </p>
            </div>
          </div>
        )}

        {/* Two-column preview: Recent Doctors & Recent Patients */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Doctors Preview */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-xs p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Doctors Overview</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Active medical personnel & schedules</p>
              </div>
              <Link
                href="/doctors"
                className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
              >
                View all ({doctors.length})
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            {loading ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 animate-pulse">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="py-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0"></div>
                      <div className="space-y-1.5 min-w-0">
                        <div className="h-3.5 w-32 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                        <div className="h-2.5 w-44 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                        <div className="h-2 w-28 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                      </div>
                    </div>
                    <div className="w-16 h-5 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0"></div>
                  </div>
                ))}
              </div>
            ) : doctors.length === 0 ? (
              <div className="text-center py-8 px-4 bg-slate-50/50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No doctors registered yet</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Get started by adding your first doctor</p>
                <Link
                  href="/doctors"
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-500 text-white rounded-lg text-xs font-semibold hover:bg-sky-600 transition"
                >
                  Add Doctor
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {doctors.slice(0, 4).map((doc) => (
                  <div key={doc.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{doc.full_name}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {doc.department || 'General Medicine'} • {doc.slot_minutes} min slots
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                        {formatWorkDays(doc.work_days)} ({formatTime(doc.start_time)} - {formatTime(doc.end_time)})
                      </p>
                    </div>
                    <div className="shrink-0">
                      <span
                        className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${
                          doc.active
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {doc.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Patients Preview */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-xs p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Patients Directory</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Registered patients for this clinic</p>
              </div>
              <Link
                href="/patients"
                className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
              >
                View all ({patients.length})
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            {loading ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 animate-pulse">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="py-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0"></div>
                      <div className="space-y-1.5 min-w-0">
                        <div className="h-3.5 w-32 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                        <div className="h-2.5 w-28 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                      </div>
                    </div>
                    <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded-md shrink-0"></div>
                  </div>
                ))}
              </div>
            ) : patients.length === 0 ? (
              <div className="text-center py-8 px-4 bg-slate-50/50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No patients registered yet</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Register new patients to schedule visits</p>
                <Link
                  href="/patients"
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-500 text-white rounded-lg text-xs font-semibold hover:bg-sky-600 transition"
                >
                  Add Patient
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {patients.slice(0, 4).map((patient) => (
                  <div key={patient.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{patient.full_name}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5 font-mono truncate">
                        <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {patient.phone}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[11px] text-slate-400">
                        {new Date(patient.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
