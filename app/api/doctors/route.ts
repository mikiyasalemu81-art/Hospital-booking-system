import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStaff } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// GET /api/doctors - List all doctors for the logged-in staff's clinic
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedStaff(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('doctors')
      .select('*')
      .eq('clinic_id', auth.staff.clinic_id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ doctors: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

// POST /api/doctors - Add a new doctor for the logged-in staff's clinic
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedStaff(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { full_name, department, slot_minutes, work_days, start_time, end_time, active } = body;

    if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
      return NextResponse.json({ error: 'Doctor name is required' }, { status: 400 });
    }

    const slotMinutesNum = Number(slot_minutes);
    if (isNaN(slotMinutesNum) || slotMinutesNum <= 0) {
      return NextResponse.json({ error: 'Slot minutes must be a positive number' }, { status: 400 });
    }

    const formattedWorkDays = Array.isArray(work_days) && work_days.length > 0
      ? work_days.map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 7)
      : [1, 2, 3, 4, 5];

    // Format times ensuring HH:MM:00
    const formatTimeVal = (t: string | undefined, defaultVal: string) => {
      if (!t) return defaultVal;
      const parts = t.split(':');
      if (parts.length === 2) return `${t}:00`;
      return t;
    };

    const newDoctor = {
      clinic_id: auth.staff.clinic_id,
      full_name: full_name.trim(),
      department: department?.trim() || null,
      slot_minutes: slotMinutesNum,
      work_days: formattedWorkDays,
      start_time: formatTimeVal(start_time, '08:00:00'),
      end_time: formatTimeVal(end_time, '17:00:00'),
      active: active !== undefined ? Boolean(active) : true,
    };

    const { data, error } = await supabaseAdmin
      .from('doctors')
      .insert(newDoctor)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ doctor: data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
