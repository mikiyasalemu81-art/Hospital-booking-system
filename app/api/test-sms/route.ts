import { NextRequest, NextResponse } from 'next/server';
import { sendSms, normalizePhoneNumber } from '@/lib/sms';

export async function GET(request: NextRequest) {
  return handleTestSms(request);
}

export async function POST(request: NextRequest) {
  return handleTestSms(request);
}

async function handleTestSms(request: NextRequest) {
  // 1. Verify Secret Key Header (matching /api/send-reminders)
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

  // 2. Extract recipient phone
  let to = request.nextUrl.searchParams.get('to');
  if (!to && request.method === 'POST') {
    try {
      const body = await request.json();
      to = body.to || body.phone;
    } catch {
      // ignore
    }
  }

  if (!to || !to.trim()) {
    return NextResponse.json(
      { error: 'Missing recipient phone number. Please provide ?to=PHONE' },
      { status: 400 }
    );
  }

  const normalizedTo = normalizePhoneNumber(to.trim());
  const testMessage = `Test SMS from ClinicHub via Afro Message: your integration is working properly! (Timestamp: ${new Date().toISOString()})`;

  // 3. Await sendSms call (server-only)
  const result = await sendSms(normalizedTo, testMessage);

  return NextResponse.json({
    success: result.success,
    to: normalizedTo,
    error: result.error || null,
    providerResponse: result.providerResponse,
  });
}
