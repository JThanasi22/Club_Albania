import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSeasonIdFromCookies } from '@/lib/seasonCookie';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('admin-session');

    if (!session) {
      return NextResponse.json({ authenticated: false, seasonId: null });
    }

    const admin = JSON.parse(session.value);
    const seasonId = await getSeasonIdFromCookies();
    return NextResponse.json({
      authenticated: true,
      admin,
      seasonId,
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json({ authenticated: false, seasonId: null });
  }
}
