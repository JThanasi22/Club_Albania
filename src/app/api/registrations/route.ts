import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const rows = await db.registration.findMany({
      orderBy: { submittedAt: 'desc' },
    });
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching registrations:', error);
    return NextResponse.json({ error: 'Marrja e regjistrimeve dështoi' }, { status: 500 });
  }
}
