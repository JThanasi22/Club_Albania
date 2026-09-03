import { NextResponse } from 'next/server';
import { computeDashboardStats } from '@/lib/computeDashboardStats';
import { getSeasonRangeFromCookies } from '@/lib/seasonCookie';

export async function GET() {
  try {
    const season = await getSeasonRangeFromCookies();
    const payload = await computeDashboardStats(season);
    return NextResponse.json(payload);
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Marrja e statistikave dështoi' }, { status: 500 });
  }
}
