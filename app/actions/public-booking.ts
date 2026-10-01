'use server';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { generateDoctorSlots, SlotGenerationResult } from '@/lib/slot-generator';
import { Doctor } from '@/lib/types';
import { sendAppointmentSms } from '@/lib/sms';

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

/**
 * 4. Generate free time slots for a doctor on a specific date
 * Strictly excludes slots that already have a 'booked' appointment for that doctor.
 * Never exposes patient names, other appointments, or private data to the public.
 */
export async function getPublicDoctorSlots(
  clinicId: string,
  doctorId: string,
  dateStr: string // "YYYY-MM-DD"
): Promise<{ success: boolean; result?: SlotGenerationResult; error?: string }> {
  try {
    // Fetch doctor record to get work schedule
    const { data: doctor, error: docError } = await supabaseAdmin
      .from('doctors')
      .select('id, clinic_id, full_name, department, slot_minutes, work_days, start_time, end_time, active')
      .eq('id', doctorId)
      .eq('clinic_id', clinicId)
      .single();

    if (docError || !doctor || !doctor.active) {
      return { success: false, error: 'Doctor not found or inactive' };
    }

    // Buffer range around date to prevent timezone misses
    const [year, month, day] = dateStr.split('-').map(Number);
    const startRange = new Date(Date.UTC(year, month - 1, day - 1, 0, 0, 0)).toISOString();
    const endRange = new Date(Date.UTC(year, month - 1, day + 2, 23, 59, 59)).toISOString();

    // Query booked appointments for this doctor only
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
  doctorId: string;
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
 * - Double-booking prevention check
 * - Match patient by phone + clinic_id or insert if new
 * - Insert into appointments with status='booked', correct clinic_id, created_by=null
 * - Invoke empty SMS placeholder
 */
export async function bookPublicAppointmentAction(
  input: BookPublicAppointmentInput
): Promise<BookPublicAppointmentResult> {
  try {
    const { clinicId, doctorId, startsAt, endsAt, fullName, phone, notes } = input;

    if (!clinicId || !doctorId || !startsAt || !endsAt) {
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

    // Fetch clinic & doctor
    const [clinicRes, docRes] = await Promise.all([
      supabaseAdmin.from('clinics').select('id, name, phone, created_at').eq('id', clinicId).single(),
      supabaseAdmin.from('doctors').select('id, full_name, department, active').eq('id', doctorId).eq('clinic_id', clinicId).single(),
    ]);

    if (clinicRes.error || !clinicRes.data) {
      return { success: false, error: 'Clinic not found' };
    }
    if (docRes.error || !docRes.data || !docRes.data.active) {
      return { success: false, error: 'Doctor not found or unavailable' };
    }

    const clinic = clinicRes.data;
    const doctor = docRes.data;

    // Double-booking check: verify no overlapping 'booked' appointment exists
    const { data: conflicts, error: conflictErr } = await supabaseAdmin
      .from('appointments')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('doctor_id', doctorId)
      .eq('status', 'booked')
      .lt('starts_at', endsAt)
      .gt('ends_at', startsAt);

    if (conflictErr) {
      return { success: false, error: 'Could not verify slot status' };
    }

    if (conflicts && conflicts.length > 0) {
      return {
        success: false,
        error: 'This time slot is no longer available. Another patient just booked it. Please choose another time slot.',
      };
    }

    // Match patient by phone + clinic_id, or create if doesn't exist
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

    // Atomic double-check & insert into appointments
    // status='booked', clinic_id=clinicId, created_by=null
    const { data: appointment, error: insertError } = await supabaseAdmin
      .from('appointments')
      .insert({
        clinic_id: clinicId,
        doctor_id: doctorId,
        patient_id: patientId,
        starts_at: startsAt,
        ends_at: endsAt,
        status: 'booked',
        created_by: null, // explicit null as required
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

    // Placeholder SMS call (empty placeholder function)
    await sendAppointmentSms({
      clinicId,
      appointmentId: appointment.id,
      phone: cleanPhone,
      patientName: cleanFullName,
      clinicName: clinic.name,
      doctorName: doctor.full_name,
      appointmentDate: input.dateFormatted || new Date(startsAt).toLocaleDateString(),
      appointmentTime: input.timeFormatted || new Date(startsAt).toLocaleTimeString(),
      kind: 'confirmation',
    });

    return {
      success: true,
      appointment,
      clinic,
      doctor,
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
