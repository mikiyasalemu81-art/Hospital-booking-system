import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStaff } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedStaff(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized or staff profile not found' }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: auth.user.id,
        email: auth.user.email,
      },
      staff: auth.staff,
      clinic: auth.clinic,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
