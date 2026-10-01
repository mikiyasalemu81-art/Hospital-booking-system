import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    // List users to find the user id
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }

    const targetUser = usersData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (!targetUser) {
      return NextResponse.json({ error: 'User with this email not found in Supabase Auth' }, { status: 404 });
    }

    // Update password and ensure email is confirmed
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
      password,
      email_confirm: true,
    });

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Password updated successfully! You can now log in.' });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to update password' }, { status: 500 });
  }
}
