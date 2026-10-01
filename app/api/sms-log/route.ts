import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStaff } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// GET /api/sms-log - List recent SMS logs for the logged-in staff's clinic
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedStaff(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('sms_log')
      .select('*')
      .eq('clinic_id', auth.staff.clinic_id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ smsLogs: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
