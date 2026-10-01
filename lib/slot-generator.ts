import { Doctor, Appointment, TimeSlot, DAYS_OF_WEEK } from './types';

export interface SlotGenerationResult {
  isWorkDay: boolean;
  dayName: string;
  reason?: string;
  allSlots: TimeSlot[];
  freeSlots: TimeSlot[];
}

/**
 * Generates consultation time slots for a given doctor and date.
 * Validates doctor's work_days (1=Mon ... 7=Sun), iterates start_time to end_time
 * using slot_minutes, and excludes any slot overlapping with an existing 'booked' appointment.
 */
export function generateDoctorSlots(
  doctor: Doctor,
  dateStr: string, // "YYYY-MM-DD"
  bookedAppointments: Appointment[] = [],
  excludeAppointmentId?: string
): SlotGenerationResult {
  if (!dateStr) {
    return {
      isWorkDay: false,
      dayName: '',
      reason: 'No date selected',
      allSlots: [],
      freeSlots: [],
    };
  }

  // Parse YYYY-MM-DD
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const jsDay = dateObj.getDay(); // 0 (Sun) to 6 (Sat)
  const isoDay = jsDay === 0 ? 7 : jsDay; // 1 (Mon) to 7 (Sun)

  const dayInfo = DAYS_OF_WEEK.find((d) => d.value === isoDay);
  const dayName = dayInfo?.label || `Day ${isoDay}`;

  // 1. Check if doctor works on this day
  const worksOnDay = Array.isArray(doctor.work_days) && doctor.work_days.includes(isoDay);
  if (!worksOnDay) {
    return {
      isWorkDay: false,
      dayName,
      reason: `Dr. ${doctor.full_name} does not have clinic hours on ${dayName}s.`,
      allSlots: [],
      freeSlots: [],
    };
  }

  // 2. Parse start and end times
  const cleanTime = (t: string | undefined, def: string) => (t ? t.slice(0, 5) : def);
  const [startH, startM] = cleanTime(doctor.start_time, '08:00').split(':').map(Number);
  const [endH, endM] = cleanTime(doctor.end_time, '17:00').split(':').map(Number);

  let currentMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;
  const slotDuration = doctor.slot_minutes && doctor.slot_minutes > 0 ? doctor.slot_minutes : 20;

  if (endMin <= currentMin) {
    return {
      isWorkDay: true,
      dayName,
      reason: `Schedule configuration error: Doctor's end time (${doctor.end_time}) must be after start time (${doctor.start_time}).`,
      allSlots: [],
      freeSlots: [],
    };
  }

  // Filter only 'booked' appointments for this doctor (excluding the appointment being rescheduled if provided)
  const activeBookings = bookedAppointments.filter(
    (appt) =>
      appt.status === 'booked' &&
      appt.doctor_id === doctor.id &&
      (!excludeAppointmentId || appt.id !== excludeAppointmentId)
  );

  const allSlots: TimeSlot[] = [];
  const freeSlots: TimeSlot[] = [];

  while (currentMin + slotDuration <= endMin) {
    const slotStartH = Math.floor(currentMin / 60);
    const slotStartM = currentMin % 60;
    const slotEndH = Math.floor((currentMin + slotDuration) / 60);
    const slotEndM = (currentMin + slotDuration) % 60;

    const startStr = `${String(slotStartH).padStart(2, '0')}:${String(slotStartM).padStart(2, '0')}`;
    const endStr = `${String(slotEndH).padStart(2, '0')}:${String(slotEndM).padStart(2, '0')}`;

    // Construct local Date objects and ISO strings
    const slotStartDate = new Date(year, month - 1, day, slotStartH, slotStartM, 0, 0);
    const slotEndDate = new Date(year, month - 1, day, slotEndH, slotEndM, 0, 0);

    const slotStartMs = slotStartDate.getTime();
    const slotEndMs = slotEndDate.getTime();

    // Check overlap with existing booked appointments
    const hasConflict = activeBookings.some((appt) => {
      const apptStartMs = new Date(appt.starts_at).getTime();
      const apptEndMs = new Date(appt.ends_at).getTime();
      return slotStartMs < apptEndMs && slotEndMs > apptStartMs;
    });

    // Format display label
    const formatHourDisplay = (h: number, m: number) => {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayH = h % 12 || 12;
      return `${displayH}:${String(m).padStart(2, '0')} ${ampm}`;
    };

    const displayLabel = `${formatHourDisplay(slotStartH, slotStartM)} - ${formatHourDisplay(slotEndH, slotEndM)}`;

    const slot: TimeSlot = {
      startTime: startStr,
      endTime: endStr,
      startsAtIso: slotStartDate.toISOString(),
      endsAtIso: slotEndDate.toISOString(),
      displayLabel,
      available: !hasConflict,
    };

    allSlots.push(slot);
    if (!hasConflict) {
      freeSlots.push(slot);
    }

    currentMin += slotDuration;
  }

  return {
    isWorkDay: true,
    dayName,
    allSlots,
    freeSlots,
  };
}
