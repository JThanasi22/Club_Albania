import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAttendanceDateKey, isValidAttendanceDateKey } from '@/lib/attendance';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const teamName = searchParams.get('teamName')?.trim();
    if (!teamName) {
      return NextResponse.json({ error: 'Ekipi është i detyrueshëm' }, { status: 400 });
    }

    const dateKeyParam = searchParams.get('dateKey')?.trim() ?? '';
    const dateKey =
      dateKeyParam && isValidAttendanceDateKey(dateKeyParam)
        ? dateKeyParam
        : getAttendanceDateKey();
    const existing = await db.practiceAttendance.findUnique({
      where: { teamName_dateKey: { teamName, dateKey } },
      select: { id: true },
    });

    return NextResponse.json({
      exists: !!existing,
      sessionId: existing?.id ?? null,
      dateKey,
    });
  } catch (error) {
    console.error('Error checking attendance:', error);
    return NextResponse.json({ error: 'Kontrolli dështoi' }, { status: 500 });
  }
}
