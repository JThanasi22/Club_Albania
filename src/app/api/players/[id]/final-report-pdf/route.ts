import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isContractEnded } from '@/lib/contractEndDate';
import { buildPlayerAttendanceSummaryMap } from '@/lib/playerAttendanceSummary';
import { buildPlayerFinalReportPdfBytes } from '@/lib/playerFinalReportPdf';
import { slugifyForFilename } from '@/lib/playerPaymentPdf';

type PaymentEntry = { amount: number; date: string };

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const player = await db.player.findUnique({ where: { id } });
    if (!player) {
      return NextResponse.json({ error: 'Lojtari nuk u gjet' }, { status: 404 });
    }

    if (!player.contractEndDate) {
      return NextResponse.json({ error: 'Data e mbarimit nuk është vendosur' }, { status: 400 });
    }

    if (!isContractEnded(player.contractEndDate)) {
      return NextResponse.json(
        { error: 'Raporti përfundimtar është i disponueshëm pas datës së mbarimit të kontratës' },
        { status: 403 },
      );
    }

    const sessions = await db.practiceAttendance.findMany({
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

    const summaryMap = buildPlayerAttendanceSummaryMap(sessions);
    const attendance = summaryMap[id] ?? { totalPractices: 0, missedCount: 0, misses: [] };

    const bytes = await buildPlayerFinalReportPdfBytes({
      name: player.name,
      team: player.team,
      jerseyNumber: player.jerseyNumber,
      email: player.email,
      phone: player.phone,
      joinDate: player.joinDate,
      dateOfBirth: player.dateOfBirth,
      contractEndDate: player.contractEndDate,
      active: player.active,
      photo: player.photo,
      totalPayment: player.totalPayment,
      paymentHistory: (player.paymentHistory as PaymentEntry[] | null) ?? [],
      attendance,
    });

    const base = slugifyForFilename(player.name);
    const filename = `te-dhenat-perfundimtare-${base}.pdf`;
    const asciiName = filename.replace(/[^\x20-\x7E]/g, '_');

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${asciiName}"`,
      },
    });
  } catch (error) {
    console.error('Error generating final report PDF:', error);
    return NextResponse.json({ error: 'Gjenerimi i PDF dështoi' }, { status: 500 });
  }
}
