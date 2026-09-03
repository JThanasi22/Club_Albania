import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { seasonUtcBounds } from '@/lib/season';
import { getSeasonRangeFromCookies } from '@/lib/seasonCookie';

export async function GET() {
  try {
    const season = await getSeasonRangeFromCookies();
    const bounds = seasonUtcBounds(season);
    const rows = await db.registration.findMany({
      where: { submittedAt: { gte: bounds.gte, lt: bounds.lt } },
      orderBy: { submittedAt: 'desc' },
    });
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching registrations:', error);
    return NextResponse.json({ error: 'Marrja e regjistrimeve dështoi' }, { status: 500 });
  }
}
