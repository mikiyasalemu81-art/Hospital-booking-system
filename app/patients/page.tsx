'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { useAuth } from '@/components/auth-provider';
import { Patient } from '@/lib/types';

export default function PatientsPage() {
  const { clinic } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Search query
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Add Patient Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [patientNotes, setPatientNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Edit Notes Modal
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchPatients = useCallback(async (query: string) => {
    try {
      setLoading(true);
      setError(null);
      const url = query
        ? `/api/patients?q=${encodeURIComponent(query)}`
        : '/api/patients';

      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch patients');
      }

      const data = await res.json();
      setPatients(data.patients || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading patients');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => fetchPatients(debouncedQuery));
  }, [debouncedQuery, fetchPatients]);

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setFormError('Patient full name is required');
      return;
    }

    if (!phone.trim()) {
      setFormError('Phone number is required');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: phone.trim(),
          notes: patientNotes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add patient');
      }

      setSuccessMessage(`Patient ${fullName.trim()} registered successfully!`);
      setIsAddModalOpen(false);
      setFullName('');
      setPhone('');
      setPatientNotes('');
      await fetchPatients(debouncedQuery);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error adding patient');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenNotesModal = (patient: Patient) => {
    setEditingPatient(patient);
    setEditNotes(patient.notes || '');
    setNotesError(null);
  };

  const handleSaveNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPatient) return;

    setSavingNotes(true);
    setNotesError(null);

    try {
      const res = await fetch(`/api/patients/${editingPatient.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: editNotes.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save notes');
      }

      setSuccessMessage(`Notes updated for ${editingPatient.full_name}.`);
      setEditingPatient(null);
      await fetchPatients(debouncedQuery);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      setNotesError(err instanceof Error ? err.message : 'Error saving notes');
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Patients Directory</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Search, view, and register patients registered at {clinic?.name || 'this clinic'}.
            </p>
          </div>
          <div>
            <button
              onClick={() => {
                setFullName('');
                setPhone('');
                setPatientNotes('');
                setFormError(null);
                setIsAddModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 text-white text-xs font-semibold hover:bg-sky-600 shadow-xs transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add New Patient
            </button>
          </div>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-800 text-xs font-semibold">
              Dismiss
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Search Bar */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full relative">
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
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
              placeholder="Search patients by full name or phone number..."
              className="w-full pl-10 pr-10 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 bg-white dark:bg-slate-800 shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                title="Clear search"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <div className="shrink-0 text-xs text-slate-500 dark:text-slate-400 font-medium">
            {patients.length} patient{patients.length === 1 ? '' : 's'} registered
          </div>
        </div>

        {/* Patients Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-xs overflow-hidden">
          {loading ? (
            <div className="overflow-x-auto animate-pulse">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-3.5 px-4 sm:px-6">Patient</th>
                    <th className="py-3.5 px-4">Phone Number</th>
                    <th className="py-3.5 px-4">Date of Birth</th>
                    <th className="py-3.5 px-4">Registered</th>
                    <th className="py-3.5 px-4">Notes</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <tr key={i}>
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0"></div>
                          <div className="space-y-1.5">
                            <div className="h-3.5 w-32 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                            <div className="h-2.5 w-16 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 w-28 rounded-md bg-gray-200 dark:bg-gray-700"></div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 w-20 rounded-md bg-gray-200 dark:bg-gray-700"></div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 w-20 rounded-md bg-gray-200 dark:bg-gray-700"></div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-3.5 w-40 rounded-md bg-gray-200 dark:bg-gray-700"></div>
                      </td>
                      <td className="py-4 px-4 sm:px-6 text-right">
                        <div className="h-6 w-14 rounded-lg bg-gray-200 dark:bg-gray-700 ml-auto"></div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : patients.length === 0 ? (
            <div className="py-16 text-center px-4">
              <div className="w-12 h-12 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">No patients found</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                {searchQuery
                  ? `No patients match the search query "${searchQuery}".`
                  : 'Start by adding a patient to this clinic.'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-sky-500 text-white rounded-xl text-xs font-semibold hover:bg-sky-600 transition"
                >
                  Add First Patient
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-3.5 px-4 sm:px-6">Patient Name</th>
                    <th className="py-3.5 px-4">Contact Phone</th>
                    <th className="py-3.5 px-4">Patient Notes</th>
                    <th className="py-3.5 px-4">Clinic Tenant</th>
                    <th className="py-3.5 px-4 sm:px-6">Registration Date</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {patients.map((patient) => (
                    <tr key={patient.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 flex items-center justify-center font-bold text-xs shrink-0">
                            {patient.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white text-sm">{patient.full_name}</div>
                            <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">ID: {patient.id.slice(0, 8)}...</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-medium text-xs font-mono">
                        <a
                          href={`tel:${patient.phone}`}
                          className="inline-flex items-center gap-1.5 text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 hover:underline"
                        >
                          <svg className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          {patient.phone}
                        </a>
                      </td>
                      <td className="py-3.5 px-4">
                        {patient.notes ? (
                          <p
                            className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900 rounded-lg px-2 py-1 max-w-[220px] truncate"
                            title={patient.notes}
                          >
                            {patient.notes}
                          </p>
                        ) : (
                          <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-transparent dark:border-slate-700">
                          {clinic?.name || 'Current Clinic'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-slate-500 dark:text-slate-400 text-xs">
                        {new Date(patient.created_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenNotesModal(patient)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-sky-950/40 hover:text-sky-700 dark:hover:text-sky-300 hover:border-sky-200 dark:hover:border-sky-800 transition"
                          title="View or edit patient notes"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          {patient.notes ? 'Edit Note' : 'Add Note'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add Patient Modal */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-xl border border-slate-200 overflow-hidden transform transition-all">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Add New Patient</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Register patient for <strong className="text-slate-700 dark:text-slate-200">{clinic?.name}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleAddPatient} className="p-6 space-y-4">
                {formError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300">
                    {formError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +251 91 123 4567"
                    className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={patientNotes}
                    onChange={(e) => setPatientNotes(e.target.value)}
                    maxLength={500}
                    rows={2}
                    placeholder="e.g. diabetic, prefers Dr. X"
                    className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 bg-white dark:bg-slate-800 resize-none"
                  />
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                    Short free-text note shown to staff during booking.
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 bg-sky-500 text-white rounded-xl text-xs font-semibold hover:bg-sky-600 disabled:opacity-50 transition shadow-xs"
                  >
                    {submitting ? 'Registering...' : 'Register Patient'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Patient Notes Modal */}
        {editingPatient && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Patient Notes</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    <strong className="text-slate-800 dark:text-white">{editingPatient.full_name}</strong> &middot;{' '}
                    <span className="font-mono text-slate-700 dark:text-slate-300">{editingPatient.phone}</span>
                  </p>
                </div>
                <button
                  onClick={() => setEditingPatient(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSaveNotes} className="p-6 space-y-4">
                {notesError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                    {notesError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Notes
                  </label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    maxLength={500}
                    rows={3}
                    autoFocus
                    placeholder="e.g. diabetic, prefers Dr. X"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 bg-white resize-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1 text-right">{editNotes.length}/500</p>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setEditNotes('')}
                    className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
                  >
                    Clear
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingPatient(null)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingNotes}
                      className="px-4 py-2 bg-sky-500 text-white rounded-xl text-xs font-semibold hover:bg-sky-600 disabled:opacity-50 transition shadow-xs"
                    >
                      {savingNotes ? 'Saving...' : 'Save Notes'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
