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
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard data');
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
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-teal-700 to-teal-900 rounded-2xl p-6 sm:p-8 text-white shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-500/30 text-teal-100 border border-teal-400/20">
                Staff Dashboard
              </span>
              <span className="text-xs text-teal-200">
                Clinic: <strong className="text-white">{clinic?.name || 'Clinic'}</strong>
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold mt-2 tracking-tight">
              {clinic?.name ? `${clinic.name}` : `Hello, ${staff?.full_name || 'Staff Member'}!`}
            </h2>
            <p className="mt-1 text-sm text-teal-100/90 max-w-xl">
              Welcome back, {staff?.full_name || 'Staff'}. Manage doctors, consultation slots, patient profiles, and records for {clinic?.name || 'your clinic'}.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Link
              href="/booking"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-teal-900 text-sm font-semibold hover:bg-teal-50 shadow-sm transition"
            >
              <svg className="w-4 h-4 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Book Appointment
            </Link>
            <Link
              href="/doctors"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-800 text-white border border-teal-600/60 text-sm font-semibold hover:bg-teal-700/80 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Doctor
            </Link>
            <Link
              href="/patients"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-800 text-white border border-teal-600/60 text-sm font-semibold hover:bg-teal-700/80 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Patient
            </Link>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Doctors
              </span>
              <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-900">{doctors.length}</span>
              <span className="text-xs text-emerald-600 font-medium">
                {activeDoctorsCount} active
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Assigned to {clinic?.name || 'this clinic'}
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Patients
              </span>
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-900">{patients.length}</span>
              <span className="text-xs text-blue-600 font-medium">Registered</span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Filtered by clinic records
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Clinic Phone
              </span>
              <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
            </div>
            <div className="mt-3">
              <span className="text-lg font-bold text-slate-900 truncate block">
                {clinic?.phone || 'Not set'}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Primary contact line
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Clinic Timezone
              </span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-3">
              <span className="text-base font-bold text-slate-900 truncate block">
                {clinic?.timezone || 'UTC'}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Schedule synchronization zone
            </p>
          </div>
        </div>

        {/* Two-column preview: Recent Doctors & Recent Patients */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Doctors Preview */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Doctors Overview</h3>
                <p className="text-xs text-slate-500">Active medical personnel & schedules</p>
              </div>
              <Link
                href="/doctors"
                className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
              >
                View all ({doctors.length})
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            {loading ? (
              <div className="py-8 text-center text-slate-400 text-sm">Loading doctors...</div>
            ) : doctors.length === 0 ? (
              <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-sm font-medium text-slate-600">No doctors registered yet</p>
                <p className="text-xs text-slate-400 mt-1">Get started by adding your first doctor</p>
                <Link
                  href="/doctors"
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 transition"
                >
                  Add Doctor
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {doctors.slice(0, 4).map((doc) => (
                  <div key={doc.id} className="py-3 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800">{doc.full_name}</h4>
                      <p className="text-xs text-slate-500">
                        {doc.department || 'General Medicine'} • {doc.slot_minutes} min slots
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {formatWorkDays(doc.work_days)} ({formatTime(doc.start_time)} - {formatTime(doc.end_time)})
                      </p>
                    </div>
                    <div>
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          doc.active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500'
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
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Patients Directory</h3>
                <p className="text-xs text-slate-500">Registered patients for this clinic</p>
              </div>
              <Link
                href="/patients"
                className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
              >
                View all ({patients.length})
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            {loading ? (
              <div className="py-8 text-center text-slate-400 text-sm">Loading patients...</div>
            ) : patients.length === 0 ? (
              <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-sm font-medium text-slate-600">No patients registered yet</p>
                <p className="text-xs text-slate-400 mt-1">Register new patients to schedule visits</p>
                <Link
                  href="/patients"
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 transition"
                >
                  Add Patient
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {patients.slice(0, 4).map((patient) => (
                  <div key={patient.id} className="py-3 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800">{patient.full_name}</h4>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {patient.phone}
                      </p>
                    </div>
                    <div className="text-right">
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
