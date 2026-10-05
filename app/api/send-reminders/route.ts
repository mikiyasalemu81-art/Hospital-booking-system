import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendAndLogSms, formatAppointmentDateTime } from '@/lib/sms';

/**
 * GET/POST /api/send-reminders
 *
 * Finds all appointments with status='booked' where:
 * - starts_at is ~24h away and reminder_24h_sent=false -> sends SMS via Afro Message, logs to sms_log with kind='reminder_24h'
 * - starts_at is ~2h away and reminder_2h_sent=false -> sends SMS via Afro Message, logs to sms_log with kind='reminder_2h'
 *
 * Every attempt (success or failure) is logged in sms_log with the provider's response.
 * The reminder_*_sent flag is only set when the SMS was accepted by the provider, so a
 * failed reminder is retried on the next run while the appointment is still in the window.
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

type ReminderKind = 'reminder_24h' | 'reminder_2h';

interface ReminderResult {
  appointmentId: string;
  kind: ReminderKind;
  phone: string;
  message: string;
  success: boolean;
  error?: string;
}

async function processReminders(
  kind: ReminderKind,
  windowStart: string,
  windowEnd: string
): Promise<{ processed: number; results: ReminderResult[] }> {
  const sentFlag = kind === 'reminder_24h' ? 'reminder_24h_sent' : 'reminder_2h_sent';

  const { data: appts, error } = await supabaseAdmin
    .from('appointments')
    .select('*, doctor:doctors(*), patient:patients(*), clinic:clinics(*)')
    .eq('status', 'booked')
    .eq(sentFlag, false)
    .gte('starts_at', windowStart)
    .lte('starts_at', windowEnd);

  if (error) {
    console.error(`Error querying ${kind} reminder appointments:`, error);
    return { processed: 0, results: [] };
  }

  const results: ReminderResult[] = [];

  for (const appt of appts || []) {
    const patientPhone: string = appt.patient?.phone || '';
    const patientName = appt.patient?.full_name || 'Patient';
    const doctorName = appt.doctor?.full_name || 'Doctor';
    const clinicName = appt.clinic?.name || 'Clinic';
    const { date: dateStr, time: timeStr } = formatAppointmentDateTime(
      appt.starts_at,
      appt.clinic?.timezone
    );

    const message =
      kind === 'reminder_24h'
        ? `Reminder: Dear ${patientName}, your appointment at ${clinicName} with Dr. ${doctorName} is tomorrow (${dateStr}) at ${timeStr}.`
        : `Reminder: Dear ${patientName}, your appointment at ${clinicName} with Dr. ${doctorName} is in 2 hours today at ${timeStr}.`;

    // Sends via Afro Message and logs the attempt to sms_log (never throws)
    const sms = await sendAndLogSms({
      clinicId: appt.clinic_id,
      appointmentId: appt.id,
      phone: patientPhone,
      message,
      kind,
    });

    if (sms.success) {
      const { error: flagError } = await supabaseAdmin
        .from('appointments')
        .update({ [sentFlag]: true })
        .eq('id', appt.id);
      if (flagError) {
        console.error(`Failed to set ${sentFlag} for appointment ${appt.id}:`, flagError.message);
      }
    }

    results.push({
      appointmentId: appt.id,
      kind,
      phone: patientPhone,
      message,
      success: sms.success,
      error: sms.error,
    });
  }

  return { processed: (appts || []).length, results };
}

async function handleReminders(request: NextRequest) {
  try {
    const isTest = request.nextUrl.searchParams.get('test') === 'true';

    // 1. Verify Secret Key Header (required for cron/production, bypassed for ?test=true verification)
    const expectedSecret =
      process.env.REMINDER_SECRET ||
      process.env.CRON_SECRET ||
      'clinic-reminder-secret-key-2026';

    const headerSecret =
      request.headers.get('x-reminder-secret') ||
      request.headers.get('X-Reminder-Secret') ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    if (!isTest && (!headerSecret || headerSecret !== expectedSecret)) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing secret key header (pass x-reminder-secret or Authorization: Bearer <secret>)' },
        { status: 401 }
      );
    }

    // 2. Test Mode: sends reminder for any 'booked' appointment regardless of real time windows
    if (isTest) {
      const { data: testAppts, error: queryError } = await supabaseAdmin
        .from('appointments')
        .select('*, doctor:doctors(*), patient:patients(*), clinic:clinics(*)')
        .eq('status', 'booked')
        .order('starts_at', { ascending: false })
        .limit(5);

      if (queryError) {
        console.error('Error querying test appointments:', queryError);
        return NextResponse.json({ error: queryError.message }, { status: 500 });
      }

      if (!testAppts || testAppts.length === 0) {
        return NextResponse.json({
          success: true,
          test_mode: true,
          timestamp: new Date().toISOString(),
          message: 'No appointments with status="booked" found in database to test reminders.',
          summary: {
            processed: 0,
            total_sent: 0,
            total_failed: 0,
          },
          reminders: [],
        });
      }

      const results: ReminderResult[] = [];

      for (const appt of testAppts) {
        const patientPhone: string = appt.patient?.phone || '';
        const patientName = appt.patient?.full_name || 'Patient';
        const doctorName = appt.doctor?.full_name || 'Doctor';
        const clinicName = appt.clinic?.name || 'Clinic';
        const { date: dateStr, time: timeStr } = formatAppointmentDateTime(
          appt.starts_at,
          appt.clinic?.timezone
        );

        const message = `Reminder (Test): Dear ${patientName}, your appointment at ${clinicName} with Dr. ${doctorName} is scheduled for ${dateStr} at ${timeStr}.`;

        const sms = await sendAndLogSms({
          clinicId: appt.clinic_id,
          appointmentId: appt.id,
          phone: patientPhone,
          message,
          kind: 'reminder_24h',
        });

        results.push({
          appointmentId: appt.id,
          kind: 'reminder_24h',
          phone: patientPhone,
          message,
          success: sms.success,
          error: sms.error,
        });
      }

      return NextResponse.json({
        success: true,
        test_mode: true,
        timestamp: new Date().toISOString(),
        summary: {
          processed: results.length,
          total_sent: results.filter((r) => r.success).length,
          total_failed: results.filter((r) => !r.success).length,
        },
        reminders: results,
      });
    }

    const nowMs = Date.now();

    // 24-hour reminder window: appointments starting ~23h to ~25h from now
    const window24hStart = new Date(nowMs + 23 * 60 * 60 * 1000).toISOString();
    const window24hEnd = new Date(nowMs + 25 * 60 * 60 * 1000).toISOString();

    // 2-hour reminder window: appointments starting ~1.5h to ~2.5h from now
    const window2hStart = new Date(nowMs + 90 * 60 * 1000).toISOString();
    const window2hEnd = new Date(nowMs + 150 * 60 * 1000).toISOString();

    // 3. Process 24h Reminders
    const r24 = await processReminders('reminder_24h', window24hStart, window24hEnd);

    // 4. Process 2h Reminders
    const r2 = await processReminders('reminder_2h', window2hStart, window2hEnd);

    const all = [...r24.results, ...r2.results];

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        reminders_24h_processed: r24.processed,
        reminders_2h_processed: r2.processed,
        total_sent: all.filter((r) => r.success).length,
        total_failed: all.filter((r) => !r.success).length,
      },
      reminders: all,
    });
  } catch (error: any) {
    console.error('Server error in /api/send-reminders:', error);
    return NextResponse.json(
      { error: error?.message || 'Server error while sending reminders' },
      { status: 500 }
    );
  }
}
