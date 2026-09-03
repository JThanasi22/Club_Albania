import { cookies } from 'next/headers';
import {
  SEASON_COOKIE_NAME,
  getDefaultSeasonId,
  parseSeasonId,
  type SeasonRange,
} from '@/lib/season';

const seasonCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 7,
};

export async function getSeasonIdFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  const parsed = parseSeasonId(cookieStore.get(SEASON_COOKIE_NAME)?.value);
  return parsed?.id ?? null;
}

export async function getSeasonRangeFromCookies(): Promise<SeasonRange> {
  const id = await getSeasonIdFromCookies();
  const parsed = id ? parseSeasonId(id) : null;
  return parsed ?? parseSeasonId(getDefaultSeasonId())!;
}

export async function setSeasonCookie(seasonId: string): Promise<SeasonRange | null> {
  const parsed = parseSeasonId(seasonId);
  if (!parsed) return null;
  const cookieStore = await cookies();
  cookieStore.set(SEASON_COOKIE_NAME, parsed.id, seasonCookieOptions);
  return parsed;
}

export async function clearSeasonCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SEASON_COOKIE_NAME);
}
