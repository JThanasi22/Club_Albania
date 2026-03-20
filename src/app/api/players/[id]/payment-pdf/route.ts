import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildPlayerPaymentPdfBytes, slugifyForFilename } from '@/lib/playerPaymentPdf';

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

    const bytes = await buildPlayerPaymentPdfBytes({
      name: player.name,
      team: player.team,
      jerseyNumber: player.jerseyNumber,
      email: player.email,
      phone: player.phone,
      joinDate: player.joinDate,
      dateOfBirth: player.dateOfBirth,
      active: player.active,
      photo: player.photo,
      totalPayment: player.totalPayment,
      paymentHistory: (player.paymentHistory as PaymentEntry[] | null) ?? [],
    });

    const base = slugifyForFilename(player.name);
    const filename = `pagesat-${base}.pdf`;
    const asciiName = filename.replace(/[^\x20-\x7E]/g, '_');

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${asciiName}"`,
      },
    });
  } catch (error) {
    console.error('Error generating payment PDF:', error);
    return NextResponse.json({ error: 'Gjenerimi i PDF dështoi' }, { status: 500 });
  }
}
