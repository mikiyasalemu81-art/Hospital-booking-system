import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clinic_name, full_name, email, password } = body;

    // 1. Validation
    if (!clinic_name || typeof clinic_name !== 'string' || !clinic_name.trim()) {
      return NextResponse.json({ error: 'Clinic name is required' }, { status: 400 });
    }
    if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
      return NextResponse.json({ error: 'Admin full name is required' }, { status: 400 });
    }
    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ error: 'Email address is required' }, { status: 400 });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanClinicName = clinic_name.trim();
    const cleanFullName = full_name.trim();

    // 2. Check if auth user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const emailExists = existingUsers?.users?.some(
      (u) => u.email?.toLowerCase() === cleanEmail
    );
    if (emailExists) {
      return NextResponse.json(
        { error: 'An account with this email address already exists. Please log in instead.' },
        { status: 409 }
      );
    }

    // 3. Create the Supabase Auth user (pre-confirmed for instant access)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: cleanFullName,
        clinic_name: cleanClinicName,
      },
    });

    if (authError || !authData?.user) {
      return NextResponse.json(
        { error: authError?.message || 'Failed to create user account' },
        { status: 500 }
      );
    }

    const userId = authData.user.id;

    // 4. Insert new row into `clinics` table
    const { data: newClinic, error: clinicError } = await supabaseAdmin
      .from('clinics')
      .insert({
        name: cleanClinicName,
        timezone: 'Africa/Addis_Ababa',
      })
      .select()
      .single();

    if (clinicError || !newClinic) {
      // Rollback auth user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: clinicError?.message || 'Failed to create clinic record' },
        { status: 500 }
      );
    }

    // 5. Insert new row into `staff` table linking user's id to the new clinic_id with role='admin'
    const { data: newStaff, error: staffError } = await supabaseAdmin
      .from('staff')
      .insert({
        id: userId,
        clinic_id: newClinic.id,
        full_name: cleanFullName,
        role: 'admin',
      })
      .select()
      .single();

    if (staffError || !newStaff) {
      // Rollback clinic and auth user
      await supabaseAdmin.from('clinics').delete().eq('id', newClinic.id);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: staffError?.message || 'Failed to link admin profile to clinic' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Clinic and admin account created successfully',
        clinic: newClinic,
        staff: newStaff,
        user: {
          id: userId,
          email: cleanEmail,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Server error during sign up' },
      { status: 500 }
    );
  }
}
