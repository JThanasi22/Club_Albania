import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  parseAttendanceRecords,
  validateAttendanceRecords,
  type AttendanceRecord,
} from '@/lib/attendance';
import { mapAttendanceSession } from '@/lib/attendanceSession';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await db.practiceAttendance.findUnique({ where: { id } });
    if (!session) {
      return NextResponse.json({ error: 'Sesioni nuk u gjet' }, { status: 404 });
    }

    const records = parseAttendanceRecords(session.records);
    const playerIds = records.map((r) => r.playerId);
    const players = playerIds.length
      ? await db.player.findMany({
          where: { id: { in: playerIds } },
          select: { id: true, name: true, photo: true, jerseyNumber: true },
        })
      : [];
    const playerMap = new Map(players.map((p) => [p.id, p]));

    const rows = records
      .map((r) => {
        const p = playerMap.get(r.playerId);
        return {
          playerId: r.playerId,
          present: r.present,
          name: p?.name ?? '—',
          photo: p?.photo ?? null,
          jerseyNumber: p?.jerseyNumber ?? null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'sq'));

    return NextResponse.json({
      ...mapAttendanceSession(session),
      players: rows,
    });
  } catch (error) {
    console.error('Error fetching attendance session:', error);
    return NextResponse.json({ error: 'Marrja e sesionit dështoi' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await db.practiceAttendance.findUnique({ where: { id } });
    if (!session) {
      return NextResponse.json({ error: 'Sesioni nuk u gjet' }, { status: 404 });
    }

    const body = await request.json();
    const records = body.records as AttendanceRecord[] | undefined;
    if (!Array.isArray(records)) {
      return NextResponse.json({ error: 'Të dhënat nuk janë valide' }, { status: 400 });
    }

    const existing = parseAttendanceRecords(session.records);
    const rosterIds = existing.map((r) => r.playerId);
    const validation = validateAttendanceRecords(rosterIds, records);
    if (validation) {
      return NextResponse.json({ error: 'Regjistrimi i plotë i prezencës kërkohet' }, { status: 400 });
    }

    const updated = await db.practiceAttendance.update({
      where: { id },
      data: { records },
    });

    return NextResponse.json(mapAttendanceSession(updated));
  } catch (error) {
    console.error('Error updating attendance session:', error);
    return NextResponse.json({ error: 'Përditësimi i prezencës dështoi' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await db.practiceAttendance.findUnique({ where: { id } });
    if (!session) {
      return NextResponse.json({ error: 'Sesioni nuk u gjet' }, { status: 404 });
    }

    await db.practiceAttendance.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting attendance session:', error);
    return NextResponse.json({ error: 'Fshirja e prezencës dështoi' }, { status: 500 });
  }
}
