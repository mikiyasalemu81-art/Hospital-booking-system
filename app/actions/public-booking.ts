'use server';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { generateDoctorSlots, SlotGenerationResult } from '@/lib/slot-generator';
import { Doctor } from '@/lib/types';
import { sendAndLogSms, buildConfirmationMessage, formatAppointmentDateTime } from '@/lib/sms';

export interface PublicClinic {
  id: string;
  name: string;
  phone: string | null;
  created_at: string;
}

export interface PublicDoctor {
  id: string;
  full_name: string;
  department: string | null;
  slot_minutes: number;
  work_days: number[];
  start_time: string;
  end_time: string;
}

/**
 * 1. Fetch list of all clinics (name, phone) for public display at /book
 */
export async function getPublicClinics(): Promise<{ success: boolean; clinics: PublicClinic[]; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('clinics')
      .select('id, name, phone, created_at')
      .order('name', { ascending: true });

    if (error) {
      return { success: false, clinics: [], error: error.message };
    }
    return { success: true, clinics: data || [] };
  } catch (err: any) {
    return { success: false, clinics: [], error: err?.message || 'Failed to load clinics' };
  }
}

/**
 * 2. Fetch specific clinic details for /book/[clinic_id]
 */
export async function getPublicClinic(clinicId: string): Promise<{ success: boolean; clinic?: PublicClinic; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('clinics')
      .select('id, name, phone, created_at')
      .eq('id', clinicId)
      .single();

    if (error || !data) {
      return { success: false, error: 'Clinic not found' };
    }
    return { success: true, clinic: data };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to load clinic' };
  }
}

/**
 * 3. Fetch active doctors for a clinic (name, department, schedule details for slot calculation)
 * Publicly exposes only name & department for UI display
 */
export async function getPublicDoctors(clinicId: string): Promise<{ success: boolean; doctors: PublicDoctor[]; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('doctors')
      .select('id, full_name, department, slot_minutes, work_days, start_time, end_time')
      .eq('clinic_id', clinicId)
      .eq('active', true)
      .order('full_name', { ascending: true });

    if (error) {
      return { success: false, doctors: [], error: error.message };
    }
    return { success: true, doctors: data || [] };
  } catch (err: any) {
    return { success: false, doctors: [], error: err?.message || 'Failed to load doctors' };
  }
}

export interface PublicCombinedSlot {
  startTime: string; // "08:30"
  endTime: string;   // "09:00"
  startsAtIso: string;
  endsAtIso: string;
  displayLabel: string;
}

/**
 * 4. Generate combined free time slots for a clinic on a specific date across all active doctors.
 * Patients don't pick a doctor. We show the distinct free times available on that date.
 */
export async function getPublicCombinedSlots(
  clinicId: string,
  dateStr: string // "YYYY-MM-DD"
): Promise<{
  success: boolean;
  isWorkDay: boolean;
  reason?: string;
  slots: PublicCombinedSlot[];
  error?: string;
}> {
  try {
    if (!clinicId || !dateStr) {
      return { success: false, isWorkDay: false, slots: [], error: 'Missing clinic ID or date' };
    }

    // Fetch all active doctors for the clinic
    const { data: doctors, error: docError } = await supabaseAdmin
      .from('doctors')
      .select('id, clinic_id, full_name, department, slot_minutes, work_days, start_time, end_time, active')
      .eq('clinic_id', clinicId)
      .eq('active', true);

    if (docError) {
      return { success: false, isWorkDay: false, slots: [], error: docError.message };
    }

    if (!doctors || doctors.length === 0) {
      return {
        success: true,
        isWorkDay: false,
        reason: 'No active doctors are currently available at this clinic.',
        slots: [],
      };
    }

    // Determine which doctors work on this day
    const [year, month, day] = dateStr.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const jsDay = dateObj.getDay();
    const isoDay = jsDay === 0 ? 7 : jsDay;

    const workingDoctors = doctors.filter(
      (d) => Array.isArray(d.work_days) && d.work_days.includes(isoDay)
    );

    if (workingDoctors.length === 0) {
      return {
        success: true,
        isWorkDay: false,
        reason: 'The clinic is closed on this day. Please choose another date.',
        slots: [],
      };
    }

    // Buffer range around date to prevent timezone misses
    const startRange = new Date(Date.UTC(year, month - 1, day - 1, 0, 0, 0)).toISOString();
    const endRange = new Date(Date.UTC(year, month - 1, day + 2, 23, 59, 59)).toISOString();

    const { data: bookedAppointments, error: apptError } = await supabaseAdmin
      .from('appointments')
      .select('id, doctor_id, starts_at, ends_at, status')
      .eq('clinic_id', clinicId)
      .eq('status', 'booked')
      .gte('starts_at', startRange)
      .lte('starts_at', endRange);

    if (apptError) {
      return { success: false, isWorkDay: true, slots: [], error: 'Failed to verify slot availability' };
    }

    // Generate free slots for each working doctor and combine
    const slotMap = new Map<string, PublicCombinedSlot>();

    for (const doc of workingDoctors) {
      const docSlotResult = generateDoctorSlots(doc as Doctor, dateStr, (bookedAppointments as any) || []);
      for (const slot of docSlotResult.freeSlots) {
        if (!slotMap.has(slot.startsAtIso)) {
          slotMap.set(slot.startsAtIso, {
            startTime: slot.startTime,
            endTime: slot.endTime,
            startsAtIso: slot.startsAtIso,
            endsAtIso: slot.endsAtIso,
            displayLabel: slot.displayLabel,
          });
        }
      }
    }

    const combinedSlots = Array.from(slotMap.values()).sort(
      (a, b) => new Date(a.startsAtIso).getTime() - new Date(b.startsAtIso).getTime()
    );

    return {
      success: true,
      isWorkDay: true,
      slots: combinedSlots,
    };
  } catch (err: any) {
    return {
      success: false,
      isWorkDay: false,
      slots: [],
      error: err?.message || 'Error generating combined time slots',
    };
  }
}

