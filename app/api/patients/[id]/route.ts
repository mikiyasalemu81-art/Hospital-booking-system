import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStaff } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase/admin';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Max length for the free-text patient notes field
const MAX_NOTES_LENGTH = 500;

// GET /api/patients/[id] - Fetch a single patient for the logged-in staff's clinic
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getAuthenticatedStaff(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from('patients')
      .select('*')
      .eq('id', id)
      .eq('clinic_id', auth.staff.clinic_id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    return NextResponse.json({ patient: data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

// PATCH /api/patients/[id] - Update the free-text notes field for a patient
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getAuthenticatedStaff(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { notes } = body;

    if (notes !== undefined && notes !== null && typeof notes !== 'string') {
      return NextResponse.json({ error: 'Notes must be a string' }, { status: 400 });
    }

    const normalized = typeof notes === 'string' ? notes.trim() : '';
    if (normalized.length > MAX_NOTES_LENGTH) {
      return NextResponse.json(
        { error: `Notes must be ${MAX_NOTES_LENGTH} characters or fewer` },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('patients')
      .update({ notes: normalized || null })
      .eq('id', id)
      .eq('clinic_id', auth.staff.clinic_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    return NextResponse.json({ patient: data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
