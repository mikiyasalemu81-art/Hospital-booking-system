import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStaff } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// GET /api/patients - List and search patients for the logged-in staff's clinic
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedStaff(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim();

    let dbQuery = supabaseAdmin
      .from('patients')
      .select('*')
      .eq('clinic_id', auth.staff.clinic_id);

    if (query) {
      // Filter by name or phone (case-insensitive)
      // Supabase format: or(full_name.ilike.%query%,phone.ilike.%query%)
      dbQuery = dbQuery.or(`full_name.ilike.%${query}%,phone.ilike.%${query}%`);
    }

    const { data, error } = await dbQuery.order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to list patients from database:', error.message);
      return NextResponse.json({ error: "Couldn't load patients. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ patients: data || [] });
  } catch (error: any) {
    console.error('Server error in GET /api/patients:', error);
    return NextResponse.json({ error: "Couldn't load patients. Please try again." }, { status: 500 });
  }
}

// POST /api/patients - Add a new patient for the logged-in staff's clinic
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedStaff(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { full_name, phone, notes } = body;

    if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
      return NextResponse.json({ error: 'Patient full name is required' }, { status: 400 });
    }

    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    const newPatient = {
      clinic_id: auth.staff.clinic_id,
      full_name: full_name.trim(),
      phone: phone.trim(),
      notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
    };

    const { data, error } = await supabaseAdmin
      .from('patients')
      .insert(newPatient)
      .select()
      .single();

    if (error) {
      console.error('Database error adding patient:', error.message);
      return NextResponse.json(
        { error: "Couldn't save the patient. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ patient: data }, { status: 201 });
  } catch (error: any) {
    console.error('Server error in POST /api/patients:', error);
    return NextResponse.json(
      { error: "Couldn't save the patient. Please try again." },
      { status: 500 }
    );
  }
}
