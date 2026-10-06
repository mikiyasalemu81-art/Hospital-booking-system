'use server';

import { getAuthenticatedStaff } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  sendAppointmentSms,
  sendAndLogSms,
  buildConfirmationMessage,
  formatAppointmentDateTime,
} from '@/lib/sms';

export interface BookAppointmentInput {
  doctorId: string;
  patientId?: string;
  newPatient?: {
    full_name: string;
    phone: string;
  };
  startsAt: string; // ISO string
  endsAt: string; // ISO string
  appointmentDateFormatted: string; // e.g. "Mon, Oct 5, 2026"
  appointmentTimeFormatted: string; // e.g. "09:00 AM - 09:30 AM"
  notes?: string;
}

export interface BookAppointmentResult {
  success: boolean;
  appointment?: any;
  error?: string;
}

/**
 * Server action to book an appointment:
 * Inserts into appointments with status 'booked', doctor_id, patient_id,
 * starts_at, ends_at, clinic_id, created_by.
 * Calls SMS-sending placeholder function.
 */
export async function bookAppointmentAction(
  input: BookAppointmentInput
): Promise<BookAppointmentResult> {
  try {
    const auth = await getAuthenticatedStaff();
    if (!auth) {
      return { success: false, error: 'Unauthorized: Staff session not found' };
    }

    const { staff, clinic } = auth;
    const clinicId = staff.clinic_id;

    // 1. Resolve Patient (pick existing or add new inline)
    let patientId = input.patientId;
    let patientName = '';
    let patientPhone = '';

    if (patientId) {
      const { data: patient, error: pError } = await supabaseAdmin
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .eq('clinic_id', clinicId)
        .single();

      if (pError || !patient) {
        return { success: false, error: 'Patient not found in this clinic' };
      }
      patientName = patient.full_name;
      patientPhone = patient.phone;
    } else if (input.newPatient) {
      const { full_name, phone } = input.newPatient;
      if (!full_name?.trim() || !phone?.trim()) {
        return { success: false, error: 'New patient full name and phone number required' };
      }

      const { data: createdPatient, error: cpError } = await supabaseAdmin
        .from('patients')
        .insert({
          clinic_id: clinicId,
          full_name: full_name.trim(),
          phone: phone.trim(),
        })
        .select()
        .single();

      if (cpError || !createdPatient) {
        return { success: false, error: cpError?.message || 'Failed to register new patient' };
      }

      patientId = createdPatient.id;
      patientName = createdPatient.full_name;
      patientPhone = createdPatient.phone;
    } else {
      return { success: false, error: 'Please select an existing patient or provide new patient details' };
    }

    // 2. Resolve Doctor
    const { data: doctor, error: docError } = await supabaseAdmin
      .from('doctors')
      .select('*')
      .eq('id', input.doctorId)
      .eq('clinic_id', clinicId)
      .single();

    if (docError || !doctor) {
      return { success: false, error: 'Doctor not found in this clinic' };
    }

    // 3. Verify slot availability (exclude if already 'booked' for this doctor)
    const { data: conflicts, error: conflictError } = await supabaseAdmin
      .from('appointments')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('doctor_id', doctor.id)
      .eq('status', 'booked')
      .lt('starts_at', input.endsAt)
      .gt('ends_at', input.startsAt);

    if (conflictError) {
      return { success: false, error: 'Failed to verify slot availability' };
    }

    if (conflicts && conflicts.length > 0) {
      return {
        success: false,
        error: 'This time slot is no longer available. Please select another slot.',
      };
    }

    // 4. Insert into appointments with:
    // status 'booked', doctor_id, patient_id, starts_at, ends_at, clinic_id, created_by
    const { data: appointment, error: insertError } = await supabaseAdmin
      .from('appointments')
      .insert({
        clinic_id: clinicId,
        doctor_id: doctor.id,
        patient_id: patientId,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        status: 'booked',
        notes: input.notes?.trim() || null,
        created_by: staff.id,
        reminder_24h_sent: false,
        reminder_2h_sent: false,
      })
      .select('*, doctor:doctors(*), patient:patients(*)')
      .single();

    if (insertError || !appointment) {
      return { success: false, error: insertError?.message || 'Failed to book appointment' };
    }

    // 5. Send confirmation SMS via Afro Message (logged to sms_log).
    // sendAndLogSms never throws; an SMS failure must not fail the booking.
    const fallback = formatAppointmentDateTime(appointment.starts_at, clinic.timezone);
    await sendAndLogSms({
      clinicId,
      appointmentId: appointment.id,
      phone: patientPhone,
      kind: 'confirmation',
      message: buildConfirmationMessage({
        patientName,
        clinicName: clinic.name,
        doctorName: doctor.full_name,
        department: doctor.department,
        careType: input.notes?.trim() || doctor.department || 'Consultation',
        clinicPhone: clinic.phone,
        date: input.appointmentDateFormatted || fallback.date,
        time: input.appointmentTimeFormatted || fallback.time,
      }),
    });

    return {
      success: true,
      appointment,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Unexpected server error while booking' };
  }
}

/**
 * Server action to cancel an appointment (sets status to 'cancelled').
 * Calls SMS-sending placeholder function.
 */
export async function cancelAppointmentAction(appointmentId: string) {
  try {
    const auth = await getAuthenticatedStaff();
    if (!auth) {
      return { success: false, error: 'Unauthorized' };
    }

    const { staff, clinic } = auth;
    const clinicId = staff.clinic_id;

    // Fetch existing appointment
    const { data: appt, error: apptError } = await supabaseAdmin
      .from('appointments')
      .select('*, doctor:doctors(*), patient:patients(*)')
      .eq('id', appointmentId)
      .eq('clinic_id', clinicId)
      .single();

    if (apptError || !appt) {
      return { success: false, error: 'Appointment not found' };
    }

    // Update status to 'cancelled'
    const { error: updateError } = await supabaseAdmin
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appointmentId)
      .eq('clinic_id', clinicId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // SMS placeholder
    if (appt.patient?.phone) {
      await sendAppointmentSms({
        clinicId,
        appointmentId: appt.id,
        phone: appt.patient.phone,
        patientName: appt.patient.full_name || 'Patient',
        clinicName: clinic.name,
        doctorName: appt.doctor?.full_name || 'Doctor',
        kind: 'cancellation',
      });
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to cancel appointment' };
  }
}

/**
 * Server action to reschedule an appointment (updates starts_at/ends_at).
 * Calls SMS-sending placeholder function.
 */
export async function rescheduleAppointmentAction(params: {
  appointmentId: string;
  newStartsAt: string;
  newEndsAt: string;
  appointmentDateFormatted: string;
  appointmentTimeFormatted: string;
}) {
  try {
    const auth = await getAuthenticatedStaff();
    if (!auth) {
      return { success: false, error: 'Unauthorized' };
    }

    const { staff, clinic } = auth;
    const clinicId = staff.clinic_id;

    // Fetch existing appointment
    const { data: appt, error: apptError } = await supabaseAdmin
      .from('appointments')
      .select('*, doctor:doctors(*), patient:patients(*)')
      .eq('id', params.appointmentId)
      .eq('clinic_id', clinicId)
      .single();

    if (apptError || !appt) {
      return { success: false, error: 'Appointment not found' };
    }

    // Check conflict for new slot with any other booked appointment for that doctor
    const { data: conflicts } = await supabaseAdmin
      .from('appointments')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('doctor_id', appt.doctor_id)
      .eq('status', 'booked')
      .neq('id', params.appointmentId)
      .lt('starts_at', params.newEndsAt)
      .gt('ends_at', params.newStartsAt);

    if (conflicts && conflicts.length > 0) {
      return { success: false, error: 'The newly selected time slot is already booked' };
    }

    // Update appointment starts_at and ends_at
    const { error: updateError } = await supabaseAdmin
      .from('appointments')
      .update({
        starts_at: params.newStartsAt,
        ends_at: params.newEndsAt,
        status: 'booked',
      })
      .eq('id', params.appointmentId)
      .eq('clinic_id', clinicId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // SMS placeholder
    if (appt.patient?.phone) {
      await sendAppointmentSms({
        clinicId,
        appointmentId: appt.id,
        phone: appt.patient.phone,
        patientName: appt.patient.full_name || 'Patient',
        clinicName: clinic.name,
        doctorName: appt.doctor?.full_name || 'Doctor',
        appointmentDate: params.appointmentDateFormatted,
        appointmentTime: params.appointmentTimeFormatted,
        kind: 'reschedule',
      });
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to reschedule appointment' };
  }
}

/**
 * Server action to update appointment status (e.g. 'attended' or 'missed')
 */
export async function updateAppointmentStatusAction(
  appointmentId: string,
  newStatus: 'booked' | 'attended' | 'missed' | 'cancelled'
) {
  try {
    const auth = await getAuthenticatedStaff();
    if (!auth) {
      return { success: false, error: 'Unauthorized' };
    }

    const { staff } = auth;
    const clinicId = staff.clinic_id;

    const { error: updateError } = await supabaseAdmin
      .from('appointments')
      .update({ status: newStatus })
      .eq('id', appointmentId)
      .eq('clinic_id', clinicId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update appointment status' };
  }
}

