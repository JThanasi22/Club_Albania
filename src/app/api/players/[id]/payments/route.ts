import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

type PaymentEntry = { amount: number; date: string };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const amount = Number(body?.amount);
    const date = typeof body?.date === 'string' ? body.date.trim() : '';

    if (Number.isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Shuma duhet të jetë më e madhe se 0' }, { status: 400 });
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Data është e pavlefshme (përdorni yyyy-MM-dd)' }, { status: 400 });
    }

    const player = await db.player.findUnique({ where: { id } });
    if (!player) {
      return NextResponse.json({ error: 'Lojtari nuk u gjet' }, { status: 404 });
    }

    const history = (player.paymentHistory as PaymentEntry[] | null) ?? [];
    const updated = [...history, { amount, date }];

    const updatedPlayer = await db.player.update({
      where: { id },
      data: { paymentHistory: updated },
      include: { payments: true },
    });

    return NextResponse.json(updatedPlayer);
  } catch (error) {
    console.error('Error adding payment:', error);
    return NextResponse.json({ error: 'Shtimi i pagesës dështoi' }, { status: 500 });
  }
}
