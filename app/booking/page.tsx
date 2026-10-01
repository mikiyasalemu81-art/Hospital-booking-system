'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { useAuth } from '@/components/auth-provider';
import { Doctor, Patient, Appointment, TimeSlot, formatTime, formatWorkDays } from '@/lib/types';
import { generateDoctorSlots, SlotGenerationResult } from '@/lib/slot-generator';
import { bookAppointmentAction, cancelAppointmentAction, rescheduleAppointmentAction } from '@/app/actions/booking';

export default function BookingPage() {
  const { clinic, staff } = useAuth();

  // Database records
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  // Loading states
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [searchingPatients, setSearchingPatients] = useState(false);

  // Booking Form State
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [slotCalculation, setSlotCalculation] = useState<SlotGenerationResult | null>(null);

  // Patient Selection (Existing vs Add New Inline)
  const [patientMode, setPatientMode] = useState<'existing' | 'new'>('existing');
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientPhone, setNewPatientPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Submission & Alerts
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [successAlert, setSuccessAlert] = useState<{ title: string; message: string } | null>(null);
  const [errorAlert, setErrorAlert] = useState<string | null>(null);

  // Cancel Confirmation Modal State
  const [cancellingAppt, setCancellingAppt] = useState<Appointment | null>(null);
  const [cancellingLoading, setCancellingLoading] = useState(false);

  // Reschedule Modal State
  const [reschedulingAppt, setReschedulingAppt] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleSlot, setRescheduleSlot] = useState<TimeSlot | null>(null);
  const [rescheduleSlotResult, setRescheduleSlotResult] = useState<SlotGenerationResult | null>(null);
  const [loadingRescheduleSlots, setLoadingRescheduleSlots] = useState(false);
  const [submittingReschedule, setSubmittingReschedule] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // Appointments List Filters
  const [apptViewFilter, setApptViewFilter] = useState<'upcoming' | 'all' | 'cancelled'>('upcoming');
  const [apptSearchQuery, setApptSearchQuery] = useState('');

  // 1. Fetch Doctors and Initial Patients
  const fetchDoctorsAndPatients = useCallback(async () => {
    try {
      setLoadingDoctors(true);
      const [docsRes, patientsRes] = await Promise.all([
        fetch('/api/doctors'),
        fetch('/api/patients'),
      ]);

      if (docsRes.ok) {
        const dData = await docsRes.json();
        const activeDocs = (dData.doctors || []).filter((d: Doctor) => d.active);
        setDoctors(activeDocs);
        if (activeDocs.length > 0 && !selectedDoctorId) {
          setSelectedDoctorId(activeDocs[0].id);
        }
      }

      if (patientsRes.ok) {
        const pData = await patientsRes.json();
        setPatients(pData.patients || []);
      }
    } catch (err: any) {
      setErrorAlert(err.message || 'Error loading clinic resources');
    } finally {
      setLoadingDoctors(false);
    }
  }, [selectedDoctorId]);

  // 2. Fetch Appointments for the Clinic
  const fetchAppointments = useCallback(async () => {
    try {
      setLoadingAppointments(true);
      const res = await fetch('/api/appointments');
      if (res.ok) {
        const data = await res.json();
        setAppointments(data.appointments || []);
      }
    } catch (err: any) {
      console.error('Error fetching appointments:', err);
    } finally {
      setLoadingAppointments(false);
    }
  }, []);

  useEffect(() => {
    fetchDoctorsAndPatients();
    fetchAppointments();
  }, [fetchDoctorsAndPatients, fetchAppointments]);

  // 3. Search Existing Patients (debounced)
  useEffect(() => {
    if (patientMode !== 'existing') return;
    if (!patientSearch.trim()) {
      fetch('/api/patients')
        .then((res) => res.json())
        .then((data) => setPatients(data.patients || []))
        .catch(console.error);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearchingPatients(true);
        const res = await fetch(`/api/patients?q=${encodeURIComponent(patientSearch.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setPatients(data.patients || []);
        }
      } catch (err) {
        console.error('Patient search error:', err);
      } finally {
        setSearchingPatients(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [patientSearch, patientMode]);

  // 4. Calculate Free Time Slots for Selected Doctor and Date
  // Excludes slots that already have a 'booked' appointment for that doctor on that date
  const calculateSlots = useCallback(async () => {
    if (!selectedDoctorId || !selectedDate) {
      setSlotCalculation(null);
      return;
    }

    const doctor = doctors.find((d) => d.id === selectedDoctorId);
    if (!doctor) {
      setSlotCalculation(null);
      return;
    }

    setLoadingSlots(true);
    setSelectedSlot(null);

    try {
      // Query booked appointments for this doctor on this date
      const res = await fetch(`/api/appointments?doctor_id=${selectedDoctorId}&date=${selectedDate}&status=booked`);
      const data = await res.json();
      const booked = data.appointments || [];

      // Generate slots using doctor's work_days, start_time, end_time, slot_minutes
      // excluding slots with a 'booked' appointment
      const result = generateDoctorSlots(doctor, selectedDate, booked);
      setSlotCalculation(result);
    } catch (err) {
      console.error('Failed to calculate time slots:', err);
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedDoctorId, selectedDate, doctors]);

  useEffect(() => {
    calculateSlots();
  }, [calculateSlots]);

  // 5. Calculate Slots for Reschedule Modal
  useEffect(() => {
    if (!reschedulingAppt || !rescheduleDate) {
      setRescheduleSlotResult(null);
      return;
    }

    const doctor = doctors.find((d) => d.id === reschedulingAppt.doctor_id);
    if (!doctor) return;

    setLoadingRescheduleSlots(true);
    setRescheduleSlot(null);

    fetch(`/api/appointments?doctor_id=${doctor.id}&date=${rescheduleDate}&status=booked`)
      .then((res) => res.json())
      .then((data) => {
        const booked = data.appointments || [];
        // Exclude the appointment being rescheduled so its current slot doesn't conflict
        const result = generateDoctorSlots(doctor, rescheduleDate, booked, reschedulingAppt.id);
        setRescheduleSlotResult(result);
      })
      .catch(console.error)
      .finally(() => {
        setLoadingRescheduleSlots(false);
      });
  }, [reschedulingAppt, rescheduleDate, doctors]);

  // 6. Confirm Appointment Booking
  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorAlert(null);

    if (!selectedDoctorId) {
      setErrorAlert('Please select a doctor.');
      return;
    }
    if (!selectedDate) {
      setErrorAlert('Please select a consultation date.');
      return;
    }
    if (!selectedSlot) {
      setErrorAlert('Please select an available consultation time slot.');
      return;
    }
    if (patientMode === 'existing' && !selectedPatient) {
      setErrorAlert('Please select an existing patient, or switch to "+ Add New Inline".');
      return;
    }
    if (patientMode === 'new') {
      if (!newPatientName.trim()) {
        setErrorAlert('Please provide the new patient full name.');
        return;
      }
      if (!newPatientPhone.trim()) {
        setErrorAlert('Please provide the new patient phone number.');
        return;
      }
    }

    setSubmittingBooking(true);

    const doctor = doctors.find((d) => d.id === selectedDoctorId);
    const dateFormatted = new Date(selectedDate).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    try {
      const res = await bookAppointmentAction({
        doctorId: selectedDoctorId,
        patientId: patientMode === 'existing' ? selectedPatient?.id : undefined,
        newPatient:
          patientMode === 'new'
            ? { full_name: newPatientName.trim(), phone: newPatientPhone.trim() }
            : undefined,
        startsAt: selectedSlot.startsAtIso,
        endsAt: selectedSlot.endsAtIso,
        appointmentDateFormatted: dateFormatted,
        appointmentTimeFormatted: selectedSlot.displayLabel,
        notes: notes.trim(),
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to book appointment');
      }

      setSuccessAlert({
        title: 'Appointment Booked!',
        message: `Booked with Dr. ${doctor?.full_name} for ${dateFormatted} at ${selectedSlot.displayLabel} (status: 'booked').`,
      });

      // Clear form selections
      setSelectedSlot(null);
      setNotes('');
      if (patientMode === 'new') {
        setNewPatientName('');
        setNewPatientPhone('');
      }

      // Immediately refresh appointments list and free slots
      await fetchAppointments();
      await fetchDoctorsAndPatients();
      await calculateSlots();
    } catch (err: any) {
      setErrorAlert(err.message || 'Error occurred while booking');
    } finally {
      setSubmittingBooking(false);
    }
  };

  // 7. Cancel Appointment (sets status to 'cancelled')
  const handleOpenCancelModal = (appt: Appointment) => {
    setCancellingAppt(appt);
  };

  const handleConfirmCancel = async () => {
    if (!cancellingAppt) return;
    setCancellingLoading(true);

    const patientName = cancellingAppt.patient?.full_name || 'Patient';
    const doctorName = cancellingAppt.doctor?.full_name || 'Doctor';

    try {
      const res = await cancelAppointmentAction(cancellingAppt.id);
      if (!res.success) {
        throw new Error(res.error || 'Failed to cancel appointment');
      }

      setSuccessAlert({
        title: 'Appointment Cancelled',
        message: `Appointment for ${patientName} with Dr. ${doctorName} has been cancelled (status set to 'cancelled'). Slot is now free.`,
      });

      setCancellingAppt(null);
      await fetchAppointments();

      // Recalculate slots if current view is for this doctor & date
      if (selectedDoctorId === cancellingAppt.doctor_id) {
        await calculateSlots();
      }
    } catch (err: any) {
      setErrorAlert(err.message || 'Error cancelling appointment');
    } finally {
      setCancellingLoading(false);
    }
  };

  // 8. Reschedule Appointment (picks new free slot and updates starts_at/ends_at)
  const openRescheduleModal = (appt: Appointment) => {
    setReschedulingAppt(appt);
    setRescheduleDate(new Date(appt.starts_at).toISOString().split('T')[0]);
    setRescheduleSlot(null);
    setRescheduleError(null);
  };

  const handleConfirmReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reschedulingAppt || !rescheduleSlot) {
      setRescheduleError('Please select a new time slot.');
      return;
    }

    setSubmittingReschedule(true);
    setRescheduleError(null);

    const dateFormatted = new Date(rescheduleDate).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    try {
      const res = await rescheduleAppointmentAction({
        appointmentId: reschedulingAppt.id,
        newStartsAt: rescheduleSlot.startsAtIso,
        newEndsAt: rescheduleSlot.endsAtIso,
        appointmentDateFormatted: dateFormatted,
        appointmentTimeFormatted: rescheduleSlot.displayLabel,
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to reschedule');
      }

      setSuccessAlert({
        title: 'Appointment Rescheduled!',
        message: `Appointment for ${reschedulingAppt.patient?.full_name} updated to ${dateFormatted} at ${rescheduleSlot.displayLabel}.`,
      });

      setReschedulingAppt(null);
      await fetchAppointments();
      if (selectedDoctorId === reschedulingAppt.doctor_id) {
        await calculateSlots();
      }
    } catch (err: any) {
      setRescheduleError(err.message || 'Error rescheduling appointment');
    } finally {
      setSubmittingReschedule(false);
    }
  };

  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId);

  // Filtered upcoming appointments
  const displayedAppointments = useMemo(() => {
    const now = new Date();
    return appointments.filter((appt) => {
      // View filter
      if (apptViewFilter === 'upcoming') {
        const apptEnd = new Date(appt.ends_at);
        // Show booked appointments from today forward
        if (appt.status !== 'booked') return false;
        if (apptEnd < now) return false;
      } else if (apptViewFilter === 'cancelled') {
        if (appt.status !== 'cancelled') return false;
      }

      // Search query
      if (apptSearchQuery.trim()) {
        const q = apptSearchQuery.toLowerCase();
        const pName = (appt.patient?.full_name || '').toLowerCase();
        const pPhone = (appt.patient?.phone || '').toLowerCase();
        const dName = (appt.doctor?.full_name || '').toLowerCase();
        const notesText = (appt.notes || '').toLowerCase();
        return pName.includes(q) || pPhone.includes(q) || dName.includes(q) || notesText.includes(q);
      }

      return true;
    });
  }, [appointments, apptViewFilter, apptSearchQuery]);

  const upcomingCount = useMemo(() => {
    const now = new Date();
    return appointments.filter((a) => a.status === 'booked' && new Date(a.ends_at) >= now).length;
  }, [appointments]);

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-7xl mx-auto pb-12">
        {/* Page Header */}
        <div className="border-b border-slate-200/80 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 font-semibold">
              Clinic Appointments
            </span>
            <span className="text-xs text-slate-500">• {clinic?.name || 'Clinic'}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Book an Appointment
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Pick a doctor, select a date to view free consultation slots, pick or add a patient, and confirm the booking.
          </p>
        </div>

        {/* Global Success Notification */}
        {successAlert && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-start justify-between shadow-xs">
            <div className="flex items-start gap-3">
              <div className="p-1 rounded-full bg-emerald-100 text-emerald-700 mt-0.5 shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-emerald-950">{successAlert.title}</p>
                <p className="mt-0.5 text-xs text-emerald-800">{successAlert.message}</p>
              </div>
            </div>
            <button
              onClick={() => setSuccessAlert(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold text-xs ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Global Error Notification */}
        {errorAlert && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-sm flex items-start justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{errorAlert}</span>
            </div>
            <button
              onClick={() => setErrorAlert(null)}
              className="text-red-700 hover:text-red-900 font-bold text-xs ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ============================================================ */}
        {/* SECTION 1: BOOKING WORKFLOW                                   */}
        {/* ============================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 7 Columns: Selection Form */}
          <div className="lg:col-span-7 space-y-6">
            {/* STEP 1: PICK DOCTOR */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center">
                    1
                  </span>
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Pick a Doctor
                  </h2>
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  {doctors.length} available
                </span>
              </div>

              {loadingDoctors ? (
                <p className="text-xs text-slate-400 py-3 text-center">Loading doctors...</p>
              ) : doctors.length === 0 ? (
                <div className="p-4 bg-amber-50 rounded-xl text-amber-800 text-xs">
                  No active doctors found. Please add doctors first.
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
                            ? 'border-teal-600 bg-teal-50/60 shadow-xs ring-2 ring-teal-600/20'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            isSelected ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {doc.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-900 truncate">
                              {doc.full_name}
                            </h3>
                            {isSelected && (
                              <span className="text-teal-600 text-xs font-bold shrink-0">✓</span>
                            )}
                          </div>
                          <p className="text-xs text-teal-700 font-medium truncate">
                            {doc.department || 'General Practice'}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            ⏱️ {doc.slot_minutes} min slots • {formatTime(doc.start_time)} - {formatTime(doc.end_time)}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                            📅 {formatWorkDays(doc.work_days)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* STEP 2: PICK DATE & SEE FREE TIME SLOTS */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center">
                    2
                  </span>
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Pick a Date & Free Time Slot
                  </h2>
                </div>
                {slotCalculation?.isWorkDay && (
                  <span className="text-xs text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full font-semibold border border-emerald-200">
                    {slotCalculation.freeSlots.length} Free Slots
                  </span>
                )}
              </div>

              {/* Date Input and Doctor Schedule Info */}
              <div className="space-y-3 mb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Consultation Date
                    </label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Quick Shortcuts
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                        className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 font-medium text-slate-700 transition"
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const tmrw = new Date();
                          tmrw.setDate(tmrw.getDate() + 1);
                          setSelectedDate(tmrw.toISOString().split('T')[0]);
                        }}
                        className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 font-medium text-slate-700 transition"
                      >
                        Tomorrow
                      </button>
                    </div>
                  </div>
                </div>

                {selectedDoctor && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <div className="text-slate-600">
                      Dr. {selectedDoctor.full_name} clinic hours:{' '}
                      <strong className="text-slate-800">
                        {formatTime(selectedDoctor.start_time)} - {formatTime(selectedDoctor.end_time)}
                      </strong>{' '}
                      ({selectedDoctor.slot_minutes} min slots)
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Working Days: <strong className="text-slate-700">{formatWorkDays(selectedDoctor.work_days)}</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Free Slots Grid */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Generated Free Time Slots (Excluding Already Booked)
                </label>

                {loadingSlots ? (
                  <div className="py-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-teal-600" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating free slots...
                  </div>
                ) : !slotCalculation ? (
                  <p className="text-xs text-slate-400 py-3 text-center">
                    Select doctor and date to view free slots.
                  </p>
                ) : !slotCalculation.isWorkDay ? (
                  <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                    <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="font-bold text-amber-950">{slotCalculation.reason}</p>
                      <p className="mt-0.5 text-amber-800">
                        Please choose one of the doctor&apos;s working days: {selectedDoctor ? formatWorkDays(selectedDoctor.work_days) : ''}.
                      </p>
                    </div>
                  </div>
                ) : slotCalculation.freeSlots.length === 0 ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-600">
                    All consultation slots for this doctor on this date are already booked. Please choose another date.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {slotCalculation.freeSlots.map((slot) => {
                      const isChosen = selectedSlot?.startsAtIso === slot.startsAtIso;
                      return (
                        <button
                          key={slot.startsAtIso}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition text-center ${
                            isChosen
                              ? 'bg-teal-600 text-white border-teal-600 shadow-xs ring-2 ring-teal-600/20'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-teal-500 hover:bg-teal-50/40'
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

            {/* STEP 3: PICK PATIENT (SEARCH OR ADD NEW INLINE) */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center">
                    3
                  </span>
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Pick or Add Patient
                  </h2>
                </div>

                {/* Inline Toggle */}
                <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setPatientMode('existing')}
                    className={`px-3 py-1 rounded-md transition ${
                      patientMode === 'existing'
                        ? 'bg-white text-slate-900 font-semibold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Search Existing
                  </button>
                  <button
                    type="button"
                    onClick={() => setPatientMode('new')}
                    className={`px-3 py-1 rounded-md transition ${
                      patientMode === 'new'
                        ? 'bg-white text-slate-900 font-semibold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    + Add New Inline
                  </button>
                </div>
              </div>

              {patientMode === 'existing' ? (
                <div className="space-y-3">
                  <div className="relative">
                    <svg
                      className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      placeholder="Search patient by name or phone..."
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                    />
                    {searchingPatients && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <svg className="animate-spin h-3.5 w-3.5 text-slate-400" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </div>
                    )}
                  </div>

                  {selectedPatient && (
                    <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center">
                          {selectedPatient.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{selectedPatient.full_name}</p>
                          <p className="text-teal-800 font-mono text-[11px]">{selectedPatient.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded bg-teal-200/70 text-teal-900 font-semibold">
                          ✓ Picked
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedPatient(null)}
                          className="text-xs text-slate-400 hover:text-slate-600 underline"
                        >
                          Change
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                    {patients.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-400">
                        No patients matched. Switch to &quot;+ Add New Inline&quot; to create one.
                      </div>
                    ) : (
                      patients.slice(0, 5).map((p) => {
                        const isSelected = selectedPatient?.id === p.id;
                        return (
                          <div
                            key={p.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedPatient(p)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelectedPatient(p);
                              }
                            }}
                            className={`p-2.5 flex items-center justify-between text-xs cursor-pointer hover:bg-slate-50 transition select-none ${
                              isSelected ? 'bg-teal-50/80 font-semibold' : ''
                            }`}
                          >
                            <div>
                              <span className="font-medium text-slate-900">{p.full_name}</span>
                              <span className="text-slate-400 ml-2 font-mono text-[11px]">{p.phone}</span>
                            </div>
                            <button
                              type="button"
                              className="text-[11px] text-teal-600 hover:text-teal-800 font-semibold"
                            >
                              {isSelected ? 'Selected' : 'Pick'}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Patient Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={newPatientName}
                      onChange={(e) => setNewPatientName(e.target.value)}
                      placeholder="e.g. Almaz Ayana"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      value={newPatientPhone}
                      onChange={(e) => setNewPatientPhone(e.target.value)}
                      placeholder="e.g. +251911223344"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>
              )}

              {/* Optional Notes */}
              <div className="mt-3 pt-3 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Appointment Notes / Reason (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Routine checkup, throat irritation"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>
          </div>

          {/* Right 5 Columns: Confirmation Card */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm sticky top-20">
              <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Confirm Slot</h2>
                  <p className="text-xs text-slate-500">Review appointment details</p>
                </div>
              </div>

              <div className="py-4 space-y-3 text-xs text-slate-700">
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-400 font-medium">Doctor</span>
                  <span className="font-bold text-slate-900">
                    {selectedDoctor ? selectedDoctor.full_name : 'None selected'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-400 font-medium">Department</span>
                  <span className="font-medium text-slate-700">
                    {selectedDoctor?.department || 'General Practice'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-400 font-medium">Date</span>
                  <span className="font-bold text-teal-800">
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

                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-400 font-medium">Time Slot</span>
                  <span className="font-bold text-teal-800">
                    {selectedSlot ? selectedSlot.displayLabel : 'No slot picked yet'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-400 font-medium">Patient</span>
                  <span className="font-bold text-slate-900">
                    {patientMode === 'existing'
                      ? selectedPatient?.full_name || 'None selected'
                      : newPatientName || 'New Patient'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-400 font-medium">Phone</span>
                  <span className="font-mono text-slate-800">
                    {patientMode === 'existing'
                      ? selectedPatient?.phone || '--'
                      : newPatientPhone || '--'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400 font-medium">Initial Status</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-[11px]">
                    booked
                  </span>
                </div>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleConfirmBooking}
                  disabled={
                    submittingBooking ||
                    !selectedDoctorId ||
                    !selectedSlot ||
                    (patientMode === 'existing' && !selectedPatient) ||
                    (patientMode === 'new' && (!newPatientName.trim() || !newPatientPhone.trim()))
                  }
                  className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm shadow-sm transition flex items-center justify-center gap-2"
                >
                  {submittingBooking ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Confirming Booking...
                    </>
                  ) : (
                    'Confirm Slot (status: booked)'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* SECTION 2: UPCOMING APPOINTMENTS LIST FOR THE CLINIC        */}
        {/* ============================================================ */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Upcoming Appointments for the Clinic
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-xs font-semibold">
                  {upcomingCount} Upcoming
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Staff can Cancel (sets status to &apos;cancelled&apos;) or Reschedule (pick a new free slot to update starts_at/ends_at).
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search query */}
              <div className="relative">
                <svg
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={apptSearchQuery}
                  onChange={(e) => setApptSearchQuery(e.target.value)}
                  placeholder="Search patient, phone, doctor..."
                  className="pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* View filter buttons */}
              <div className="flex bg-slate-100 p-0.5 rounded-xl text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setApptViewFilter('upcoming')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    apptViewFilter === 'upcoming'
                      ? 'bg-white text-teal-700 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Upcoming ({upcomingCount})
                </button>
                <button
                  type="button"
                  onClick={() => setApptViewFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    apptViewFilter === 'all'
                      ? 'bg-white text-teal-700 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({appointments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setApptViewFilter('cancelled')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    apptViewFilter === 'cancelled'
                      ? 'bg-white text-teal-700 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Cancelled
                </button>
              </div>

              <button
                type="button"
                onClick={fetchAppointments}
                className="px-3 py-1.5 text-xs font-semibold text-teal-600 hover:text-teal-800 border border-teal-200 rounded-xl hover:bg-teal-50 transition"
              >
                ↻ Refresh
              </button>
            </div>
          </div>

          {loadingAppointments ? (
            <div className="py-16 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4 text-teal-600" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading appointments...
            </div>
          ) : displayedAppointments.length === 0 ? (
            <div className="py-16 text-center px-4">
              <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-2">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-700">No appointments found</p>
              <p className="text-xs text-slate-400 mt-1">
                Book a consultation above to see it appear in the upcoming list.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-3.5 px-4 sm:px-6">Patient</th>
                    <th className="py-3.5 px-4">Doctor</th>
                    <th className="py-3.5 px-4">Scheduled Date & Time</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Notes</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {displayedAppointments.map((appt) => {
                    const isBooked = appt.status === 'booked';
                    const isCancelled = appt.status === 'cancelled';
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
                          <div>
                            <div className="font-medium text-slate-900">
                              {new Date(appt.starts_at).toLocaleDateString(undefined, {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </div>
                            <div className="text-xs text-slate-500">
                              {new Date(appt.starts_at).toLocaleTimeString(undefined, {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}{' '}
                              -{' '}
                              {new Date(appt.ends_at).toLocaleTimeString(undefined, {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                              isBooked
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : isCancelled
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
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
                                onClick={() => openRescheduleModal(appt)}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 hover:border-slate-300 transition"
                              >
                                Reschedule
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenCancelModal(appt)}
                                className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold hover:bg-rose-100 transition"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Cancelled</span>
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

        {/* ============================================================ */}
        {/* MODAL: RESCHEDULE APPOINTMENT                                */}
        {/* ============================================================ */}
        {reschedulingAppt && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Reschedule Appointment</h3>
                  <p className="text-xs text-slate-500">
                    Patient: <strong className="text-slate-800">{reschedulingAppt.patient?.full_name}</strong> • Dr. {reschedulingAppt.doctor?.full_name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReschedulingAppt(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleConfirmReschedule} className="p-6 space-y-4">
                {rescheduleError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                    {rescheduleError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select New Date
                  </label>
                  <input
                    type="date"
                    required
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Pick a New Free Time Slot
                  </label>

                  {loadingRescheduleSlots ? (
                    <p className="text-xs text-slate-400 py-3 text-center">Loading available slots...</p>
                  ) : !rescheduleSlotResult ? (
                    <p className="text-xs text-slate-400 py-3">Pick a date to generate free slots.</p>
                  ) : !rescheduleSlotResult.isWorkDay ? (
                    <div className="p-3 bg-amber-50 text-amber-800 rounded-xl text-xs">
                      {rescheduleSlotResult.reason}
                    </div>
                  ) : rescheduleSlotResult.freeSlots.length === 0 ? (
                    <div className="p-3 bg-slate-100 text-slate-600 rounded-xl text-xs text-center">
                      No free slots available on this date.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                      {rescheduleSlotResult.freeSlots.map((slot) => {
                        const isChosen = rescheduleSlot?.startsAtIso === slot.startsAtIso;
                        return (
                          <button
                            key={slot.startsAtIso}
                            type="button"
                            onClick={() => setRescheduleSlot(slot)}
                            className={`py-2 px-1 text-center rounded-lg border text-xs font-semibold transition ${
                              isChosen
                                ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {slot.displayLabel}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setReschedulingAppt(null)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReschedule || !rescheduleSlot}
                    className="px-5 py-2 bg-teal-600 text-white rounded-xl text-xs font-semibold hover:bg-teal-700 disabled:opacity-50 shadow-sm"
                  >
                    {submittingReschedule ? 'Rescheduling...' : 'Confirm Reschedule'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL: CANCEL APPOINTMENT CONFIRMATION                       */}
        {/* ============================================================ */}
        {cancellingAppt && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
              <div className="p-6 space-y-4">
                <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>

                <div className="text-center space-y-1">
                  <h3 className="text-base font-bold text-slate-900">Cancel Appointment?</h3>
                  <p className="text-xs text-slate-500">
                    Are you sure you want to cancel the appointment for{' '}
                    <strong className="text-slate-800">{cancellingAppt.patient?.full_name}</strong> with{' '}
                    <strong className="text-slate-800">Dr. {cancellingAppt.doctor?.full_name}</strong>?
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Status will be updated to &apos;cancelled&apos; and the time slot will be made available for booking.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={cancellingLoading}
                    onClick={() => setCancellingAppt(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl"
                  >
                    Keep Appointment
                  </button>
                  <button
                    type="button"
                    disabled={cancellingLoading}
                    onClick={handleConfirmCancel}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {cancellingLoading ? 'Cancelling...' : 'Yes, Cancel Appointment'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
