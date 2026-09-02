import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const existing = await db.registration.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Regjistrimi nuk u gjet' }, { status: 404 });
    }
    await db.registration.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting registration:', error);
    return NextResponse.json({ error: 'Fshirja e regjistrimit dështoi' }, { status: 500 });
  }
}
