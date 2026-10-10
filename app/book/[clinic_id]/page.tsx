'use client';

import React, { useState, useEffect, use } from 'react';
import {
  getPublicClinic,
  getPublicCombinedSlots,
  bookPublicAppointmentAction,
  PublicClinic,
  PublicCombinedSlot,
} from '@/app/actions/public-booking';
import { formatTime } from '@/lib/types';
import { useTheme } from '@/components/theme-provider';
import { ImakoCredit } from '@/components/imako-credit';

interface PageProps {
  params: Promise<{ clinic_id: string }>;
}

export default function PublicClinicBookingPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const clinicId = resolvedParams.clinic_id;

  const { theme, toggleTheme } = useTheme();

  // Data states
  const [clinic, setClinic] = useState<PublicClinic | null>(null);
  const [loadingClinic, setLoadingClinic] = useState(true);
  const [clinicError, setClinicError] = useState<string | null>(null);

  // 3-Step Flow: 1 = Pick Date, 2 = Pick Time, 3 = Enter Name & Phone
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step 1: Selected Date (YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Step 2: Time Slots
  const [slots, setSlots] = useState<PublicCombinedSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<PublicCombinedSlot | null>(null);
  const [isWorkDay, setIsWorkDay] = useState(true);
  const [closedReason, setClosedReason] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Step 3: Patient Details
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Submission & Conflict Handling
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<{
    clinic: PublicClinic;
    dateFormatted: string;
    timeFormatted: string;
    patient: { full_name: string; phone: string };
  } | null>(null);

  // 1. Fetch clinic details & update browser tab title
  useEffect(() => {
    let active = true;
    async function loadClinic() {
      try {
        setLoadingClinic(true);
        setClinicError(null);
        const res = await getPublicClinic(clinicId);
        if (!active) return;

        if (!res.success || !res.clinic) {
          setClinic(null);
          setClinicError(res.error || 'Clinic not found');
          document.title = 'Clinic Not Found';
        } else {
          setClinic(res.clinic);
          document.title = `Book an appointment – ${res.clinic.name}`;
        }
      } catch (err: unknown) {
        if (!active) return;
        setClinic(null);
        setClinicError(err instanceof Error ? err.message : 'Error loading clinic');
        document.title = 'Clinic Not Found';
      } finally {
        if (active) setLoadingClinic(false);
      }
    }

    loadClinic();
    return () => {
      active = false;
    };
  }, [clinicId]);

  // 2. Fetch combined time slots when date changes or clinic is loaded
  useEffect(() => {
    if (!clinicId || !selectedDate) return;

    let active = true;
    async function fetchSlots() {
      setLoadingSlots(true);
      setSelectedSlot(null);
      setBookingError(null);

      try {
        const res = await getPublicCombinedSlots(clinicId, selectedDate);
        if (!active) return;

        if (res.success) {
          setIsWorkDay(res.isWorkDay);
          setClosedReason(res.reason || null);
          setSlots(res.slots || []);
        } else {
          setIsWorkDay(false);
          setClosedReason(res.error || 'Unable to load slots for this day.');
          setSlots([]);
        }
      } catch (err: unknown) {
        if (!active) return;
        setIsWorkDay(false);
        setClosedReason(err instanceof Error ? err.message : 'Error loading time slots');
        setSlots([]);
      } finally {
        if (active) setLoadingSlots(false);
      }
    }

    fetchSlots();
    return () => {
      active = false;
    };
  }, [clinicId, selectedDate]);

  // Helper to refresh slots if conflict occurs
  const refreshSlots = async () => {
    if (!clinicId || !selectedDate) return;
    setLoadingSlots(true);
    try {
      const res = await getPublicCombinedSlots(clinicId, selectedDate);
      if (res.success) {
        setIsWorkDay(res.isWorkDay);
        setClosedReason(res.reason || null);
        setSlots(res.slots || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingSlots(false);
    }
  };

  // 3. Confirm Booking Handler
  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError(null);

    if (!selectedSlot) {
      setBookingError('Please choose a consultation time.');
      setCurrentStep(2);
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

    const [year, month, day] = selectedDate.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dateFormatted = dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    try {
      const res = await bookPublicAppointmentAction({
        clinicId,
        startsAt: selectedSlot.startsAtIso,
        endsAt: selectedSlot.endsAtIso,
        fullName: fullName.trim(),
        phone: phone.trim(),
        notes: notes.trim() || undefined,
        dateFormatted,
        timeFormatted: selectedSlot.displayLabel,
      });

      if (!res.success) {
        // Double-booking check: If slot was taken right before insertion
        if (
          res.error?.includes('That time was just booked') ||
          res.error?.includes('already booked') ||
          res.error?.includes('no longer available')
        ) {
          setBookingError('That time was just booked, please pick another.');
          setSelectedSlot(null);
          await refreshSlots();
          setCurrentStep(2); // Redirect back to time picker
          return;
        }
        throw new Error(res.error || 'Failed to complete booking. Please try again.');
      }

      // Success
      setConfirmedBooking({
        clinic: res.clinic || clinic!,
        dateFormatted,
        timeFormatted: selectedSlot.displayLabel,
        patient: {
          full_name: fullName.trim(),
          phone: phone.trim(),
        },
      });
    } catch (err: unknown) {
      setBookingError(err instanceof Error ? err.message : 'Error securing appointment');
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Date Generator: today + next 6 days
  const todayDateObj = new Date();
  const quickDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(todayDateObj.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const isoDate = `${yyyy}-${mm}-${dd}`;
    const dayName = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' });
    const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return { isoDate, dayName, monthDay };
  });

  // ─────────────────────────────────────────────────────────────
  // 1. "Clinic Not Found" View
  // ─────────────────────────────────────────────────────────────
  if (!loadingClinic && (clinicError || !clinic)) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between p-4 sm:p-6 transition-colors duration-200">
        <div className="flex justify-end max-w-lg mx-auto w-full pt-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 transition"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>

        <div className="max-w-md w-full mx-auto my-auto py-10 px-6 sm:px-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-3xl bg-red-50 dark:bg-red-950/40 text-red-500 dark:text-red-400 flex items-center justify-center text-3xl sm:text-4xl shadow-inner mb-5">
            🏥
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Clinic Not Found
          </h1>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            The booking link you followed doesn&apos;t seem to match any active clinic in our system. Please check the URL or contact your healthcare provider for the direct booking link.
          </p>
          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-3 px-4 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-sm shadow-sm transition"
            >
              Try Again
            </button>
          </div>
        </div>

        <div className="py-6 text-center">
          <ImakoCredit />
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. Booking Confirmed View (Receipt Screen)
  // ─────────────────────────────────────────────────────────────
  if (confirmedBooking) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between p-4 sm:p-6 transition-colors duration-200">
        <header className="max-w-xl mx-auto w-full pt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-500 text-white flex items-center justify-center font-bold text-sm shadow-md">
              ✓
            </div>
            <span className="text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider">
              {confirmedBooking.clinic.name}
            </span>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 transition"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </header>

        <main className="max-w-xl w-full mx-auto my-auto py-6 sm:py-8">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl overflow-hidden">
            {/* Success Top Banner */}
            <div className="bg-gradient-to-br from-teal-500 via-teal-600 to-sky-600 text-white p-6 sm:p-8 text-center space-y-2">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-xs rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-xs uppercase tracking-wider font-extrabold bg-white/20 px-3 py-1 rounded-full inline-block">
                Confirmed Appointment
              </span>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">You&apos;re All Set!</h2>
              <p className="text-teal-100 text-xs sm:text-sm max-w-sm mx-auto leading-relaxed">
                Your consultation has been reserved at <span className="font-semibold text-white">{confirmedBooking.clinic.name}</span>.
              </p>
            </div>

            {/* Receipt Details */}
            <div className="p-6 sm:p-8 space-y-6">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 sm:p-5 border border-slate-200/70 dark:border-slate-800 space-y-3.5 text-sm">
                <div className="flex justify-between items-center pb-3 border-b border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Clinic</span>
                  <span className="font-bold text-slate-900 dark:text-white">{confirmedBooking.clinic.name}</span>
                </div>

                <div className="flex justify-between items-center pb-3 border-b border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Date</span>
                  <span className="font-bold text-teal-700 dark:text-teal-300">{confirmedBooking.dateFormatted}</span>
                </div>

                <div className="flex justify-between items-center pb-3 border-b border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Consultation Time</span>
                  <span className="font-bold text-sky-700 dark:text-sky-300">{confirmedBooking.timeFormatted}</span>
                </div>

                <div className="flex justify-between items-center pb-3 border-b border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Patient</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{confirmedBooking.patient.full_name}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Phone Number</span>
                  <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{confirmedBooking.patient.phone}</span>
                </div>
              </div>

              {/* Clinic Phone & Notice */}
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900 text-xs text-sky-900 dark:text-sky-200 flex items-start gap-3">
                  <span className="text-lg">💬</span>
                  <div className="leading-relaxed">
                    <p className="font-bold text-sky-950 dark:text-sky-100">SMS Confirmation Sent</p>
                    <p className="mt-0.5 text-sky-800 dark:text-sky-300">
                      We have dispatched an SMS confirmation to <strong className="font-mono">{confirmedBooking.patient.phone}</strong>. Please arrive 10 minutes prior to your slot.
                    </p>
                  </div>
                </div>

                {confirmedBooking.clinic.phone && (
                  <div className="p-3.5 rounded-2xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900 text-xs flex items-center justify-between">
                    <span className="text-teal-900 dark:text-teal-200 font-medium">Questions or changes?</span>
                    <a
                      href={`tel:${confirmedBooking.clinic.phone}`}
                      className="font-bold font-mono text-teal-700 dark:text-teal-300 hover:underline flex items-center gap-1"
                    >
                      📞 {confirmedBooking.clinic.phone}
                    </a>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmedBooking(null);
                    setSelectedSlot(null);
                    setNotes('');
                    setCurrentStep(1);
                  }}
                  className="w-full py-3.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-sm text-center transition"
                >
                  + Book Another Appointment
                </button>
              </div>
            </div>
          </div>
        </main>

        <footer className="py-6 text-center">
          <ImakoCredit />
        </footer>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 3. Main 3-Step Public Booking Page
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between transition-colors duration-200">
      {/* Top Clinic Header (Prominent clinic name + phone, theme toggle, NO staff portal link) */}
      <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between gap-3">
          {loadingClinic ? (
            <div className="flex items-center gap-3 animate-pulse">
              <div className="w-10 h-10 rounded-2xl bg-gray-200 dark:bg-gray-700" />
              <div className="space-y-1.5">
                <div className="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-teal-500 text-white font-black text-lg flex items-center justify-center shadow-md shadow-sky-500/20 shrink-0">
                {clinic?.name?.charAt(0).toUpperCase() || '🏥'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white truncate">
                    {clinic?.name || 'Clinic'}
                  </h1>
                </div>
                {clinic?.phone ? (
                  <a
                    href={`tel:${clinic.phone}`}
                    className="text-xs text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 font-mono font-medium truncate"
                  >
                    <span>📞 {clinic.phone}</span>
                  </a>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">Online Appointment Booking</p>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 shrink-0">
            {clinic?.phone && (
              <a
                href={`tel:${clinic.phone}`}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200/70 dark:border-teal-900 hover:bg-teal-100 transition"
              >
                Call Clinic
              </a>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              {theme === 'dark' ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5" />
                  <path strokeLinecap="round" d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Flow Container */}
      <main className="max-w-2xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1">
        {loadingClinic ? (
          /* Initial Full Skeleton */
          <div className="space-y-6 animate-pulse">
            <div className="h-14 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg" />
              <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded-xl" />
              <div className="grid grid-cols-3 gap-2 pt-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded-xl" />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Progress Bar / Step Indicator */}
            <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="grid grid-cols-3 gap-2 text-center select-none">
                {/* Step 1 */}
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-1 sm:px-3 rounded-xl transition ${
                    currentStep === 1
                      ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-bold border border-sky-200/80 dark:border-sky-900'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold ${
                      currentStep > 1
                        ? 'bg-teal-500 text-white'
                        : currentStep === 1
                        ? 'bg-sky-500 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {currentStep > 1 ? '✓' : '1'}
                  </span>
                  <span className="text-xs">Pick Date</span>
                </button>

                {/* Step 2 */}
                <button
                  type="button"
                  onClick={() => {
                    if (selectedDate) setCurrentStep(2);
                  }}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-1 sm:px-3 rounded-xl transition ${
                    currentStep === 2
                      ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-bold border border-sky-200/80 dark:border-sky-900'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold ${
                      currentStep > 2
                        ? 'bg-teal-500 text-white'
                        : currentStep === 2
                        ? 'bg-sky-500 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {currentStep > 2 ? '✓' : '2'}
                  </span>
                  <span className="text-xs">Pick Time</span>
                </button>

                {/* Step 3 */}
                <button
                  type="button"
                  onClick={() => {
                    if (selectedSlot) setCurrentStep(3);
                  }}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-1 sm:px-3 rounded-xl transition ${
                    currentStep === 3
                      ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-bold border border-sky-200/80 dark:border-sky-900'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold ${
                      currentStep === 3
                        ? 'bg-sky-500 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    3
                  </span>
                  <span className="text-xs">Enter Details</span>
                </button>
              </div>
            </div>

            {/* Error Banner */}
            {bookingError && (
              <div
                role="alert"
                className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-300 text-xs sm:text-sm flex items-start gap-3 shadow-xs animate-shake"
              >
                <span className="text-lg leading-none">⚠️</span>
                <div className="flex-1">
                  <p className="font-bold">{bookingError}</p>
                  {bookingError.includes('That time was just booked') && (
                    <p className="mt-0.5 text-xs text-red-700 dark:text-red-400">
                      We refreshed the time slots below. Please select an available slot.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── STEP 1: PICK A DATE ──────────────────────────────── */}
            {currentStep === 1 && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-7 shadow-sm space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/50 px-2.5 py-0.5 rounded-full border border-sky-200/70 dark:border-sky-900">
                      Step 1 of 3
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    Choose a Date
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Select the day you would like to visit <strong className="text-slate-700 dark:text-slate-300">{clinic?.name}</strong>.
                  </p>
                </div>

                {/* Quick 7-Day Tap Pills */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Upcoming Days
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
                    {quickDates.map((item) => {
                      const isSelected = selectedDate === item.isoDate;
                      return (
                        <button
                          key={item.isoDate}
                          type="button"
                          onClick={() => {
                            setSelectedDate(item.isoDate);
                            setSelectedSlot(null);
                          }}
                          className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1 active:scale-95 ${
                            isSelected
                              ? 'bg-sky-500 text-white border-sky-500 shadow-md shadow-sky-500/25 ring-2 ring-sky-500/30'
                              : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 hover:border-sky-300 text-slate-700 dark:text-slate-300 hover:bg-sky-50/50'
                          }`}
                        >
                          <span className={`text-[11px] font-semibold uppercase ${isSelected ? 'text-sky-100' : 'text-slate-400 dark:text-slate-500'}`}>
                            {item.dayName}
                          </span>
                          <span className="text-sm font-black leading-tight">
                            {item.monthDay.split(' ')[1]}
                          </span>
                          <span className={`text-[10px] ${isSelected ? 'text-sky-100' : 'text-slate-400 dark:text-slate-500'}`}>
                            {item.monthDay.split(' ')[0]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Or Pick Any Other Date */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <label htmlFor="custom-date" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Or Pick Any Other Date
                  </label>
                  <input
                    id="custom-date"
                    type="date"
                    min={todayDateObj.toISOString().split('T')[0]}
                    value={selectedDate}
                    onChange={(e) => {
                      if (e.target.value) {
                        setSelectedDate(e.target.value);
                        setSelectedSlot(null);
                      }
                    }}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                  />
                </div>

                {/* Continue to Step 2 */}
                <div className="pt-4">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="w-full py-3.5 px-5 bg-sky-500 hover:bg-sky-600 active:scale-[0.99] text-white font-bold rounded-2xl text-sm shadow-md shadow-sky-500/25 transition flex items-center justify-center gap-2"
                  >
                    <span>View Available Times</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 2: PICK A TIME ──────────────────────────────── */}
            {currentStep === 2 && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-7 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 px-2.5 py-0.5 rounded-full border border-teal-200/70 dark:border-teal-900">
                        Step 2 of 3
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                      Pick a Time
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Showing free slots for{' '}
                      <strong className="text-slate-800 dark:text-slate-200">
                        {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </strong>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline self-start sm:self-center"
                  >
                    ← Change Date
                  </button>
                </div>

                {/* Slot Generator Output */}
                <div>
                  {loadingSlots ? (
                    /* Skeletons instead of spinners */
                    <div className="space-y-3">
                      <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                          <div
                            key={i}
                            className="h-14 rounded-2xl bg-gray-200 dark:bg-gray-700 animate-pulse"
                          />
                        ))}
                      </div>
                    </div>
                  ) : !isWorkDay ? (
                    <div className="p-6 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-center space-y-3">
                      <div className="text-3xl">🗓️</div>
                      <h3 className="text-sm font-bold text-amber-950 dark:text-amber-200">
                        {closedReason || 'The clinic is closed on this day.'}
                      </h3>
                      <p className="text-xs text-amber-800 dark:text-amber-300 max-w-sm mx-auto">
                        No doctors are available for appointments on this date. Please pick another date.
                      </p>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(1)}
                        className="inline-block px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition"
                      >
                        Choose Another Date
                      </button>
                    </div>
                  ) : slots.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center space-y-3">
                      <div className="text-3xl">⏰</div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        All time slots are booked for this date
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                        Every consultation window is currently reserved. Please choose another date to view free times.
                      </p>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(1)}
                        className="inline-block px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold transition"
                      >
                        Choose Another Date
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                          Available Times
                        </span>
                        <span className="text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 px-2.5 py-0.5 rounded-full border border-teal-200 dark:border-teal-900">
                          {slots.length} Slots Free
                        </span>
                      </div>

                      {/* Tap-Friendly Slot Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                        {slots.map((slot) => {
                          const isSelected = selectedSlot?.startsAtIso === slot.startsAtIso;
                          return (
                            <button
                              key={slot.startsAtIso}
                              type="button"
                              onClick={() => {
                                setSelectedSlot(slot);
                                setBookingError(null);
                              }}
                              className={`py-3.5 px-3 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-0.5 active:scale-95 ${
                                isSelected
                                  ? 'bg-sky-500 text-white border-sky-500 shadow-md shadow-sky-500/25 ring-2 ring-sky-500/30'
                                  : 'bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700/80 hover:border-sky-400 dark:hover:border-sky-500 text-slate-800 dark:text-slate-200 hover:bg-sky-50/40 dark:hover:bg-slate-800'
                              }`}
                            >
                              <span className="text-sm font-black leading-tight">
                                {formatTime(slot.startTime)}
                              </span>
                              <span
                                className={`text-[11px] ${
                                  isSelected ? 'text-sky-100' : 'text-slate-400 dark:text-slate-500'
                                }`}
                              >
                                to {formatTime(slot.endTime)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Navigation Buttons */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="py-3 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    disabled={!selectedSlot}
                    onClick={() => setCurrentStep(3)}
                    className="flex-1 py-3.5 px-5 bg-sky-500 hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-2xl text-sm shadow-md shadow-sky-500/25 transition flex items-center justify-center gap-2"
                  >
                    <span>Continue to Details</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 3: ENTER NAME AND PHONE ─────────────────────── */}
            {currentStep === 3 && (
              <form onSubmit={handleConfirmBooking} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-7 shadow-sm space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 px-2.5 py-0.5 rounded-full border border-teal-200/70 dark:border-teal-900">
                      Step 3 of 3
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    Enter Your Details
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Provide your contact info so we can confirm your appointment and send you an SMS.
                  </p>
                </div>

                {/* Summary Pill */}
                <div className="p-4 rounded-2xl bg-sky-50/70 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block font-medium">Selected Slot:</span>
                    <strong className="text-sky-900 dark:text-sky-200 text-sm">
                      {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      at {selectedSlot?.displayLabel}
                    </strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline self-start sm:self-center"
                  >
                    Change Slot
                  </button>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                  <div>
                    <label htmlFor="patient-name" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Full Name *
                    </label>
                    <input
                      id="patient-name"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Almaz Ayana"
                      className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                    />
                  </div>

                  <div>
                    <label htmlFor="patient-phone" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Phone Number *
                    </label>
                    <input
                      id="patient-phone"
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 0911223344 or +251911223344"
                      className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium font-mono text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                    />
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                      A booking confirmation and reminders will be sent to this number.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="patient-notes" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Reason for Consultation / Notes (Optional)
                    </label>
                    <input
                      id="patient-notes"
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. General checkup, eye check, dental"
                      className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                    />
                  </div>
                </div>

                {/* Submit Actions */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    disabled={submitting}
                    className="py-3 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                  >
                    ← Back
                  </button>

                  <button
                    type="submit"
                    disabled={submitting || !fullName.trim() || !phone.trim() || !selectedSlot}
                    className="flex-1 py-3.5 px-5 bg-sky-500 hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99] text-white font-bold rounded-2xl text-sm shadow-md shadow-sky-500/25 transition flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                        <span>Securing Slot...</span>
                      </span>
                    ) : (
                      <span>Confirm Appointment</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </main>

      {/* Muted Footer with Imako Solution Credit */}
      <footer className="py-6 px-4 text-center border-t border-slate-200/60 dark:border-slate-900 mt-8">
        <ImakoCredit />
      </footer>
    </div>
  );
}
