import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { setsWonFromPoints } from '@/lib/volleyballMatchSets';

const setPointSchema = z.object({
  our: z.number().int().min(0).max(200),
  their: z.number().int().min(0).max(200),
});

const patchBodySchema = z.object({
  opponent: z.string().min(1).optional(),
  matchDate: z.string().min(1).optional(),
  venue: z.string().optional().nullable(),
  isHome: z.boolean().optional(),
  ourScore: z.number().int().optional().nullable(),
  theirScore: z.number().int().optional().nullable(),
  volleyballSets: z.array(setPointSchema).max(5).optional().nullable(),
  notes: z.string().optional().nullable(),
});

function decodeTeamName(raw: string) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ teamName: string; matchId: string }> }
) {
  try {
    const { teamName: raw, matchId } = await params;
    const teamName = decodeTeamName(raw);
    const existing = await db.teamMatch.findFirst({
      where: { id: matchId, teamName },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Ndeshja nuk u gjet' }, { status: 404 });
    }
    const body = await request.json();
    const parsed = patchBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Të dhëna të pavlefshme' }, { status: 400 });
    }
    const data: Record<string, unknown> = {};
    if (parsed.data.opponent !== undefined) data.opponent = parsed.data.opponent.trim();
    if (parsed.data.matchDate !== undefined) {
      const d = new Date(parsed.data.matchDate);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: 'Data e pavlefshme' }, { status: 400 });
      }
      data.matchDate = d;
    }
    if (parsed.data.venue !== undefined) data.venue = parsed.data.venue?.trim() || null;
    if (parsed.data.isHome !== undefined) data.isHome = parsed.data.isHome;
    if (parsed.data.notes !== undefined) data.notes = parsed.data.notes?.trim() || null;

    if (parsed.data.volleyballSets !== undefined) {
      const sets = parsed.data.volleyballSets;
      if (sets === null) {
        data.volleyballSets = null;
        if (parsed.data.ourScore === undefined) data.ourScore = null;
        if (parsed.data.theirScore === undefined) data.theirScore = null;
      } else {
        for (const s of sets) {
          if (s.our === s.their) {
            return NextResponse.json({ error: 'Çdo set duhet të ketë një fitues (pikët e ndryshme)' }, { status: 400 });
          }
        }
        const { ourSets, theirSets } = setsWonFromPoints(sets);
        data.volleyballSets = sets;
        data.ourScore = parsed.data.ourScore !== undefined ? parsed.data.ourScore : ourSets;
        data.theirScore = parsed.data.theirScore !== undefined ? parsed.data.theirScore : theirSets;
      }
    } else {
      if (parsed.data.ourScore !== undefined) data.ourScore = parsed.data.ourScore;
      if (parsed.data.theirScore !== undefined) data.theirScore = parsed.data.theirScore;
    }

    const updated = await db.teamMatch.update({
      where: { id: matchId },
      data,
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating match:', error);
    return NextResponse.json({ error: 'Përditësimi i ndeshjes dështoi' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ teamName: string; matchId: string }> }
) {
  try {
    const { teamName: raw, matchId } = await params;
    const teamName = decodeTeamName(raw);
    const existing = await db.teamMatch.findFirst({
      where: { id: matchId, teamName },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Ndeshja nuk u gjet' }, { status: 404 });
    }
    await db.teamMatch.delete({ where: { id: matchId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting match:', error);
    return NextResponse.json({ error: 'Fshirja e ndeshjes dështoi' }, { status: 500 });
  }
}
