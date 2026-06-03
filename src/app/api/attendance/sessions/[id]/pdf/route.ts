import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseAttendanceRecords } from '@/lib/attendance';
import { buildPracticeAttendancePdfBytes, slugifyAttendanceFilename } from '@/lib/practiceAttendancePdf';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
          select: { id: true, name: true },
        })
      : [];
    const nameMap = new Map(players.map((p) => [p.id, p.name]));

    const rows = records
      .map((r) => ({
        name: nameMap.get(r.playerId) ?? '—',
        present: r.present,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'sq'));

    const bytes = await buildPracticeAttendancePdfBytes({
      teamName: session.teamName,
      dateKey: session.dateKey,
      recordedAt: session.updatedAt,
      rows,
    });

    const filename = slugifyAttendanceFilename(session.teamName, session.dateKey);
    const asciiName = filename.replace(/[^\x20-\x7E]/g, '_');

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${asciiName}"`,
      },
    });
  } catch (error) {
    console.error('Error generating attendance PDF:', error);
    return NextResponse.json({ error: 'Gjenerimi i PDF dështoi' }, { status: 500 });
  }
}
