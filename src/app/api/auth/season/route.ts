import { NextResponse } from 'next/server';
import { getAdminSessionFromCookies } from '@/lib/adminSessionCookie';
import { getDefaultSeasonId, parseSeasonId } from '@/lib/season';
import { getSeasonIdFromCookies, setSeasonCookie } from '@/lib/seasonCookie';
import { buildSeasonOptionsFromDb, serializeSeasonOptions } from '@/lib/seasonOptionsFromDb';

export async function GET() {
  try {
    const admin = await getAdminSessionFromCookies();
    if (!admin) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const seasonId = await getSeasonIdFromCookies();
    const options = serializeSeasonOptions(await buildSeasonOptionsFromDb());
    return NextResponse.json({
      seasonId,
      defaultSeasonId: getDefaultSeasonId(),
      options,
    });
  } catch (error) {
    console.error('Season GET error:', error);
    return NextResponse.json({ error: 'Marrja e sezonit dështoi' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await getAdminSessionFromCookies();
    if (!admin) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const parsed = parseSeasonId((body as { seasonId?: unknown }).seasonId);
    if (!parsed) {
      return NextResponse.json({ error: 'Sezoni nuk është valid' }, { status: 400 });
    }
    await setSeasonCookie(parsed.id);
    return NextResponse.json({ success: true, seasonId: parsed.id });
  } catch (error) {
    console.error('Season POST error:', error);
    return NextResponse.json({ error: 'Ruajtja e sezonit dështoi' }, { status: 500 });
  }
}
