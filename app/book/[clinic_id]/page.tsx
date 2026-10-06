'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  getPublicClinic,
  getPublicDoctors,
  getPublicDoctorSlots,
  bookPublicAppointmentAction,
  PublicClinic,
  PublicDoctor,
} from '@/app/actions/public-booking';
import { TimeSlot, formatTime } from '@/lib/types';
import { SlotGenerationResult } from '@/lib/slot-generator';

interface PageProps {
  params: Promise<{ clinic_id: string }>;
}

export default function PublicClinicBookingPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const clinicId = resolvedParams.clinic_id;

  // Data
  const [clinic, setClinic] = useState<PublicClinic | null>(null);
  const [doctors, setDoctors] = useState<PublicDoctor[]>([]);
  const [loadingClinic, setLoadingClinic] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Workflow states
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [slotResult, setSlotResult] = useState<SlotGenerationResult | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Patient inputs
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Submit / Confirmation
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<{
    appointment: unknown;
    clinic: PublicClinic;
    doctor: { full_name: string; department: string | null };
    patient: { full_name: string; phone: string };
    dateFormatted: string;
    timeFormatted: string;
  } | null>(null);

  // 1. Load Clinic and Doctors (name & department only)
  useEffect(() => {
    async function loadData() {
      try {
        setLoadingClinic(true);
        setError(null);
        const [cRes, dRes] = await Promise.all([
          getPublicClinic(clinicId),
          getPublicDoctors(clinicId),
        ]);

        if (!cRes.success || !cRes.clinic) {
          setError(cRes.error || 'Clinic not found');
          return;
        }

        setClinic(cRes.clinic);
        setDoctors(dRes.doctors || []);

        if (dRes.doctors && dRes.doctors.length > 0) {
          setSelectedDoctorId(dRes.doctors[0].id);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error loading clinic information');
      } finally {
        setLoadingClinic(false);
      }
    }
    loadData();
  }, [clinicId]);

  // 2. Load Free Slots when Doctor or Date changes
  useEffect(() => {
    if (!selectedDoctorId || !selectedDate || !clinicId) {
      Promise.resolve().then(() => setSlotResult(null));
      return;
    }

    let active = true;
    async function fetchSlots() {
      setLoadingSlots(true);
      setSelectedSlot(null);
      try {
        const res = await getPublicDoctorSlots(clinicId, selectedDoctorId, selectedDate);
        if (active) {
          if (res.success && res.result) {
            setSlotResult(res.result);
          } else {
            setSlotResult(null);
          }
        }
      } catch (err) {
        console.error('Slot loading error:', err);
      } finally {
        if (active) setLoadingSlots(false);
      }
    }

    fetchSlots();
    return () => {
      active = false;
    };
  }, [clinicId, selectedDoctorId, selectedDate]);

  // 3. Confirm Booking
  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError(null);

    if (!selectedDoctorId) {
      setBookingError('Please choose a doctor.');
      return;
    }
    if (!selectedDate || !selectedSlot) {
      setBookingError('Please select a consultation date and an available time slot.');
      return;
    }
    if (!fullName.trim()) {
      setBookingError('Please enter your full name.');
      return;
    }
    if (!phone.trim()) {
      setBookingError('Please enter your contact phone number.');
      return;
    }

    setSubmitting(true);

    const dateFormatted = new Date(selectedDate).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    try {
      const res = await bookPublicAppointmentAction({
        clinicId,
        doctorId: selectedDoctorId,
        startsAt: selectedSlot.startsAtIso,
        endsAt: selectedSlot.endsAtIso,
        fullName: fullName.trim(),
        phone: phone.trim(),
        notes: notes.trim(),
        dateFormatted,
        timeFormatted: selectedSlot.displayLabel,
      });

      if (!res.success || !res.appointment) {
        throw new Error(res.error || 'Failed to complete booking');
      }

      setConfirmedBooking({
        appointment: res.appointment,
        clinic: res.clinic || clinic!,
        doctor: res.doctor!,
        patient: res.patient!,
        dateFormatted,
        timeFormatted: selectedSlot.displayLabel,
      });
    } catch (err: unknown) {
      setBookingError(err instanceof Error ? err.message : 'Error creating appointment');
      // Refresh slots in case a double-booking occurred
      const slotRes = await getPublicDoctorSlots(clinicId, selectedDoctorId, selectedDate);
      if (slotRes.success && slotRes.result) {
        setSlotResult(slotRes.result);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId);

  // If Booking is confirmed, render confirmation receipt screen
  if (confirmedBooking) {
    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 flex flex-col justify-center">
        <div className="max-w-xl mx-auto w-full bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
          {/* Header Banner */}
          <div className="bg-emerald-600 text-white p-6 sm:p-8 text-center space-y-2">
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2 text-white shadow-inner">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-xs uppercase tracking-wider font-bold bg-emerald-700/80 px-3 py-1 rounded-full inline-block">
              Appointment Confirmed
            </span>
            <h2 className="text-2xl font-bold tracking-tight">Booking Successful!</h2>
            <p className="text-emerald-100 text-xs sm:text-sm">
              Your appointment has been reserved in the clinic schedule with status &apos;booked&apos;.
            </p>
          </div>

          {/* Details Card */}
          <div className="p-6 sm:p-8 space-y-5 text-sm text-slate-700">
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4.5 space-y-3">
              <div className="flex justify-between items-center pb-2.5 border-b border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-400 dark:text-slate-400 text-xs font-medium">Clinic</span>
                <span className="font-bold text-slate-900 dark:text-white">{confirmedBooking.clinic.name}</span>
              </div>
              <div className="flex justify-between items-center pb-2.5 border-b border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-400 dark:text-slate-400 text-xs font-medium">Doctor</span>
                <div className="text-right">
                  <span className="font-bold text-slate-900 dark:text-white block">{confirmedBooking.doctor.full_name}</span>
                  <span className="text-xs text-sky-700 dark:text-sky-400 font-medium">{confirmedBooking.doctor.department || 'General'}</span>
                </div>
              </div>
              <div className="flex justify-between items-center pb-2.5 border-b border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-400 dark:text-slate-400 text-xs font-medium">Scheduled Date</span>
                <span className="font-bold text-sky-800 dark:text-sky-300">{confirmedBooking.dateFormatted}</span>
              </div>
              <div className="flex justify-between items-center pb-2.5 border-b border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-400 dark:text-slate-400 text-xs font-medium">Consultation Time</span>
                <span className="font-bold text-sky-800 dark:text-sky-300">{confirmedBooking.timeFormatted}</span>
              </div>
              <div className="flex justify-between items-center pb-2.5 border-b border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-400 dark:text-slate-400 text-xs font-medium">Patient Name</span>
                <span className="font-semibold text-slate-900 dark:text-white">{confirmedBooking.patient.full_name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 dark:text-slate-400 text-xs font-medium">Phone Number</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">{confirmedBooking.patient.phone}</span>
              </div>
            </div>

            {confirmedBooking.clinic.phone && (
              <div className="p-3 bg-sky-50/70 border border-sky-200/70 rounded-xl text-xs text-sky-900 flex items-center justify-between">
                <span>Clinic Contact Phone:</span>
                <a href={`tel:${confirmedBooking.clinic.phone}`} className="font-mono font-bold hover:underline">
                  📞 {confirmedBooking.clinic.phone}
                </a>
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => {
                  setConfirmedBooking(null);
                  setSelectedSlot(null);
                  setNotes('');
                }}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs text-slate-700 dark:text-slate-200 text-center transition"
              >
                + Book Another Appointment
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Top Navbar - Dedicated Clinic Brand */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center text-white font-bold shadow-md shadow-red-500/25 text-base">
              {clinic?.name ? clinic.name.charAt(0).toUpperCase() : '🏥'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  {clinic?.name || 'Clinic Booking'}
                </h1>
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-900 hidden sm:inline-block">
                  Verified Clinic
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {clinic?.phone ? `📞 ${clinic.phone} • ` : ''}Public Patient Scheduling
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {clinic?.phone && (
              <a
                href={`tel:${clinic.phone}`}
                className="text-xs font-semibold text-sky-700 dark:text-sky-300 hover:text-sky-900 dark:hover:text-sky-200 bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100/70 dark:hover:bg-sky-900/60 px-3.5 py-1.5 rounded-xl border border-sky-200/60 dark:border-sky-800 transition"
              >
                📞 <span className="hidden sm:inline">Call Clinic</span>
              </a>
            )}
            <Link
              href="/login"
              className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 transition"
            >
              Staff Portal
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">
        {loadingClinic ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-pulse">
            {/* Left 7 Columns Skeleton */}
            <div className="lg:col-span-7 space-y-6">
              {/* Doctor picker skeleton */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                  <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0"></div>
                        <div className="space-y-1.5 flex-1">
                          <div className="h-3.5 w-28 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                          <div className="h-2.5 w-20 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                        </div>
                      </div>
                      <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Date & Slots skeleton */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                  <div className="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                </div>
                <div className="h-10 w-full rounded-xl bg-gray-200 dark:bg-gray-700"></div>
                <div className="h-3 w-44 bg-gray-200 dark:bg-gray-700 rounded-md mt-4"></div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div key={i} className="h-11 rounded-xl bg-gray-200 dark:bg-gray-700"></div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right 5 Columns Skeleton */}
            <div className="lg:col-span-5">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
                <div className="h-5 w-48 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                <div className="space-y-2.5 pt-2">
                  <div className="h-3.5 w-full bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                  <div className="h-3.5 w-3/4 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                  <div className="h-3.5 w-5/6 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                </div>
                <div className="pt-4 space-y-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="h-10 rounded-xl bg-gray-200 dark:bg-gray-700"></div>
                  <div className="h-10 rounded-xl bg-gray-200 dark:bg-gray-700"></div>
                  <div className="h-11 rounded-xl bg-gray-200 dark:bg-gray-700 mt-4"></div>
                </div>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-900 text-center space-y-3">
            <p className="font-semibold text-sm">{error}</p>
            <p className="text-xs text-red-700 max-w-sm mx-auto">
              Please verify your booking link or contact the clinic reception directly.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-block px-4 py-2 bg-sky-500 text-white rounded-xl text-xs font-semibold hover:bg-sky-600 transition"
            >
              Reload Page
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 Columns: Selection Workflow */}
            <div className="lg:col-span-7 space-y-6">
              {/* STEP 1: PICK DOCTOR (NAME & DEPARTMENT ONLY) */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-sky-500 text-white text-xs font-bold flex items-center justify-center">
                      1
                    </span>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Select Doctor
                    </h2>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {doctors.length} doctors
                  </span>
                </div>

                {doctors.length === 0 ? (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-amber-800 dark:text-amber-300 text-xs border border-amber-200 dark:border-amber-900">
                    No active doctors currently available at this clinic.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {doctors.map((doc) => {
                      const isSelected = doc.id === selectedDoctorId;
                      return (
                        <div
                          key={doc.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedDoctorId(doc.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedDoctorId(doc.id);
                            }
                          }}
                          className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-3 select-none ${
                            isSelected
                              ? 'border-sky-500 bg-sky-50/60 dark:bg-sky-950/50 shadow-xs ring-2 ring-blue-600/20'
                              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/60 dark:hover:bg-slate-800/60 bg-white dark:bg-slate-900'
                          }`}
                        >
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                              isSelected ? 'bg-sky-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            {doc.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                {doc.full_name}
                              </h3>
                              {isSelected && (
                                <span className="text-sky-600 dark:text-sky-400 text-xs font-bold shrink-0">✓</span>
                              )}
                            </div>
                            <p className="text-xs text-sky-700 dark:text-sky-400 font-medium truncate mt-0.5">
                              {doc.department || 'General Medicine'}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* STEP 2: PICK DATE & ONLY FREE TIME SLOTS */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-sky-500 text-white text-xs font-bold flex items-center justify-center">
                      2
                    </span>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Consultation Date & Free Slots
                    </h2>
                  </div>
                  {slotResult?.isWorkDay && (
                    <span className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full font-semibold border border-emerald-200 dark:border-emerald-900">
                      {slotResult.freeSlots.length} Available Slots
                    </span>
                  )}
                </div>

                {/* Date Picker */}
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Select Consultation Date
                  </label>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full sm:w-64 px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 bg-white dark:bg-slate-800"
                  />
                </div>

                {/* Free Slots Grid */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Available Free Consultation Slots
                  </label>

                  {loadingSlots ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 animate-pulse py-1">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-10 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center"
                        >
                          <div className="h-3 w-16 bg-gray-300 dark:bg-gray-600 rounded"></div>
                        </div>
                      ))}
                    </div>
                  ) : !slotResult ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500 py-3">Choose a doctor and date to view time slots.</p>
                  ) : !slotResult.isWorkDay ? (
                    <div className="p-4 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-900 dark:text-amber-300 flex items-start gap-2.5">
                      <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div>
                        <p className="font-bold text-amber-950 dark:text-amber-200">{slotResult.reason}</p>
                        <p className="mt-0.5 text-amber-800 dark:text-amber-300">Please choose a different date.</p>
                      </div>
                    </div>
                  ) : slotResult.freeSlots.length === 0 ? (
                    <div className="p-5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-center text-xs text-slate-600 dark:text-slate-300">
                      All consultation slots for {selectedDoctor?.full_name} on this date are booked. Please select another date.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {slotResult.freeSlots.map((slot) => {
                        const isChosen = selectedSlot?.startsAtIso === slot.startsAtIso;
                        return (
                          <button
                            key={slot.startsAtIso}
                            type="button"
                            onClick={() => setSelectedSlot(slot)}
                            className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition text-center ${
                              isChosen
                                ? 'bg-sky-500 text-white border-sky-500 shadow-xs ring-2 ring-blue-600/20'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-sky-400 hover:bg-sky-50/40 dark:hover:bg-slate-700/60'
                            }`}
                          >
                            <span className="block font-bold">{formatTime(slot.startTime)}</span>
                            <span className="text-[10px] opacity-80 block font-normal">to {formatTime(slot.endTime)}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* STEP 3: PATIENT CONTACT INFORMATION */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-sky-500 text-white text-xs font-bold flex items-center justify-center">
                    3
                  </span>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Patient Information
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Patient Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Almaz Ayana"
                      className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-sky-500 bg-white dark:bg-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. +251911223344"
                      className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-sky-500 bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Reason for Consultation / Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Health checkup, recurring fever"
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-sky-500 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Right 5 Columns: Summary & Confirmation Card */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm sticky top-24">
                <div className="flex items-center gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-sky-500 text-white flex items-center justify-center font-bold">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">Booking Summary</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Confirm your reservation</p>
                  </div>
                </div>

                {bookingError && (
                  <div className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-400 flex items-start gap-2">
                    <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{bookingError}</span>
                  </div>
                )}

                <div className="py-4 space-y-3 text-xs text-slate-700 dark:text-slate-300">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 dark:text-slate-400 font-medium">Clinic</span>
                    <span className="font-bold text-slate-900 dark:text-white">{clinic?.name}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 dark:text-slate-400 font-medium">Doctor</span>
                    <span className="font-bold text-slate-900 dark:text-white">{selectedDoctor?.full_name || 'None'}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 dark:text-slate-400 font-medium">Specialty</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{selectedDoctor?.department || 'General'}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 dark:text-slate-400 font-medium">Date</span>
                    <span className="font-bold text-sky-800 dark:text-sky-300">
                      {selectedDate
                        ? new Date(selectedDate).toLocaleDateString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : '--'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 dark:text-slate-400 font-medium">Time Slot</span>
                    <span className="font-bold text-sky-800 dark:text-sky-300">{selectedSlot?.displayLabel || 'No slot selected'}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 dark:text-slate-400 font-medium">Patient</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{fullName || '—'}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-400 dark:text-slate-400 font-medium">Contact Phone</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">{phone || '—'}</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleConfirmBooking}
                    disabled={
                      submitting ||
                      !selectedDoctorId ||
                      !selectedSlot ||
                      !fullName.trim() ||
                      !phone.trim()
                    }
                    className="w-full py-3 px-4 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm shadow-xs transition flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Reserving Slot...
                      </>
                    ) : (
                      'Confirm Booking'
                    )}
                  </button>
                  <p className="text-[11px] text-center text-slate-400 mt-2">
                    Instant confirmation • Safe and confidential
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
