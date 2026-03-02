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
    const { name, email, phone, team, jerseyNumber, photo, joinDate, active } = body;

    const existing = await db.player.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Lojtari nuk u gjet' }, { status: 404 });
    }

    if (name !== undefined && (!name || !name.trim())) {
      return NextResponse.json({ error: 'Emri nuk mund të jetë bosh' }, { status: 400 });
    }

    const player = await db.player.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        email: email || null,
        phone: phone || null,
        team: team || null,
        jerseyNumber: jerseyNumber ? parseInt(jerseyNumber) : null,
        photo: photo !== undefined ? photo : undefined,
        joinDate: joinDate ? new Date(joinDate) : undefined,
        active: active !== undefined ? active : undefined,
      },
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
