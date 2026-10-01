import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStaff } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendAppointmentSms } from '@/lib/sms';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PATCH /api/appointments/[id] - Cancel or reschedule appointment
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getAuthenticatedStaff(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, starts_at, ends_at, appointmentDateFormatted, appointmentTimeFormatted } = body;

    const { data: appt, error: findError } = await supabaseAdmin
      .from('appointments')
      .select('*, doctor:doctors(*), patient:patients(*)')
      .eq('id', id)
      .eq('clinic_id', auth.staff.clinic_id)
      .single();

    if (findError || !appt) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    if (action === 'cancel') {
      const { error: cancelError } = await supabaseAdmin
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('clinic_id', auth.staff.clinic_id);

      if (cancelError) {
        return NextResponse.json({ error: cancelError.message }, { status: 500 });
      }

      // Send SMS
      if (appt.patient?.phone) {
        const apptDate = new Date(appt.starts_at).toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        const apptTime = new Date(appt.starts_at).toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
        });

        await sendAppointmentSms({
          clinicId: auth.staff.clinic_id,
          appointmentId: id,
          phone: appt.patient.phone,
          patientName: appt.patient.full_name || 'Patient',
          clinicName: auth.clinic.name,
          doctorName: appt.doctor?.full_name || 'Doctor',
          appointmentDate: apptDate,
          appointmentTime: apptTime,
          kind: 'cancellation',
        });
      }

      return NextResponse.json({ success: true, message: 'Appointment cancelled successfully' });
    }

    if (action === 'reschedule') {
      if (!starts_at || !ends_at) {
        return NextResponse.json({ error: 'New starts_at and ends_at are required' }, { status: 400 });
      }

      // Check slot conflict
      const { data: conflicts } = await supabaseAdmin
        .from('appointments')
        .select('*')
        .eq('clinic_id', auth.staff.clinic_id)
        .eq('doctor_id', appt.doctor_id)
        .eq('status', 'booked')
        .neq('id', id)
        .lt('starts_at', ends_at)
        .gt('ends_at', starts_at);

      if (conflicts && conflicts.length > 0) {
        return NextResponse.json({ error: 'The selected slot is already booked' }, { status: 409 });
      }

      const { error: updateError } = await supabaseAdmin
        .from('appointments')
        .update({
          starts_at,
          ends_at,
          status: 'booked',
        })
        .eq('id', id)
        .eq('clinic_id', auth.staff.clinic_id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      // Send SMS
      if (appt.patient?.phone) {
        await sendAppointmentSms({
          clinicId: auth.staff.clinic_id,
          appointmentId: id,
          phone: appt.patient.phone,
          patientName: appt.patient.full_name || 'Patient',
          clinicName: auth.clinic.name,
          doctorName: appt.doctor?.full_name || 'Doctor',
          appointmentDate: appointmentDateFormatted || new Date(starts_at).toLocaleDateString(),
          appointmentTime: appointmentTimeFormatted || new Date(starts_at).toLocaleTimeString(),
          kind: 'reschedule',
        });
      }

      return NextResponse.json({ success: true, message: 'Appointment rescheduled successfully' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
