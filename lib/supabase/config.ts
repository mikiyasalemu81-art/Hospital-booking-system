/**
 * Centralised Supabase configuration.
 *
 * NEXT_PUBLIC_* variables are inlined into the browser bundle at BUILD time.
 * On Vercel, they must be set under Project → Settings → Environment Variables
 * BEFORE the build runs; changing them later requires a redeploy.
 */

const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'placeholder-key';

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const rawAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/** True only when both public Supabase env vars are present and well-formed. */
export const isSupabaseConfigured = isValidHttpUrl(rawUrl) && rawAnonKey.length > 0;

/** Safe values for client construction (placeholders keep builds from crashing). */
export const supabaseUrl = isSupabaseConfigured ? rawUrl.replace(/\/+$/, '') : PLACEHOLDER_URL;
export const supabaseAnonKey = isSupabaseConfigured ? rawAnonKey : PLACEHOLDER_KEY;

export const SUPABASE_NOT_CONFIGURED_MESSAGE =
  'Sign-in is temporarily unavailable: the app is not connected to its authentication service. ' +
  'Please contact your system administrator.';

/**
 * Convert raw Supabase / fetch errors into clear, user-facing messages.
 */
export function friendlyAuthError(err: unknown): string {
  if (!isSupabaseConfigured) return SUPABASE_NOT_CONFIGURED_MESSAGE;

  const message =
    typeof err === 'string'
      ? err
      : err && typeof err === 'object' && 'message' in err
        ? String((err as { message?: unknown }).message ?? '')
        : '';
  const lower = message.toLowerCase();
  const status =
    err && typeof err === 'object' && 'status' in err ? Number((err as { status?: unknown }).status) : undefined;

  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower.includes('load failed') ||
    lower.includes('fetch failed') ||
    (err instanceof TypeError && !message)
  ) {
    return 'Unable to connect to Supabase Auth. Check your internet connection. If the problem continues, ask your administrator to verify the Supabase project URL and anon key in .env.local or Vercel Environment Variables, redeploy after changes, and check the browser network console for CORS or request failures.';
  }
  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return 'Incorrect email or password. Please try again.';
  }
  if (lower.includes('email not confirmed')) {
    return 'This account’s email address has not been confirmed yet. Please contact your clinic administrator.';
  }
  if (lower.includes('rate limit') || lower.includes('too many') || status === 429) {
    return 'Too many attempts. Please wait a minute and try again.';
  }
  if (lower.includes('invalid api key') || lower.includes('no api key') || status === 401) {
    return SUPABASE_NOT_CONFIGURED_MESSAGE;
  }
  if (status && status >= 500) {
    return 'The sign-in service is temporarily unavailable. Please try again shortly.';
  }
  return message || 'Sign-in failed. Please try again.';
}
