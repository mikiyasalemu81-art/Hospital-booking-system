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
    } catch (err: any) {
      setError(err.message || 'Error loading appointments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments(selectedDate);
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

  // Grouped appointments
  const groupedAppointments = useMemo(() => {
    return {
      booked: appointments.filter((a) => a.status === 'booked'),
      attended: appointments.filter((a) => a.status === 'attended'),
      missed: appointments.filter((a) => a.status === 'missed'),
      cancelled: appointments.filter((a) => a.status === 'cancelled'),
    };
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
    } catch (err: any) {
      setError(err.message || 'Error updating status');
    } finally {
      setProcessingId(null);
    }
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 font-semibold">
                Daily Operations
              </span>
              <span className="text-xs text-slate-500">• {clinic?.name}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
              Appointments Daily Report
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Review and track appointments by status (booked, attended, missed, cancelled) and manage patient attendance.
            </p>
          </div>

          {/* Date Selector */}
          <div className="flex items-center gap-2 self-start sm:self-center">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 bg-white"
            />
            {!isToday && (
              <button
                type="button"
                onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition"
              >
                Today
              </button>
            )}
            <button
              type="button"
              onClick={() => fetchAppointments(selectedDate)}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-700 transition"
            >
              ↻
            </button>
          </div>
        </div>

        {/* Action Success Toast */}
        {actionSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
              <span>{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess(null)} className="font-bold text-emerald-700">
              ✕
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-bold text-red-700">
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
                : 'bg-white text-slate-900 border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <p className={`text-xs font-medium ${activeTab === 'all' ? 'text-slate-300' : 'text-slate-500'}`}>
              Total {isToday ? "Today's" : ''}
            </p>
            <p className="text-2xl font-extrabold mt-1">{counts.total}</p>
          </div>

          {/* Booked */}
          <div
            onClick={() => setActiveTab('booked')}
            className={`p-4 rounded-2xl border cursor-pointer transition select-none ${
              activeTab === 'booked'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white text-slate-900 border-slate-200/80 hover:border-blue-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className={`text-xs font-medium ${activeTab === 'booked' ? 'text-blue-100' : 'text-blue-600'}`}>
                Booked
              </p>
              <span className={`w-2 h-2 rounded-full ${activeTab === 'booked' ? 'bg-white' : 'bg-blue-500'}`}></span>
            </div>
            <p className="text-2xl font-extrabold mt-1">{counts.booked}</p>
          </div>

          {/* Attended */}
          <div
            onClick={() => setActiveTab('attended')}
            className={`p-4 rounded-2xl border cursor-pointer transition select-none ${
              activeTab === 'attended'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-white text-slate-900 border-slate-200/80 hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className={`text-xs font-medium ${activeTab === 'attended' ? 'text-emerald-100' : 'text-emerald-600'}`}>
                Attended
              </p>
              <span className={`w-2 h-2 rounded-full ${activeTab === 'attended' ? 'bg-white' : 'bg-emerald-500'}`}></span>
            </div>
            <p className="text-2xl font-extrabold mt-1">{counts.attended}</p>
          </div>

          {/* Missed */}
          <div
            onClick={() => setActiveTab('missed')}
            className={`p-4 rounded-2xl border cursor-pointer transition select-none ${
              activeTab === 'missed'
                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                : 'bg-white text-slate-900 border-slate-200/80 hover:border-amber-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className={`text-xs font-medium ${activeTab === 'missed' ? 'text-amber-100' : 'text-amber-600'}`}>
                Missed
              </p>
              <span className={`w-2 h-2 rounded-full ${activeTab === 'missed' ? 'bg-white' : 'bg-amber-500'}`}></span>
            </div>
            <p className="text-2xl font-extrabold mt-1">{counts.missed}</p>
          </div>

          {/* Cancelled */}
          <div
            onClick={() => setActiveTab('cancelled')}
            className={`p-4 rounded-2xl border cursor-pointer transition select-none ${
              activeTab === 'cancelled'
                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                : 'bg-white text-slate-900 border-slate-200/80 hover:border-rose-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className={`text-xs font-medium ${activeTab === 'cancelled' ? 'text-rose-100' : 'text-rose-600'}`}>
                Cancelled
              </p>
              <span className={`w-2 h-2 rounded-full ${activeTab === 'cancelled' ? 'bg-white' : 'bg-rose-500'}`}></span>
            </div>
            <p className="text-2xl font-extrabold mt-1">{counts.cancelled}</p>
          </div>
        </div>

        {/* 2. GROUPED APPOINTMENTS TABLE */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Table Header & Status Pills */}
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Appointments on {new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
              </h2>
              <p className="text-xs text-slate-500">
                Mark active booked appointments as &apos;attended&apos; upon arrival, or &apos;missed&apos; if no-show.
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold self-start sm:self-center">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  activeTab === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({counts.total})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('booked')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  activeTab === 'booked' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Booked ({counts.booked})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('attended')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  activeTab === 'attended' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Attended ({counts.attended})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('missed')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  activeTab === 'missed' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Missed ({counts.missed})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('cancelled')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  activeTab === 'cancelled' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cancelled ({counts.cancelled})
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5 text-teal-600" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading appointments...
            </div>
          ) : displayedAppointments.length === 0 ? (
            <div className="py-16 text-center px-4">
              <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-2">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-700">No appointments in this group</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {activeTab === 'all'
                  ? 'No appointments scheduled on this date.'
                  : `No appointments with status "${activeTab}".`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-3.5 px-4 sm:px-6">Patient</th>
                    <th className="py-3.5 px-4">Doctor</th>
                    <th className="py-3.5 px-4">Time Slot</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Notes</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Attendance Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
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
                      <tr key={appt.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-4 px-4 sm:px-6">
                          <div>
                            <div className="font-semibold text-slate-900">
                              {appt.patient?.full_name || 'Patient'}
                            </div>
                            <a
                              href={`tel:${appt.patient?.phone}`}
                              className="text-xs text-teal-700 hover:underline flex items-center gap-1 mt-0.5 font-mono"
                            >
                              📞 {appt.patient?.phone}
                            </a>
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <div>
                            <div className="font-semibold text-slate-800">
                              {appt.doctor?.full_name || 'Doctor'}
                            </div>
                            <div className="text-xs text-slate-500">
                              {appt.doctor?.department || 'General Practice'}
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <span className="font-medium text-slate-800">{timeDisplay}</span>
                        </td>

                        <td className="py-4 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
                              isBooked
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : isAttended
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : isMissed
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : isCancelled
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-slate-100 text-slate-700'
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

                        <td className="py-4 px-4 text-xs text-slate-500 max-w-xs truncate" title={appt.notes || ''}>
                          {appt.notes || '—'}
                        </td>

                        <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                          {isBooked ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handleUpdateStatus(appt.id, 'attended')}
                                className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-semibold shadow-2xs transition disabled:opacity-50"
                              >
                                {isProcessing ? 'Saving...' : '✓ Mark Attended'}
                              </button>
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handleUpdateStatus(appt.id, 'missed')}
                                className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs font-semibold shadow-2xs transition disabled:opacity-50"
                              >
                                {isProcessing ? 'Saving...' : '✕ Mark Missed'}
                              </button>
                            </div>
                          ) : isAttended || isMissed ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs text-slate-400 mr-1">
                                {isAttended ? 'Patient arrived' : 'No-show'}
                              </span>
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handleUpdateStatus(appt.id, 'booked')}
                                className="px-2 py-1 rounded text-[11px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition"
                                title="Revert back to booked"
                              >
                                Revert
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">No action</span>
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
