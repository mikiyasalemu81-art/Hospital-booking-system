/**
 * Empty placeholder function for SMS-sending.
 * The SMS provider will be wired in next.
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
}): Promise<void> {
  // Empty placeholder function for now — SMS provider will be wired in next.
}

// Aliases for compatibility
export const sendAfroMessageSms = sendAppointmentSms;
export function formatPhoneNumber(phone: string): string {
  return phone.replace(/[\s\-\(\)]/g, '');
}
