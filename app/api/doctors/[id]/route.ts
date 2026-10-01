import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStaff } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase/admin';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/doctors/[id]
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getAuthenticatedStaff(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from('doctors')
      .select('*')
      .eq('id', id)
      .eq('clinic_id', auth.staff.clinic_id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });
    }

    return NextResponse.json({ doctor: data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

// PUT /api/doctors/[id] - Edit doctor
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getAuthenticatedStaff(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { full_name, department, slot_minutes, work_days, start_time, end_time, active } = body;

    const updateData: Record<string, any> = {};

    if (full_name !== undefined) {
      if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
        return NextResponse.json({ error: 'Doctor name cannot be empty' }, { status: 400 });
      }
      updateData.full_name = full_name.trim();
    }

    if (department !== undefined) {
      updateData.department = department ? department.trim() : null;
    }

    if (slot_minutes !== undefined) {
      const slotNum = Number(slot_minutes);
      if (isNaN(slotNum) || slotNum <= 0) {
        return NextResponse.json({ error: 'Slot minutes must be positive' }, { status: 400 });
      }
      updateData.slot_minutes = slotNum;
    }

    if (work_days !== undefined) {
      updateData.work_days = Array.isArray(work_days)
        ? work_days.map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 7)
        : [];
    }

    const formatTimeVal = (t: string | undefined) => {
      if (!t) return undefined;
      const parts = t.split(':');
      if (parts.length === 2) return `${t}:00`;
      return t;
    };

    if (start_time !== undefined) {
      updateData.start_time = formatTimeVal(start_time);
    }

    if (end_time !== undefined) {
      updateData.end_time = formatTimeVal(end_time);
    }

    if (active !== undefined) {
      updateData.active = Boolean(active);
    }

    // STRICTLY filter by id AND clinic_id to enforce multi-tenancy
    const { data, error } = await supabaseAdmin
      .from('doctors')
      .update(updateData)
      .eq('id', id)
      .eq('clinic_id', auth.staff.clinic_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ doctor: data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

// DELETE /api/doctors/[id]
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getAuthenticatedStaff(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // STRICTLY filter by id AND clinic_id to enforce multi-tenancy
    const { error } = await supabaseAdmin
      .from('doctors')
      .delete()
      .eq('id', id)
      .eq('clinic_id', auth.staff.clinic_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
