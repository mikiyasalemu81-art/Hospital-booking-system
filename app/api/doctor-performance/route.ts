import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStaff } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase/admin';

interface DoctorPerformanceRow {
  doctor_id: string;
  doctor_name: string;
  department: string | null;
  active: boolean;
  total: number;
  booked: number;
  attended: number;
  missed: number;
  cancelled: number;
  noShowRate: number; // percentage 0-100 (missed / total)
}

/**
 * GET /api/doctor-performance?from=<ISO>&to=<ISO>
 *
 * Returns per-doctor appointment performance for the logged-in staff's clinic:
 * total, attended, missed, cancelled, still-booked, and a no-show rate
 * (missed / total). Every doctor in the clinic is included, even with zero
 * appointments in the window.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedStaff(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clinicId = auth.staff.clinic_id;
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // 1. All doctors for this clinic (kept even when inactive so nobody is hidden)
    const { data: doctors, error: doctorsError } = await supabaseAdmin
      .from('doctors')
      .select('id, full_name, department, active')
      .eq('clinic_id', clinicId)
      .order('full_name', { ascending: true });

    if (doctorsError) {
      return NextResponse.json({ error: doctorsError.message }, { status: 500 });
    }

    // 2. Appointments in the requested window (only the columns needed)
    let apptQuery = supabaseAdmin
      .from('appointments')
      .select('doctor_id, status')
      .eq('clinic_id', clinicId)
      .limit(10000);

    if (from) apptQuery = apptQuery.gte('starts_at', from);
    if (to) apptQuery = apptQuery.lte('starts_at', to);

    const { data: appointments, error: apptError } = await apptQuery;

    if (apptError) {
      return NextResponse.json({ error: apptError.message }, { status: 500 });
    }

    // 3. Seed a row for every doctor so zero-activity doctors still appear
    const byDoctor = new Map<string, DoctorPerformanceRow>();
    for (const doc of doctors || []) {
      byDoctor.set(doc.id, {
        doctor_id: doc.id,
        doctor_name: doc.full_name,
        department: doc.department,
        active: doc.active,
        total: 0,
        booked: 0,
        attended: 0,
        missed: 0,
        cancelled: 0,
        noShowRate: 0,
      });
    }

    // 4. Tally each appointment into its doctor's row
    for (const appt of appointments || []) {
      const row = byDoctor.get(appt.doctor_id);
      if (!row) continue; // defensive: appointment not tied to a clinic doctor

      row.total += 1;
      const status = String(appt.status || '').toLowerCase().trim();
      if (status === 'attended' || status === 'completed') row.attended += 1;
      else if (status === 'missed') row.missed += 1;
      else if (status === 'cancelled') row.cancelled += 1;
      else if (status === 'booked') row.booked += 1;
    }

    const rows = Array.from(byDoctor.values()).map((row) => ({
      ...row,
      noShowRate: row.total > 0 ? Math.round((row.missed / row.total) * 1000) / 10 : 0,
    }));

    // 5. Clinic-wide totals
    const totals = rows.reduce(
      (acc, r) => ({
        total: acc.total + r.total,
        booked: acc.booked + r.booked,
        attended: acc.attended + r.attended,
        missed: acc.missed + r.missed,
        cancelled: acc.cancelled + r.cancelled,
      }),
      { total: 0, booked: 0, attended: 0, missed: 0, cancelled: 0 }
    );

    return NextResponse.json({
      rows,
      totals: {
        ...totals,
        noShowRate: totals.total > 0 ? Math.round((totals.missed / totals.total) * 1000) / 10 : 0,
      },
      range: { from: from || null, to: to || null },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
