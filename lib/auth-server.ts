import { NextRequest } from 'next/server';
import { createClient as createServerSupabase } from './supabase/server';
import { supabaseAdmin } from './supabase/admin';
import { Staff, Clinic } from './types';
import { User } from '@supabase/supabase-js';

export interface AuthenticatedContext {
  user: User;
  staff: Staff;
  clinic: Clinic;
}

export async function getAuthenticatedStaff(request?: NextRequest): Promise<AuthenticatedContext | null> {
  let user: User | null = null;

  // 1. Try reading bearer token from request header if present
  if (request) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: tokenUser, error: tokenError } = await supabaseAdmin.auth.getUser(token);
      if (!tokenError && tokenUser?.user) {
        user = tokenUser.user;
      }
    }
  }

  // 2. Try cookie session via SSR client
  if (!user) {
    try {
      const supabase = await createServerSupabase();
      const { data: { user: sessionUser }, error: sessionError } = await supabase.auth.getUser();
      if (!sessionError && sessionUser) {
        user = sessionUser;
      }
    } catch (e) {
      // In case cookies cannot be read in some execution context
      console.warn('Failed reading session from cookies:', e);
    }
  }

  if (!user) {
    return null;
  }

  // 3. Fetch staff record for this user
  const { data: staffData, error: staffError } = await supabaseAdmin
    .from('staff')
    .select('*')
    .eq('id', user.id)
    .single();

  if (staffError || !staffData) {
    console.error('Staff profile not found for user id:', user.id, staffError?.message);
    return null;
  }

  const staff = staffData as Staff;

  // 4. Fetch clinic record for this staff
  const { data: clinicData, error: clinicError } = await supabaseAdmin
    .from('clinics')
    .select('*')
    .eq('id', staff.clinic_id)
    .single();

  if (clinicError || !clinicData) {
    console.error('Clinic not found for clinic_id:', staff.clinic_id, clinicError?.message);
    return null;
  }

  const clinic = clinicData as Clinic;

  return {
    user,
    staff,
    clinic,
  };
}
