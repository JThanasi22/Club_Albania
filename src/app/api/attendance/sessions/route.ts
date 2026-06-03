import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  getAttendanceDateKey,
  isValidAttendanceDateKey,
  sessionDateFromDateKey,
  validateAttendanceRecords,
  type AttendanceRecord,
} from '@/lib/attendance';
import { mapAttendanceSession, sortAttendanceSessions } from '@/lib/attendanceSession';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await db.practiceAttendance.findMany({
      orderBy: [{ teamName: 'asc' }, { sessionDate: 'desc' }],
    });
    return NextResponse.json(sortAttendanceSessions(rows.map(mapAttendanceSession)));
  } catch (error) {
    console.error('Error listing attendance sessions:', error);
    return NextResponse.json({ error: 'Marrja e sesioneve dështoi' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const teamName = typeof body.teamName === 'string' ? body.teamName.trim() : '';
    const records = body.records as AttendanceRecord[] | undefined;

    if (!teamName || !Array.isArray(records)) {
      return NextResponse.json({ error: 'Të dhënat nuk janë valide' }, { status: 400 });
    }

    const players = await db.player.findMany({
      where: { active: true, team: teamName },
      select: { id: true },
      orderBy: { name: 'asc' },
    });
    const rosterIds = players.map((p) => p.id);

    if (rosterIds.length === 0) {
      return NextResponse.json({ error: 'Nuk ka lojtarë aktivë për këtë ekip' }, { status: 400 });
    }

    const validation = validateAttendanceRecords(rosterIds, records);
    if (validation) {
      return NextResponse.json({ error: 'Regjistrimi i plotë i prezencës kërkohet' }, { status: 400 });
    }

    const dateKeyRaw = typeof body.dateKey === 'string' ? body.dateKey.trim() : '';
    const dateKey =
      dateKeyRaw && isValidAttendanceDateKey(dateKeyRaw) ? dateKeyRaw : getAttendanceDateKey();

    let sessionDate: Date;
    if (typeof body.sessionAt === 'string' && body.sessionAt.trim()) {
      const parsed = new Date(body.sessionAt);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: 'Data e sesionit nuk është valide' }, { status: 400 });
      }
      sessionDate = parsed;
    } else {
      sessionDate = sessionDateFromDateKey(dateKey);
    }

    const session = await db.practiceAttendance.upsert({
      where: { teamName_dateKey: { teamName, dateKey } },
      create: { teamName, dateKey, sessionDate, records },
      update: { records, sessionDate },
    });

    return NextResponse.json(mapAttendanceSession(session), { status: 201 });
  } catch (error) {
    console.error('Error saving attendance session:', error);
    return NextResponse.json({ error: 'Ruajtja e prezencës dështoi' }, { status: 500 });
  }
}
