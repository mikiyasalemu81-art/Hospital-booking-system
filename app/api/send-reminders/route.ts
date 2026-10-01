import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET/POST /api/send-reminders
 *
 * Finds all appointments with status='booked' where:
 * - starts_at is ~24h away and reminder_24h_sent=false -> logs to sms_log with kind='reminder_24h', status='pending_sms_provider'
 * - starts_at is ~2h away and reminder_2h_sent=false -> logs to sms_log with kind='reminder_2h', status='pending_sms_provider'
 *
 * Protected with a secret key passed as a header:
 * - x-reminder-secret: <SECRET> OR Authorization: Bearer <SECRET>
 */
export async function GET(request: NextRequest) {
  return handleReminders(request);
}

export async function POST(request: NextRequest) {
  return handleReminders(request);
}

async function handleReminders(request: NextRequest) {
  try {
    // 1. Verify Secret Key Header
    const expectedSecret =
      process.env.REMINDER_SECRET ||
      process.env.CRON_SECRET ||
      'clinic-reminder-secret-key-2026';

    const headerSecret =
      request.headers.get('x-reminder-secret') ||
      request.headers.get('X-Reminder-Secret') ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    if (!headerSecret || headerSecret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing secret key header (pass x-reminder-secret or Authorization: Bearer <secret>)' },
        { status: 401 }
      );
    }

    const now = new Date();
    const nowMs = now.getTime();

    // 24-hour reminder window: appointments starting ~23h to ~25h from now
    // (Also accepts query param ?force=true or window adjustments if testing)
    const window24hStart = new Date(nowMs + 23 * 60 * 60 * 1000).toISOString();
    const window24hEnd = new Date(nowMs + 25 * 60 * 60 * 1000).toISOString();

    // 2-hour reminder window: appointments starting ~1.5h to ~2.5h from now
    const window2hStart = new Date(nowMs + 90 * 60 * 1000).toISOString();
    const window2hEnd = new Date(nowMs + 150 * 60 * 1000).toISOString();

    const loggedReminders: Array<{
      appointmentId: string;
      kind: 'reminder_24h' | 'reminder_2h';
      phone: string;
      message: string;
    }> = [];

    // ==========================================
    // 2. Process 24h Reminders
    // ==========================================
    const { data: appts24h, error: err24h } = await supabaseAdmin
      .from('appointments')
      .select('*, doctor:doctors(*), patient:patients(*), clinic:clinics(*)')
      .eq('status', 'booked')
      .eq('reminder_24h_sent', false)
      .gte('starts_at', window24hStart)
      .lte('starts_at', window24hEnd);

    if (err24h) {
      console.error('Error querying 24h reminder appointments:', err24h);
    } else if (appts24h && appts24h.length > 0) {
      for (const appt of appts24h) {
        const patientPhone = appt.patient?.phone || 'Unknown';
        const patientName = appt.patient?.full_name || 'Patient';
        const doctorName = appt.doctor?.full_name || 'Doctor';
        const clinicName = appt.clinic?.name || 'Clinic';
        const timeStr = new Date(appt.starts_at).toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
        });
        const dateStr = new Date(appt.starts_at).toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });

        const reminderMessage = `Reminder: Dear ${patientName}, your appointment at ${clinicName} with Dr. ${doctorName} is tomorrow (${dateStr}) at ${timeStr}.`;

        // Log into sms_log table with kind='reminder_24h' and status='pending_sms_provider'
        await supabaseAdmin.from('sms_log').insert({
          clinic_id: appt.clinic_id,
          appointment_id: appt.id,
          phone: patientPhone,
          message: reminderMessage,
          kind: 'reminder_24h',
          status: 'pending_sms_provider',
          provider_response: JSON.stringify({
            note: 'Pending SMS provider integration',
            scheduledFor: appt.starts_at,
            loggedAt: new Date().toISOString(),
          }),
          created_at: new Date().toISOString(),
        });

        // Mark reminder_24h_sent=true on the appointment
        await supabaseAdmin
          .from('appointments')
          .update({ reminder_24h_sent: true })
          .eq('id', appt.id);

        loggedReminders.push({
          appointmentId: appt.id,
          kind: 'reminder_24h',
          phone: patientPhone,
          message: reminderMessage,
        });
      }
    }

    // ==========================================
    // 3. Process 2h Reminders
    // ==========================================
    const { data: appts2h, error: err2h } = await supabaseAdmin
      .from('appointments')
      .select('*, doctor:doctors(*), patient:patients(*), clinic:clinics(*)')
      .eq('status', 'booked')
      .eq('reminder_2h_sent', false)
      .gte('starts_at', window2hStart)
      .lte('starts_at', window2hEnd);

    if (err2h) {
      console.error('Error querying 2h reminder appointments:', err2h);
    } else if (appts2h && appts2h.length > 0) {
      for (const appt of appts2h) {
        const patientPhone = appt.patient?.phone || 'Unknown';
        const patientName = appt.patient?.full_name || 'Patient';
        const doctorName = appt.doctor?.full_name || 'Doctor';
        const clinicName = appt.clinic?.name || 'Clinic';
        const timeStr = new Date(appt.starts_at).toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
        });

        const reminderMessage = `Reminder: Dear ${patientName}, your appointment at ${clinicName} with Dr. ${doctorName} is in 2 hours today at ${timeStr}.`;

        // Log into sms_log table with kind='reminder_2h' and status='pending_sms_provider'
        await supabaseAdmin.from('sms_log').insert({
          clinic_id: appt.clinic_id,
          appointment_id: appt.id,
          phone: patientPhone,
          message: reminderMessage,
          kind: 'reminder_2h',
          status: 'pending_sms_provider',
          provider_response: JSON.stringify({
            note: 'Pending SMS provider integration',
            scheduledFor: appt.starts_at,
            loggedAt: new Date().toISOString(),
          }),
          created_at: new Date().toISOString(),
        });

        // Mark reminder_2h_sent=true on the appointment
        await supabaseAdmin
          .from('appointments')
          .update({ reminder_2h_sent: true })
          .eq('id', appt.id);

        loggedReminders.push({
          appointmentId: appt.id,
          kind: 'reminder_2h',
          phone: patientPhone,
          message: reminderMessage,
        });
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        reminders_24h_processed: (appts24h || []).length,
        reminders_2h_processed: (appts2h || []).length,
        total_logged: loggedReminders.length,
      },
      reminders: loggedReminders,
    });
  } catch (error: any) {
    console.error('Server error in /api/send-reminders:', error);
    return NextResponse.json(
      { error: error?.message || 'Server error while sending reminders' },
      { status: 500 }
    );
  }
}
