import 'server-only';

import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Afro Message SMS integration (server-only).
 *
 * Required environment variables (never prefix with NEXT_PUBLIC_):
 * - AFRO_MESSAGE_API_KEY   : API token from the Afro Message dashboard
 * - AFRO_MESSAGE_SENDER_ID : Identifier ID (sent as the `from` field)
 *
 * The `server-only` import above makes the build fail if this module is ever
 * imported from a Client Component, so the API key can't leak to the browser.
 */

const AFRO_MESSAGE_SEND_URL = 'https://api.afromessage.com/api/send';
const REQUEST_TIMEOUT_MS = 15_000;

export type SmsKind = 'confirmation' | 'reminder_24h' | 'reminder_2h';

export interface SendSmsResult {
  success: boolean;
  /** Raw (parsed if JSON) response body from Afro Message, or error details. */
  providerResponse: unknown;
  error?: string;
}

export function formatPhoneNumber(phone: string): string {
  return phone.replace(/[\s\-\(\)]/g, '');
}

/**
 * Sends a single SMS through Afro Message.
 * Never throws — failures are returned as `{ success: false, ... }`.
 */
export async function sendSms(phone: string, message: string): Promise<SendSmsResult> {
  const apiKey =
    process.env.AFRO_MESSAGE_API_KEY ||
    process.env.AFROMESSAGE_API_KEY;
  const senderId =
    process.env.AFRO_MESSAGE_SENDER_ID ||
    process.env.AFROMESSAGE_SENDER_ID ||
    process.env.AFROMESSAGE_FROM_ID ||
    process.env.AFROMESSAGE_SENDER_NAME;

  if (!apiKey) {
    console.error('[sms] AFRO_MESSAGE_API_KEY is not configured in environment variables');
    return {
      success: false,
      error: 'AFRO_MESSAGE_API_KEY is not configured',
      providerResponse: {
        error: 'AFRO_MESSAGE_API_KEY is not configured',
        checkedEnv: ['AFRO_MESSAGE_API_KEY', 'AFROMESSAGE_API_KEY'],
      },
    };
  }

  const to = formatPhoneNumber(phone || '');
  if (!to) {
    return {
      success: false,
      error: 'Missing recipient phone number',
      providerResponse: { error: 'Missing recipient phone number', phoneInput: phone },
    };
  }
  if (!message?.trim()) {
    return {
      success: false,
      error: 'Message is empty',
      providerResponse: { error: 'Message is empty' },
    };
  }

  try {
    const body: Record<string, string> = { to, message };
    if (senderId) body.from = senderId;

    console.log(`[sms] Sending Afro Message SMS to ${to} (senderId: ${senderId || 'default'})`);

    const res = await fetch(AFRO_MESSAGE_SEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const rawText = await res.text();
    let parsed: any = rawText;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // Non-JSON body; keep raw text
    }

    // Afro Message responds with { acknowledge: 'success' | 'error', response: {...} }
    const acknowledged =
      parsed && typeof parsed === 'object' && String(parsed.acknowledge).toLowerCase() === 'success';

    // Build complete provider response capturing all fields returned by Afro Message
    const fullProviderResponse =
      typeof parsed === 'object' && parsed !== null
        ? { httpStatus: res.status, ...parsed }
        : { httpStatus: res.status, rawText: String(parsed) };

    if (res.ok && acknowledged) {
      console.log(`[sms] Afro Message accepted SMS for ${to}:`, JSON.stringify(fullProviderResponse));
      return { success: true, providerResponse: fullProviderResponse };
    }

    const providerErrors =
      parsed && typeof parsed === 'object'
        ? parsed?.response?.errors ?? parsed?.response?.message ?? parsed?.message
        : undefined;

    const detailedError = `Afro Message rejected the request (HTTP ${res.status})${
      providerErrors ? `: ${typeof providerErrors === 'string' ? providerErrors : JSON.stringify(providerErrors)}` : ''
    }`;

    console.error(`[sms] Afro Message rejection details for ${to}:`, JSON.stringify(fullProviderResponse));

    return {
      success: false,
      error: detailedError,
      providerResponse: fullProviderResponse,
    };
  } catch (err: any) {
    const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    const errorMessage = isTimeout
      ? `Afro Message request timed out after ${REQUEST_TIMEOUT_MS}ms`
      : err?.message || 'Network error while calling Afro Message';

    console.error(`[sms] Network/call error to Afro Message for ${to}:`, errorMessage);

    return {
      success: false,
      error: errorMessage,
      providerResponse: {
        error: errorMessage,
        exceptionName: err?.name,
        stack: err?.stack,
      },
    };
  }
}

