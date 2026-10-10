import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Afro Message SMS integration (server-only).
 *
 * Reads configuration from:
 * 1. process.env
 * 2. Root .env / .env.local file (outside the published build folder)
 * 3. Project .env / .env.local
 *
 * Required environment variables:
 * - AFRO_MESSAGE_API_KEY   : API token from the Afro Message dashboard
 * - AFRO_MESSAGE_SENDER_ID : Identifier ID (sent as the `from` field)
 */

function loadRootEnvIfMissing(): void {
  if (process.env.AFRO_MESSAGE_API_KEY || process.env.AFROMESSAGE_API_KEY) {
    return;
  }

  // Look for .env in parent directories (root outside project) and current project directory
  const candidateDirs = [
    path.resolve(process.cwd(), '..'), // root outside clinic-booking
    process.cwd(),
    path.resolve(__dirname, '..'),
    path.resolve(__dirname, '..', '..'),
    path.resolve(__dirname, '..', '..', '..'),
  ];

  const candidateFiles = ['.env', '.env.local', '.env.production'];

  for (const dir of candidateDirs) {
    for (const file of candidateFiles) {
      try {
        const fullPath = path.join(/*turbopackIgnore: true*/ dir, file);
        if (fs.existsSync(/*turbopackIgnore: true*/ fullPath)) {
          const content = fs.readFileSync(/*turbopackIgnore: true*/ fullPath, 'utf8');
          const lines = content.split(/\r?\n/);
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx > 0) {
              const key = trimmed.slice(0, eqIdx).trim();
              let val = trimmed.slice(eqIdx + 1).trim();
              if (
                (val.startsWith('"') && val.endsWith('"')) ||
                (val.startsWith("'") && val.endsWith("'"))
              ) {
                val = val.slice(1, -1);
              }
              if (!process.env[key] && val) {
                process.env[key] = val;
              }
            }
          }
          if (process.env.AFRO_MESSAGE_API_KEY || process.env.AFROMESSAGE_API_KEY) {
            console.log(`[sms] Successfully loaded Afro Message config from ${fullPath}`);
            return;
          }
        }
      } catch {
        // Ignore read errors and check next candidate
      }
    }
  }
}

// Auto-run once on module import
loadRootEnvIfMissing();

const AFRO_MESSAGE_SEND_URL = 'https://api.afromessage.com/api/send';
const REQUEST_TIMEOUT_MS = 15_000;

export type SmsKind = 'confirmation' | 'reminder_24h' | 'reminder_2h';

export interface SendSmsResult {
  success: boolean;
  /** Raw (parsed if JSON) response body from Afro Message, or error details. */
  providerResponse: unknown;
  error?: string;
}

export function normalizePhoneNumber(phone: string): string {
  let cleaned = (phone || '').replace(/[\s\-\(\)\.]/g, '');
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1);
  }
  // 09XXXXXXXX or 07XXXXXXXX (10 digits starting with 0)
  if (/^0([97]\d{8})$/.test(cleaned)) {
    return '+251' + cleaned.slice(1);
  }
  // 9XXXXXXXX or 7XXXXXXXX (9 digits starting with 9 or 7)
  if (/^([97]\d{8})$/.test(cleaned)) {
    return '+251' + cleaned;
  }
  // 2519XXXXXXXX or 2517XXXXXXXX (12 digits)
  if (/^251([97]\d{8})$/.test(cleaned)) {
    return '+' + cleaned;
  }
  // General international or standard digits fallback
  if (/^\d{9,15}$/.test(cleaned)) {
    return '+' + cleaned;
  }
  return cleaned ? (cleaned.startsWith('+') ? cleaned : '+' + cleaned) : '';
}

export const formatPhoneNumber = normalizePhoneNumber;

/**
 * Sends a single SMS through Afro Message.
 * Never throws — failures are returned as `{ success: false, ... }`.
 */
