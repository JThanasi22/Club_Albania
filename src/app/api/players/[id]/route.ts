import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET a single player
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
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    return NextResponse.json(player);
  } catch (error) {
    console.error('Error fetching player:', error);
    return NextResponse.json({ error: 'Failed to fetch player' }, { status: 500 });
  }
}

// PUT update a player
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, email, phone, position, jerseyNumber, photo, joinDate, active } = body;

    const player = await db.player.update({
      where: { id },
      data: {
        name,
        email: email || null,
        phone: phone || null,
        position: position || null,
        jerseyNumber: jerseyNumber ? parseInt(jerseyNumber) : null,
        photo: photo !== undefined ? photo : undefined,
        joinDate: joinDate ? new Date(joinDate) : undefined,
        active: active !== undefined ? active : undefined,
      },
    });

    return NextResponse.json(player);
  } catch (error) {
    console.error('Error updating player:', error);
    return NextResponse.json({ error: 'Failed to update player' }, { status: 500 });
  }
}

// DELETE a player
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.player.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Player deleted successfully' });
  } catch (error) {
    console.error('Error deleting player:', error);
    return NextResponse.json({ error: 'Failed to delete player' }, { status: 500 });
  }
}