/**
 * Sends an SMS and records the attempt (success or failure) in sms_log.
 * Never throws, so callers can fire it after a booking without risking the booking.
 */
export async function sendAndLogSms(params: {
  clinicId: string;
  appointmentId?: string | null;
  phone: string;
  message: string;
  kind: SmsKind;
}): Promise<SendSmsResult> {
  let result: SendSmsResult;
  try {
    result = await sendSms(params.phone, params.message);
  } catch (err: any) {
    // sendSms shouldn't throw, but guard anyway
    result = {
      success: false,
      error: err?.message || 'Unexpected SMS error',
      providerResponse: { error: err?.message || 'Unexpected SMS error' },
    };
  }

  if (!result.success) {
    console.error(`[sms] ${params.kind} SMS to ${params.phone} failed:`, result.error);
  }

  try {
    const { error: logError } = await supabaseAdmin.from('sms_log').insert({
      clinic_id: params.clinicId,
      appointment_id: params.appointmentId ?? null,
      phone: params.phone || '',
      message: params.message,
      kind: params.kind,
      status: result.success ? 'sent' : 'failed',
      provider_response: safeStringify(result.providerResponse),
      created_at: new Date().toISOString(),
    });
    if (logError) {
      console.error('[sms] Failed to write sms_log entry:', logError.message);
    }
  } catch (err: any) {
    console.error('[sms] Failed to write sms_log entry:', err?.message || err);
  }

  return result;
}

export function buildConfirmationMessage(p: {
  patientName?: string;
  clinicName: string;
  doctorName: string;
  date: string;
  time: string;
}): string {
  const greeting = p.patientName ? `Dear ${p.patientName}, your` : 'Your';
  return `${greeting} appointment at ${p.clinicName} with Dr. ${p.doctorName} is confirmed for ${p.date} at ${p.time}.`;
}

/**
 * Formats an ISO timestamp as date/time strings in the clinic's timezone
 * (server TZ may differ from the clinic's, e.g. on Vercel it's UTC).
 */
export function formatAppointmentDateTime(
  iso: string,
  timeZone?: string | null
): { date: string; time: string } {
  const d = new Date(iso);
  const tz = timeZone || 'Africa/Addis_Ababa';
  const fmt = (opts: Intl.DateTimeFormatOptions) => {
    try {
      return d.toLocaleString('en-US', { ...opts, timeZone: tz });
    } catch {
      return d.toLocaleString('en-US', opts); // invalid timezone fallback
    }
  };
  return {
    date: fmt({ weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
    time: fmt({ hour: '2-digit', minute: '2-digit' }),
  };
}

function safeStringify(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Legacy hook used by the cancel/reschedule flows. Those notifications are not
 * part of the Afro Message rollout yet, so this remains a no-op for non-confirmation
 * kinds. Confirmation sends go through sendAndLogSms directly.
 */
export async function sendAppointmentSms(params: {
  clinicId?: string;
  appointmentId?: string | null;
  phone?: string;
  patientName?: string;
  clinicName?: string;
  doctorName?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  kind?: 'confirmation' | 'reschedule' | 'cancellation' | string;
  customMessage?: string;
  [key: string]: any;
}): Promise<SendSmsResult | void> {
  if (params.kind !== 'confirmation' || !params.clinicId || !params.phone) return;
  return sendAndLogSms({
    clinicId: params.clinicId,
    appointmentId: params.appointmentId,
    phone: params.phone,
    kind: 'confirmation',
    message:
      params.customMessage ||
      buildConfirmationMessage({
        patientName: params.patientName,
        clinicName: params.clinicName || 'the clinic',
        doctorName: params.doctorName || 'your doctor',
        date: params.appointmentDate || '',
        time: params.appointmentTime || '',
      }),
  });
}

// Alias for compatibility
export const sendAfroMessageSms = sendAppointmentSms;