export async function sendSms(phone: string, message: string): Promise<SendSmsResult> {
  loadRootEnvIfMissing();

  const apiKey =
    process.env.AFRO_MESSAGE_API_KEY ||
    process.env.AFROMESSAGE_API_KEY;
  const senderId =
    process.env.AFRO_MESSAGE_SENDER_ID ||
    process.env.AFROMESSAGE_SENDER_ID ||
    process.env.AFROMESSAGE_FROM_ID;
  const senderName =
    process.env.AFRO_MESSAGE_SENDER_NAME ||
    process.env.AFROMESSAGE_SENDER_NAME;

  if (!apiKey) {
    console.error('[sms] AFRO_MESSAGE_API_KEY is not configured in environment variables');
    return {
      success: false,
      error: 'AFRO_MESSAGE_API_KEY is not configured',
      providerResponse: {
        httpStatus: 0,
        error: 'AFRO_MESSAGE_API_KEY is not configured',
        checkedEnv: ['AFRO_MESSAGE_API_KEY', 'AFROMESSAGE_API_KEY'],
      },
    };
  }

  const to = normalizePhoneNumber(phone || '');
  if (!to) {
    return {
      success: false,
      error: 'Missing recipient phone number',
      providerResponse: { httpStatus: 0, error: 'Missing recipient phone number', phoneInput: phone },
    };
  }
  if (!message?.trim()) {
    return {
      success: false,
      error: 'Message is empty',
      providerResponse: { httpStatus: 0, error: 'Message is empty' },
    };
  }

  try {
    const body: Record<string, string> = { to, message: message.trim() };
    if (senderId && senderId.trim()) {
      body.from = senderId.trim();
    }
    // Include sender (sender name) ONLY if approved on account / configured in env
    if (senderName && senderName.trim()) {
      body.sender = senderName.trim();
    }

    console.log(`[sms] Sending Afro Message SMS to ${to} (from: ${senderId || 'default'}, sender: ${senderName || 'none'})`);

    const res = await fetch(AFRO_MESSAGE_SEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
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

    const providerErrors =
      parsed && typeof parsed === 'object'
        ? parsed?.response?.errors ?? parsed?.response?.message ?? parsed?.message
        : undefined;

    let hasProviderError = false;
    if (parsed && typeof parsed === 'object') {
      if (String(parsed.acknowledge).toLowerCase() === 'error') {
        hasProviderError = true;
      }
      if (parsed.error || parsed.errors || (parsed.response && (parsed.response.errors || parsed.response.error))) {
        hasProviderError = true;
      }
    }

    let errorDetail = '';
    if (Array.isArray(providerErrors)) {
      errorDetail = providerErrors.join('; ');
    } else if (typeof providerErrors === 'string') {
      errorDetail = providerErrors;
    } else if (providerErrors) {
      errorDetail = JSON.stringify(providerErrors);
    }

    // Capture complete HTTP status and raw provider response
    const fullProviderResponse = {
      httpStatus: res.status,
      errorDetail: errorDetail || undefined,
      rawResponse: parsed,
    };

    if (res.ok && acknowledged && !hasProviderError) {
      console.log(`[sms] Afro Message accepted SMS for ${to}:`, JSON.stringify(fullProviderResponse));
      return { success: true, providerResponse: fullProviderResponse };
    }

    const detailedError = `Afro Message rejected the request (HTTP ${res.status})${
      errorDetail ? `: ${errorDetail}` : ''
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

    const fullProviderResponse = {
      httpStatus: 0,
      error: errorMessage,
      exceptionName: err?.name,
      stack: err?.stack,
    };

    return {
      success: false,
      error: errorMessage,
      providerResponse: fullProviderResponse,
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
    result = {
      success: false,
      error: err?.message || 'Unexpected SMS error',
      providerResponse: { httpStatus: 0, error: err?.message || 'Unexpected SMS error' },
    };
  }

  if (!result.success) {
    console.error(`[sms] ${params.kind} SMS to ${params.phone} failed:`, result.error);
  }

  try {
    const providerResponseToStore = safeStringify(result.providerResponse);
    const { error: logError } = await supabaseAdmin.from('sms_log').insert({
      clinic_id: params.clinicId,
      appointment_id: params.appointmentId ?? null,
      phone: normalizePhoneNumber(params.phone || ''),
      message: params.message,
      kind: params.kind,
      status: result.success ? 'sent' : 'failed',
      provider_response: providerResponseToStore,
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

export interface ConfirmationMessageParams {
  patientName?: string;
  clinicName: string;
  doctorName: string;
  department?: string | null;
  careType?: string | null;
  date: string;
  time: string;
  clinicPhone?: string | null;
}

export function buildConfirmationMessage(p: ConfirmationMessageParams): string {
  const patient = p.patientName?.trim() || 'Valued Patient';
  const doctor = p.doctorName.startsWith('Dr.') ? p.doctorName : `Dr. ${p.doctorName}`;
  const care = p.careType?.trim() || p.department?.trim() || 'Medical Consultation';
  const phoneNotice = p.clinicPhone?.trim() ? ` Questions: call ${p.clinicPhone.trim()}.` : '';

  return `Dear ${patient}, your ${care} appointment at ${p.clinicName} with ${doctor} is confirmed for ${p.date} at ${p.time}. Please arrive 10 min early.${phoneNotice}`;
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
        department: params.department,
        careType: params.careType || params.department,
        clinicPhone: params.clinicPhone,
        date: params.appointmentDate || '',
        time: params.appointmentTime || '',
      }),
  });
}

// Alias for compatibility
export const sendAfroMessageSms = sendAppointmentSms;
