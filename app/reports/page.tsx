'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { useAuth } from '@/components/auth-provider';
import { Appointment } from '@/lib/types';
import { updateAppointmentStatusAction } from '@/app/actions/booking';

export default function ReportsPage() {
  const { clinic } = useAuth();

  // Date selection (defaults to today)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Active status tab for filtering or viewing all
  const [activeTab, setActiveTab] = useState<'all' | 'booked' | 'attended' | 'missed' | 'cancelled'>('all');

  // Fetch appointments for the selected date
  const fetchAppointments = useCallback(async (date: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/appointments?date=${date}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch appointments');
      }
      const data = await res.json();
      setAppointments(data.appointments || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading appointments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => fetchAppointments(selectedDate));
  }, [selectedDate, fetchAppointments]);

  // Status counts
  const counts = useMemo(() => {
    const total = appointments.length;
    const booked = appointments.filter((a) => a.status === 'booked').length;
    const attended = appointments.filter((a) => a.status === 'attended').length;
    const missed = appointments.filter((a) => a.status === 'missed').length;
    const cancelled = appointments.filter((a) => a.status === 'cancelled').length;
    return { total, booked, attended, missed, cancelled };
  }, [appointments]);

  // Filtered by current tab
  const displayedAppointments = useMemo(() => {
    if (activeTab === 'all') return appointments;
    return appointments.filter((a) => a.status === activeTab);
  }, [appointments, activeTab]);

  // Handle Mark Attended or Missed
  const handleUpdateStatus = async (
    apptId: string,
    newStatus: 'booked' | 'attended' | 'missed' | 'cancelled'
  ) => {
    setProcessingId(apptId);
    setActionSuccess(null);
    try {
      const res = await updateAppointmentStatusAction(apptId, newStatus);
      if (!res.success) {
        throw new Error(res.error || 'Failed to update status');
      }

      // Optimistically update local state
      setAppointments((prev) =>
        prev.map((a) => (a.id === apptId ? { ...a, status: newStatus } : a))
      );

      setActionSuccess(`Appointment marked as "${newStatus}" successfully.`);
      setTimeout(() => setActionSuccess(null), 3500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error updating status');
    } finally {
      setProcessingId(null);
    }
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 font-semibold">
                Daily Operations
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">• {clinic?.name}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
              Appointments Daily Report
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Review and track appointments by status (booked, attended, missed, cancelled) and manage patient attendance.
            </p>
          </div>

          {/* Date Selector */}
          <div className="flex items-center gap-2 self-start sm:self-center">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3.5 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 bg-white dark:bg-slate-800"
            />
            {!isToday && (
              <button
                type="button"
                onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
              >
                Today
              </button>
            )}
            <button
              type="button"
              onClick={() => fetchAppointments(selectedDate)}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 transition"
            >
              ↻
            </button>
          </div>
        </div>

        {/* Action Success Toast */}
        {actionSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-teal-200 dark:border-teal-900 text-emerald-900 dark:text-emerald-200 text-xs flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
              <span>{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess(null)} className="font-bold text-emerald-700 dark:text-emerald-300">
              ✕
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-900 dark:text-red-200 text-xs flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-bold text-red-700 dark:text-red-300">
              ✕
            </button>
          </div>
        )}

        {/* 1. STATUS SUMMARY COUNTS CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
          {/* Total */}
          <div
            onClick={() => setActiveTab('all')}
            className={`p-4 rounded-2xl border cursor-pointer transition select-none ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-200/80 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            <p className={`text-xs font-medium ${activeTab === 'all' ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
              Total {isToday ? "Today's" : ''}
            </p>
            {loading ? (
              <div className="h-8 w-12 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse mt-1" />
            ) : (
              <p className="text-2xl font-extrabold mt-1">{counts.total}</p>
            )}
          </div>

          {/* Booked */}
          <div
            onClick={() => setActiveTab('booked')}
            className={`p-4 rounded-2xl border cursor-pointer transition select-none ${
              activeTab === 'booked'
                ? 'bg-sky-500 text-white border-sky-500 shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-200/80 dark:border-slate-700 hover:border-blue-300 dark:hover:border-sky-500'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className={`text-xs font-medium ${activeTab === 'booked' ? 'text-blue-100' : 'text-sky-600 dark:text-sky-400'}`}>
                Booked
              </p>
              <span className={`w-2 h-2 rounded-full ${activeTab === 'booked' ? 'bg-white' : 'bg-blue-500'}`}></span>
            </div>
            {loading ? (
              <div className="h-8 w-12 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse mt-1" />
            ) : (
              <p className="text-2xl font-extrabold mt-1">{counts.booked}</p>
            )}
          </div>

          {/* Attended */}
          <div
            onClick={() => setActiveTab('attended')}
            className={`p-4 rounded-2xl border cursor-pointer transition select-none ${
              activeTab === 'attended'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-200/80 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-500'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className={`text-xs font-medium ${activeTab === 'attended' ? 'text-emerald-100' : 'text-emerald-600 dark:text-emerald-400'}`}>
                Attended
              </p>
              <span className={`w-2 h-2 rounded-full ${activeTab === 'attended' ? 'bg-white' : 'bg-emerald-500'}`}></span>
            </div>
            {loading ? (
              <div className="h-8 w-12 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse mt-1" />
            ) : (
              <p className="text-2xl font-extrabold mt-1">{counts.attended}</p>
            )}
          </div>

          {/* Missed */}
          <div
            onClick={() => setActiveTab('missed')}
            className={`p-4 rounded-2xl border cursor-pointer transition select-none ${
              activeTab === 'missed'
                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-200/80 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-500'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className={`text-xs font-medium ${activeTab === 'missed' ? 'text-amber-100' : 'text-amber-600 dark:text-amber-400'}`}>
                Missed
              </p>
              <span className={`w-2 h-2 rounded-full ${activeTab === 'missed' ? 'bg-white' : 'bg-amber-500'}`}></span>
            </div>
            {loading ? (
              <div className="h-8 w-12 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse mt-1" />
            ) : (
              <p className="text-2xl font-extrabold mt-1">{counts.missed}</p>
            )}
          </div>

          {/* Cancelled */}
          <div
            onClick={() => setActiveTab('cancelled')}
            className={`p-4 rounded-2xl border cursor-pointer transition select-none ${
              activeTab === 'cancelled'
                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-200/80 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-500'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className={`text-xs font-medium ${activeTab === 'cancelled' ? 'text-rose-100' : 'text-rose-600 dark:text-rose-400'}`}>
                Cancelled
              </p>
              <span className={`w-2 h-2 rounded-full ${activeTab === 'cancelled' ? 'bg-white' : 'bg-rose-500'}`}></span>
            </div>
            {loading ? (
              <div className="h-8 w-12 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse mt-1" />
            ) : (
              <p className="text-2xl font-extrabold mt-1">{counts.cancelled}</p>
            )}
          </div>
        </div>

        {/* 2. GROUPED APPOINTMENTS TABLE */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          {/* Table Header & Status Pills */}
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Appointments on {new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Mark active booked appointments as &apos;attended&apos; upon arrival, or &apos;missed&apos; if no-show.
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold self-start sm:self-center">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  activeTab === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All ({counts.total})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('booked')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  activeTab === 'booked'
                    ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Booked ({counts.booked})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('attended')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  activeTab === 'attended'
                    ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Attended ({counts.attended})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('missed')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  activeTab === 'missed'
                    ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Missed ({counts.missed})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('cancelled')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  activeTab === 'cancelled'
                    ? 'bg-white dark:bg-slate-700 text-rose-700 dark:text-rose-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Cancelled ({counts.cancelled})
              </button>
            </div>
          </div>

          {loading ? (
            <div className="overflow-x-auto animate-pulse">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-3.5 px-4 sm:px-6">Patient</th>
                    <th className="py-3.5 px-4">Doctor</th>
                    <th className="py-3.5 px-4">Time Slot</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Notes</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Attendance Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-4 px-4 sm:px-6">
                        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-1.5" />
                        <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded mb-1.5" />
                        <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded" />
                      </td>
                      <td className="py-4 px-4 sm:px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                          <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : displayedAppointments.length === 0 ? (
            <div className="py-16 text-center px-4">
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-full flex items-center justify-center mx-auto mb-2">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No appointments in this group</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {activeTab === 'all'
                  ? 'No appointments scheduled on this date.'
                  : `No appointments with status "${activeTab}".`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-3.5 px-4 sm:px-6">Patient</th>
                    <th className="py-3.5 px-4">Doctor</th>
                    <th className="py-3.5 px-4">Time Slot</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Notes</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Attendance Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {displayedAppointments.map((appt) => {
                    const isProcessing = processingId === appt.id;
                    const isBooked = appt.status === 'booked';
                    const isAttended = appt.status === 'attended';
                    const isMissed = appt.status === 'missed';
                    const isCancelled = appt.status === 'cancelled';

                    const timeDisplay = `${new Date(appt.starts_at).toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })} - ${new Date(appt.ends_at).toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`;

                    return (
                      <tr key={appt.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                        <td className="py-4 px-4 sm:px-6">
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {appt.patient?.full_name || 'Patient'}
                            </div>
                            <a
                              href={`tel:${appt.patient?.phone}`}
                              className="text-xs text-sky-700 dark:text-sky-400 hover:underline flex items-center gap-1 mt-0.5 font-mono"
                            >
                              📞 {appt.patient?.phone}
                            </a>
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <div>
                            <div className="font-semibold text-slate-800 dark:text-white">
                              {appt.doctor?.full_name || 'Doctor'}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {appt.doctor?.department || 'General Practice'}
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <span className="font-medium text-slate-800 dark:text-slate-200">{timeDisplay}</span>
                        </td>

                        <td className="py-4 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
                              isBooked
                                ? 'bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-900'
                                : isAttended
                                ? 'bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-900'
                                : isMissed
                                ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                                : isCancelled
                                ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isBooked
                                  ? 'bg-blue-500'
                                  : isAttended
                                  ? 'bg-emerald-500'
                                  : isMissed
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                            ></span>
                            {appt.status}
                          </span>
                        </td>

                        <td className="py-4 px-4 text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate" title={appt.notes || ''}>
                          {appt.notes || '—'}
                        </td>

                        <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                          {isBooked ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handleUpdateStatus(appt.id, 'attended')}
                                className="px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-xs font-semibold shadow-2xs transition disabled:opacity-50"
                              >
                                {isProcessing ? 'Saving...' : '✓ Mark Attended'}
                              </button>
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handleUpdateStatus(appt.id, 'missed')}
                                className="px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-xs font-semibold shadow-2xs transition disabled:opacity-50"
                              >
                                {isProcessing ? 'Saving...' : '✕ Mark Missed'}
                              </button>
                            </div>
                          ) : isAttended || isMissed ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs text-slate-400 dark:text-slate-500 mr-1">
                                {isAttended ? 'Patient arrived' : 'No-show'}
                              </span>
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handleUpdateStatus(appt.id, 'booked')}
                                className="px-2 py-1 rounded text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition"
                                title="Revert back to booked"
                              >
                                Revert
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 dark:text-slate-500 italic">No action</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
