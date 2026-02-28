import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET all players
export async function GET() {
  try {
    const players = await db.player.findMany({
      include: {
        payments: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return NextResponse.json(players);
  } catch (error) {
    console.error('Error fetching players:', error);
    return NextResponse.json({ error: 'Marrja e lojtarëve dështoi' }, { status: 500 });
  }
}

// POST create a new player
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, phone, team, jerseyNumber, photo, joinDate, active } = body;

    if (!name) {
      return NextResponse.json({ error: 'Emri është i detyrueshëm' }, { status: 400 });
    }

    const player = await db.player.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
        team: team || null,
        jerseyNumber: jerseyNumber ? parseInt(jerseyNumber) : null,
        photo: photo || null,
        joinDate: joinDate ? new Date(joinDate) : new Date(),
        active: active !== undefined ? active : true,
      },
    });

    return NextResponse.json(player, { status: 201 });
  } catch (error) {
    console.error('Error creating player:', error);
    return NextResponse.json({ error: 'Krijimi i lojtarit dështoi' }, { status: 500 });
  }
}
