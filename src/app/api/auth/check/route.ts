import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('admin-session');

    if (!session) {
      return NextResponse.json({ authenticated: false });
    }

    const admin = JSON.parse(session.value);
    return NextResponse.json({
      authenticated: true,
      admin,
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json({ authenticated: false });
  }
}
