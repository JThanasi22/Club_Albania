import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildPlayerAttendanceSummaryMap } from '@/lib/playerAttendanceSummary';
import { getSeasonRangeFromCookies } from '@/lib/seasonCookie';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const season = await getSeasonRangeFromCookies();
    const sessions = await db.practiceAttendance.findMany({
      where: {
        dateKey: { gte: season.startKey, lte: season.endKey },
      },
      select: {
        id: true,
        teamName: true,
        dateKey: true,
        sessionDate: true,
        updatedAt: true,
        records: true,
      },
      orderBy: { sessionDate: 'desc' },
    });

    return NextResponse.json(buildPlayerAttendanceSummaryMap(sessions));
  } catch (error) {
    console.error('Error building player attendance summary:', error);
    return NextResponse.json({ error: 'Marrja e përmbledhjes së prezencës dështoi' }, { status: 500 });
  }
}
