export interface Clinic {
  id: string;
  name: string;
  phone: string | null;
  timezone: string;
  created_at: string;
}

export interface Staff {
  id: string;
  clinic_id: string;
  full_name: string;
  role: string;
  created_at: string;
}

export interface Doctor {
  id: string;
  clinic_id: string;
  full_name: string;
  department: string | null;
  slot_minutes: number;
  work_days: number[]; // 1 = Monday ... 7 = Sunday
  start_time: string; // "08:00:00" or "08:00"
  end_time: string; // "17:00:00" or "17:00"
  active: boolean;
  created_at: string;
}

export interface Patient {
  id: string;
  clinic_id: string;
  full_name: string;
  phone: string;
  notes?: string | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  clinic_id: string;
  doctor_id: string;
  patient_id: string;
  starts_at: string;
  ends_at: string;
  status: 'booked' | 'attended' | 'missed' | 'cancelled' | 'completed';
  reminder_24h_sent: boolean;
  reminder_2h_sent: boolean;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  // Joined helper fields
  doctor?: Doctor;
  patient?: Patient;
}

export interface SmsLog {
  id: string;
  clinic_id: string;
  appointment_id?: string | null;
  phone: string;
  message: string;
  kind: string;
  status: string;
  provider_response?: string | null;
  created_at: string;
}

export interface TimeSlot {
  startTime: string; // "08:30"
  endTime: string; // "09:00"
  startsAtIso: string;
  endsAtIso: string;
  displayLabel: string;
  available: boolean;
}

export const DAYS_OF_WEEK = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
  { value: 7, label: 'Sunday', short: 'Sun' },
] as const;

export function formatWorkDays(days: number[] | null | undefined): string {
  if (!days || days.length === 0) return 'No days set';
  const sorted = [...days].sort((a, b) => a - b);
  const dayMap = new Map<number, string>(DAYS_OF_WEEK.map((d) => [d.value, d.short]));
  return sorted.map((d) => dayMap.get(d) ?? `Day ${d}`).join(', ');
}

export function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return '--:--';
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes} ${ampm}`;
  }
  return timeStr;
}

export function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return '--';
  const date = new Date(isoString);
  return date.toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