/**
 * Legacy single-doctor slot generator (kept for backward-compatibility if needed)
 */
export async function getPublicDoctorSlots(
  clinicId: string,
  doctorId: string,
  dateStr: string // "YYYY-MM-DD"
): Promise<{ success: boolean; result?: SlotGenerationResult; error?: string }> {
  try {
    const { data: doctor, error: docError } = await supabaseAdmin
      .from('doctors')
      .select('id, clinic_id, full_name, department, slot_minutes, work_days, start_time, end_time, active')
      .eq('id', doctorId)
      .eq('clinic_id', clinicId)
      .single();

    if (docError || !doctor || !doctor.active) {
      return { success: false, error: 'Doctor not found or inactive' };
    }

    const [year, month, day] = dateStr.split('-').map(Number);
    const startRange = new Date(Date.UTC(year, month - 1, day - 1, 0, 0, 0)).toISOString();
    const endRange = new Date(Date.UTC(year, month - 1, day + 2, 23, 59, 59)).toISOString();

    const { data: bookedAppointments, error: apptError } = await supabaseAdmin
      .from('appointments')
      .select('id, doctor_id, starts_at, ends_at, status')
      .eq('clinic_id', clinicId)
      .eq('doctor_id', doctorId)
      .eq('status', 'booked')
      .gte('starts_at', startRange)
      .lte('starts_at', endRange);

    if (apptError) {
      return { success: false, error: 'Failed to verify slot availability' };
    }

    const slotResult = generateDoctorSlots(doctor as Doctor, dateStr, (bookedAppointments as any) || []);

    return {
      success: true,
      result: slotResult,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error generating time slots' };
  }
}

export interface BookPublicAppointmentInput {
  clinicId: string;
  doctorId?: string; // Optional: auto-assigned to first available doctor if omitted
  startsAt: string; // ISO string
  endsAt: string; // ISO string
  fullName: string;
  phone: string;
  notes?: string;
  dateFormatted?: string;
  timeFormatted?: string;
}

export interface BookPublicAppointmentResult {
  success: boolean;
  appointment?: any;
  clinic?: PublicClinic;
  doctor?: { id: string; full_name: string; department: string | null };
  patient?: { full_name: string; phone: string };
  error?: string;
}

/**
 * 5. Confirm public booking:
 * - Patients don't choose a doctor.
 * - On confirm, assigns the first doctor who is free at that time.
 * - Re-checks availability right before inserting.
 * - If slot was just taken, returns: "That time was just booked, please pick another"
 * - Double-booking prevention rule strictly holds.
 * - Awaits sendAndLogSms before returning.
 */
export async function bookPublicAppointmentAction(
  input: BookPublicAppointmentInput
): Promise<BookPublicAppointmentResult> {
  try {
    const { clinicId, startsAt, endsAt, fullName, phone, notes } = input;

    if (!clinicId || !startsAt || !endsAt) {
      return { success: false, error: 'Missing appointment scheduling parameters' };
    }
    if (!fullName || !fullName.trim()) {
      return { success: false, error: 'Patient full name is required' };
    }
    if (!phone || !phone.trim()) {
      return { success: false, error: 'Patient phone number is required' };
    }

    const cleanFullName = fullName.trim();
    const cleanPhone = phone.trim();

    // 1. Fetch clinic
    const { data: clinic, error: clinicErr } = await supabaseAdmin
      .from('clinics')
      .select('id, name, phone, created_at, timezone')
      .eq('id', clinicId)
      .single();

    if (clinicErr || !clinic) {
      return { success: false, error: 'Clinic not found' };
    }

    // 2. Fetch all active doctors for the clinic
    const { data: doctors, error: docErr } = await supabaseAdmin
      .from('doctors')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('active', true)
      .order('created_at', { ascending: true });

    if (docErr || !doctors || doctors.length === 0) {
      return { success: false, error: 'No active doctors are currently available at this clinic' };
    }

    // 3. Find first doctor who is free at this specific slot
    const apptDate = new Date(startsAt);
    const jsDay = apptDate.getDay();
    const isoDay = jsDay === 0 ? 7 : jsDay;

    // Check existing appointments overlapping this time window across the clinic
    const { data: existingAppts, error: conflictErr } = await supabaseAdmin
      .from('appointments')
      .select('id, doctor_id, starts_at, ends_at, status')
      .eq('clinic_id', clinicId)
      .eq('status', 'booked')
      .lt('starts_at', endsAt)
      .gt('ends_at', startsAt);

    if (conflictErr) {
      return { success: false, error: 'Could not verify slot status' };
    }

    const apptEndDate = new Date(endsAt);
    const slotStartMin = apptDate.getHours() * 60 + apptDate.getMinutes();
    const slotEndMin = apptEndDate.getHours() * 60 + apptEndDate.getMinutes();

    let chosenDoctor: Doctor | null = null;

    // If caller specified doctorId, respect it first; otherwise check in order
    const doctorList = input.doctorId
      ? doctors.filter((d) => d.id === input.doctorId)
      : doctors;

    for (const doc of doctorList) {
      // Must work on this day
      if (!Array.isArray(doc.work_days) || !doc.work_days.includes(isoDay)) {
        continue;
      }

      // Must be within doctor's working hours
      const cleanTime = (t: string | undefined, def: string) => (t ? t.slice(0, 5) : def);
      const [startH, startM] = cleanTime(doc.start_time, '08:00').split(':').map(Number);
      const [endH, endM] = cleanTime(doc.end_time, '17:00').split(':').map(Number);
      const docStartMin = startH * 60 + startM;
      const docEndMin = endH * 60 + endM;

      if (slotStartMin < docStartMin || slotEndMin > docEndMin) {
        continue;
      }

      // Check conflict
      const hasConflict = (existingAppts || []).some(
        (a) => a.doctor_id === doc.id && a.status === 'booked'
      );
      if (hasConflict) {
        continue;
      }

      // Re-check atomic availability right before assigning
      const { data: directConflicts } = await supabaseAdmin
        .from('appointments')
        .select('id')
        .eq('clinic_id', clinicId)
        .eq('doctor_id', doc.id)
        .eq('status', 'booked')
        .lt('starts_at', endsAt)
        .gt('ends_at', startsAt);

      if (directConflicts && directConflicts.length > 0) {
        continue;
      }

      chosenDoctor = doc as Doctor;
      break;
    }

    if (!chosenDoctor) {
      return {
        success: false,
        error: 'That time was just booked, please pick another',
      };
    }

    // 4. Match patient by phone + clinic_id, or create if doesn't exist
    let patientId: string | null = null;
    const { data: existingPatients } = await supabaseAdmin
      .from('patients')
      .select('id, full_name, phone')
      .eq('clinic_id', clinicId)
      .eq('phone', cleanPhone);

    if (existingPatients && existingPatients.length > 0) {
      patientId = existingPatients[0].id;
    } else {
      const { data: newPatient, error: pError } = await supabaseAdmin
        .from('patients')
        .insert({
          clinic_id: clinicId,
          full_name: cleanFullName,
          phone: cleanPhone,
        })
        .select()
        .single();

      if (pError || !newPatient) {
        return { success: false, error: pError?.message || 'Failed to save patient profile' };
      }
      patientId = newPatient.id;
    }

    // 5. Insert appointment with status='booked', clinic_id=clinicId, created_by=null
    const { data: appointment, error: insertError } = await supabaseAdmin
      .from('appointments')
      .insert({
        clinic_id: clinicId,
        doctor_id: chosenDoctor.id,
        patient_id: patientId,
        starts_at: startsAt,
        ends_at: endsAt,
        status: 'booked',
        created_by: null,
        notes: notes?.trim() || null,
        reminder_24h_sent: false,
        reminder_2h_sent: false,
      })
      .select('id, starts_at, ends_at, status, created_at')
      .single();

    if (insertError || !appointment) {
      return {
        success: false,
        error: insertError?.message || 'Failed to reserve appointment slot',
      };
    }

    // 6. Send confirmation SMS via Afro Message (logged to sms_log).
    // sendAndLogSms is strictly awaited so it completes on serverless (e.g. Vercel)
    const fallback = formatAppointmentDateTime(startsAt, clinic.timezone);
    await sendAndLogSms({
      clinicId,
      appointmentId: appointment.id,
      phone: cleanPhone,
      kind: 'confirmation',
      message: buildConfirmationMessage({
        patientName: cleanFullName,
        clinicName: clinic.name,
        doctorName: chosenDoctor.full_name,
        department: chosenDoctor.department,
        careType: notes?.trim() || chosenDoctor.department || 'Consultation',
        clinicPhone: clinic.phone,
        date: input.dateFormatted || fallback.date,
        time: input.timeFormatted || fallback.time,
      }),
    });

    return {
      success: true,
      appointment,
      clinic: { id: clinic.id, name: clinic.name, phone: clinic.phone, created_at: clinic.created_at },
      doctor: { id: chosenDoctor.id, full_name: chosenDoctor.full_name, department: chosenDoctor.department },
      patient: {
        full_name: cleanFullName,
        phone: cleanPhone,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Server error occurred during public booking',
    };
  }
}
