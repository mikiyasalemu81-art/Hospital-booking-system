import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStaff } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendAndLogSms, buildConfirmationMessage } from '@/lib/sms';

// GET /api/appointments - List appointments for current staff's clinic
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedStaff(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const doctorId = searchParams.get('doctor_id');
    const date = searchParams.get('date'); // YYYY-MM-DD
    const status = searchParams.get('status');

    let query = supabaseAdmin
      .from('appointments')
      .select('*, doctor:doctors(*), patient:patients(*)')
      .eq('clinic_id', auth.staff.clinic_id);

    if (doctorId) {
      query = query.eq('doctor_id', doctorId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (date) {
      // Buffer by +/- 24 hours to accommodate any client/server timezone differences
      const [year, month, day] = date.split('-').map(Number);
      const startRange = new Date(Date.UTC(year, month - 1, day - 1, 0, 0, 0)).toISOString();
      const endRange = new Date(Date.UTC(year, month - 1, day + 2, 23, 59, 59)).toISOString();
      query = query.gte('starts_at', startRange).lte('starts_at', endRange);
    }

    const { data, error } = await query.order('starts_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ appointments: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

// POST /api/appointments - Book a new appointment
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedStaff(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      doctor_id,
      patient_id,
      new_patient,
      starts_at,
      ends_at,
      notes,
      appointment_date_formatted,
      appointment_time_formatted,
    } = body;

    const clinicId = auth.staff.clinic_id;

    if (!doctor_id || !starts_at || !ends_at) {
      return NextResponse.json(
        { error: 'doctor_id, starts_at, and ends_at are required' },
        { status: 400 }
      );
    }

    // 1. Resolve Patient
    let resolvedPatientId = patient_id;
    let patientName = '';
    let patientPhone = '';

    if (resolvedPatientId) {
      const { data: patient, error: pError } = await supabaseAdmin
        .from('patients')
        .select('*')
        .eq('id', resolvedPatientId)
        .eq('clinic_id', clinicId)
        .single();

      if (pError || !patient) {
        return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
      }
      patientName = patient.full_name;
      patientPhone = patient.phone;
    } else if (new_patient) {
      const { full_name, phone } = new_patient;
      if (!full_name?.trim() || !phone?.trim()) {
        return NextResponse.json(
          { error: 'New patient requires both full name and phone' },
          { status: 400 }
        );
      }

      const { data: created, error: createError } = await supabaseAdmin
        .from('patients')
        .insert({
          clinic_id: clinicId,
          full_name: full_name.trim(),
          phone: phone.trim(),
        })
        .select()
        .single();

      if (createError || !created) {
        return NextResponse.json(
          { error: createError?.message || 'Failed to create patient' },
          { status: 500 }
        );
      }

      resolvedPatientId = created.id;
      patientName = created.full_name;
      patientPhone = created.phone;
    } else {
      return NextResponse.json(
        { error: 'Either patient_id or new_patient must be provided' },
        { status: 400 }
      );
    }

    // 2. Resolve Doctor
    const { data: doctor, error: docError } = await supabaseAdmin
      .from('doctors')
      .select('*')
      .eq('id', doctor_id)
      .eq('clinic_id', clinicId)
      .single();

    if (docError || !doctor) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });
    }

    // 3. Conflict verification: ensure no active 'booked' appointment overlaps
    const { data: conflicts, error: conflictError } = await supabaseAdmin
      .from('appointments')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('doctor_id', doctor.id)
      .eq('status', 'booked')
      .lt('starts_at', ends_at)
      .gt('ends_at', starts_at);

    if (conflictError) {
      return NextResponse.json({ error: 'Failed to verify slot conflict' }, { status: 500 });
    }

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json(
        { error: 'This time slot is already booked. Please choose another.' },
        { status: 409 }
      );
    }

    // 4. Insert into appointments with status 'booked'
    const { data: appointment, error: insertError } = await supabaseAdmin
      .from('appointments')
      .insert({
        clinic_id: clinicId,
        doctor_id: doctor.id,
        patient_id: resolvedPatientId,
        starts_at,
        ends_at,
        status: 'booked',
        notes: notes?.trim() || null,
        created_by: auth.staff.id,
        reminder_24h_sent: false,
        reminder_2h_sent: false,
      })
      .select('*, doctor:doctors(*), patient:patients(*)')
      .single();

    if (insertError || !appointment) {
      return NextResponse.json(
        { error: insertError?.message || 'Failed to create appointment' },
        { status: 500 }
      );
    }

    // 5. Invoke SMS placeholder function
    const dateFormatted =
      appointment_date_formatted ||
      new Date(starts_at).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    const timeFormatted =
      appointment_time_formatted ||
      new Date(starts_at).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      });

    const smsResult = await sendAndLogSms({
      clinicId,
      appointmentId: appointment.id,
      phone: patientPhone,
      kind: 'confirmation',
      message: buildConfirmationMessage({
        patientName,
        clinicName: auth.clinic.name,
        doctorName: doctor.full_name,
        date: dateFormatted,
        time: timeFormatted,
      }),
    });

    return NextResponse.json(
      {
        success: true,
        appointment,
        smsResult: { success: smsResult.success, error: smsResult.error },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
