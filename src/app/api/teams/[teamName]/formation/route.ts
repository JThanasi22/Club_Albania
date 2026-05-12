import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { parseFormationSlots } from '@/lib/teamFormation';

const putBodySchema = z.object({
  slots: z.array(
    z.object({
      playerId: z.string().min(1),
      position: z.string(),
      inSquad: z.boolean(),
    })
  ),
});

function decodeTeamName(raw: string) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamName: string }> }
) {
  try {
    const { teamName: raw } = await params;
    const teamName = decodeTeamName(raw);
    const row = await db.teamFormation.findUnique({ where: { teamName } });
    const slots = parseFormationSlots(row?.slots ?? []);
    return NextResponse.json({ teamName, slots });
  } catch (error) {
    console.error('Error fetching formation:', error);
    return NextResponse.json({ error: 'Marrja e formacionit dështoi' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ teamName: string }> }
) {
  try {
    const { teamName: raw } = await params;
    const teamName = decodeTeamName(raw);
    const body = await request.json();
    const parsed = putBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Të dhëna të pavlefshme' }, { status: 400 });
    }
    const upserted = await db.teamFormation.upsert({
      where: { teamName },
      create: { teamName, slots: parsed.data.slots },
      update: { slots: parsed.data.slots },
    });
    return NextResponse.json({
      teamName: upserted.teamName,
      slots: parseFormationSlots(upserted.slots),
    });
  } catch (error) {
    console.error('Error saving formation:', error);
    return NextResponse.json({ error: 'Ruajtja e formacionit dështoi' }, { status: 500 });
  }
}
