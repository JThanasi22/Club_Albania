import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const player = await db.player.findUnique({
      where: { id },
      include: {
        payments: {
          orderBy: [
            { year: 'desc' },
            { month: 'desc' },
          ],
        },
      },
    });

    if (!player) {
      return NextResponse.json({ error: 'Lojtari nuk u gjet' }, { status: 404 });
    }

    return NextResponse.json(player);
  } catch (error) {
    console.error('Error fetching player:', error);
    return NextResponse.json({ error: 'Marrja e lojtarit dështoi' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, email, phone, team, jerseyNumber, photo, joinDate, dateOfBirth, active, totalPayment, paymentHistory } = body;

    const existing = await db.player.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Lojtari nuk u gjet' }, { status: 404 });
    }

    if (name !== undefined && (!name || !name.trim())) {
      return NextResponse.json({ error: 'Emri nuk mund të jetë bosh' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      name: name !== undefined ? name.trim() : undefined,
      email: email !== undefined ? (email || null) : undefined,
      phone: phone !== undefined ? (phone || null) : undefined,
      team: team !== undefined ? (team || null) : undefined,
      jerseyNumber: jerseyNumber !== undefined ? (jerseyNumber ? parseInt(jerseyNumber) : null) : undefined,
      photo: photo !== undefined ? photo : undefined,
      joinDate: joinDate ? new Date(joinDate) : undefined,
      active: active !== undefined ? active : undefined,
    };
    if (dateOfBirth !== undefined) {
      updateData.dateOfBirth =
        dateOfBirth != null && String(dateOfBirth).trim() !== '' ? new Date(dateOfBirth) : null;
    }
    if (totalPayment !== undefined) {
      const total = Number(totalPayment);
      updateData.totalPayment = Number.isNaN(total) ? 0 : Math.max(0, total);
    }
    if (paymentHistory !== undefined) {
      if (!Array.isArray(paymentHistory)) {
        return NextResponse.json({ error: 'paymentHistory duhet të jetë një array' }, { status: 400 });
      }
      const cleaned = paymentHistory
        .filter((e: unknown) => e && typeof e === 'object' && 'amount' in e && 'date' in e)
        .map((e: { amount?: unknown; date?: unknown }) => ({
          amount: Number(e.amount) || 0,
          date: typeof e.date === 'string' ? e.date : String(e.date ?? ''),
        }))
        .filter((e) => e.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(e.date));
      updateData.paymentHistory = cleaned;
    }

    const player = await db.player.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(player);
  } catch (error) {
    console.error('Error updating player:', error);
    return NextResponse.json({ error: 'Përditësimi i lojtarit dështoi' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.player.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Lojtari nuk u gjet' }, { status: 404 });
    }

    await db.player.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Lojtari u fshi me sukses' });
  } catch (error) {
    console.error('Error deleting player:', error);
    return NextResponse.json({ error: 'Fshirja e lojtarit dështoi' }, { status: 500 });
  }
}
