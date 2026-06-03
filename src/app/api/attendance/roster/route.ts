import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const teamName = searchParams.get('teamName')?.trim();
    if (!teamName) {
      return NextResponse.json({ error: 'Ekipi është i detyrueshëm' }, { status: 400 });
    }

    const players = await db.player.findMany({
      where: { active: true, team: teamName },
      select: { id: true, name: true, photo: true, jerseyNumber: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ teamName, players });
  } catch (error) {
    console.error('Error fetching attendance roster:', error);
    return NextResponse.json({ error: 'Marrja e listës dështoi' }, { status: 500 });
  }
}
