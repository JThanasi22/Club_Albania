import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

const setPointSchema = z.object({
  our: z.number().int().min(0).max(200),
  their: z.number().int().min(0).max(200),
});

const postBodySchema = z.object({
  opponent: z.string().min(1),
  matchDate: z.string().min(1),
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamName: string }> }
) {
  try {
    const { teamName: raw } = await params;
    const teamName = decodeTeamName(raw);
    const matches = await db.teamMatch.findMany({
      where: { teamName },
      orderBy: { matchDate: 'desc' },
    });
    return NextResponse.json(matches);
  } catch (error) {
    console.error('Error fetching matches:', error);
    return NextResponse.json({ error: 'Marrja e ndeshjeve dështoi' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamName: string }> }
) {
  try {
    const { teamName: raw } = await params;
    const teamName = decodeTeamName(raw);
    const body = await request.json();
    const parsed = postBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Të dhëna të pavlefshme' }, { status: 400 });
    }
    const d = new Date(parsed.data.matchDate);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: 'Data e pavlefshme' }, { status: 400 });
    }
    const sets = parsed.data.volleyballSets ?? null;
    if (sets) {
      for (const s of sets) {
        if (s.our === s.their) {
          return NextResponse.json({ error: 'Çdo set duhet të ketë një fitues (pikët e ndryshme)' }, { status: 400 });
        }
      }
    }
    let ourScore: number | null = parsed.data.ourScore ?? null;
    let theirScore: number | null = parsed.data.theirScore ?? null;
    if (sets && sets.length > 0) {
      let wOur = 0;
      let wTheir = 0;
      for (const s of sets) {
        if (s.our > s.their) wOur++;
        else if (s.their > s.our) wTheir++;
      }
      ourScore = wOur;
      theirScore = wTheir;
    }
    const match = await db.teamMatch.create({
      data: {
        teamName,
        opponent: parsed.data.opponent.trim(),
        matchDate: d,
        venue: parsed.data.venue?.trim() || null,
        isHome: parsed.data.isHome ?? true,
        ourScore,
        theirScore,
        volleyballSets: sets ?? undefined,
        notes: parsed.data.notes?.trim() || null,
      },
    });
    return NextResponse.json(match, { status: 201 });
  } catch (error) {
    console.error('Error creating match:', error);
    return NextResponse.json({ error: 'Krijimi i ndeshjes dështoi' }, { status: 500 });
  }
}
