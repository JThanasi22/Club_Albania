import { getAttendanceDateKey } from '@/lib/attendance';
import type { PaymentEntry } from '@/lib/playerPaymentSummary';

export const SEASON_COOKIE_NAME = 'admin-season';

const SEASON_ID_RE = /^(\d{4})-(\d{4})$/;

export type SeasonRange = {
  id: string;
  startYear: number;
  endYear: number;
  startKey: string;
  endKey: string;
};

export function parseSeasonId(raw: unknown): SeasonRange | null {
  if (typeof raw !== 'string') return null;
  const m = SEASON_ID_RE.exec(raw.trim());
  if (!m) return null;
  const startYear = Number(m[1]);
  const endYear = Number(m[2]);
  if (endYear !== startYear + 1) return null;
  if (startYear < 2000 || startYear > 2100) return null;
  return {
    id: `${startYear}-${endYear}`,
    startYear,
    endYear,
    startKey: `${startYear}-09-01`,
    endKey: `${endYear}-06-30`,
  };
}

export function getDefaultSeasonId(now = new Date()): string {
  const key = getAttendanceDateKey(now);
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7));
  const startYear = month >= 7 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

export function getSeasonRange(id: string): SeasonRange | null {
  return parseSeasonId(id);
}

export function seasonIdFromDateKey(dateKey: string): string | null {
  const k = String(dateKey).trim().slice(0, 10);
  const y = Number(k.slice(0, 4));
  const m = Number(k.slice(5, 7));
  if (!y || m < 1 || m > 12) return null;
  const startYear = m >= 7 ? y : y - 1;
  return parseSeasonId(`${startYear}-${startYear + 1}`)?.id ?? null;
}

export function seasonRangesFromIds(ids: Iterable<string>): SeasonRange[] {
  const unique = new Set<string>();
  for (const id of ids) {
    const parsed = parseSeasonId(id);
    if (parsed) unique.add(parsed.id);
  }
  return [...unique]
    .map((id) => parseSeasonId(id))
    .filter((range): range is SeasonRange => range != null)
    .sort((a, b) => b.startYear - a.startYear);
}

export function formatSeasonLabel(id: string): string {
  const range = parseSeasonId(id);
  if (!range) return id;
  return `${range.startYear}–${range.endYear}`;
}

export function isDateKeyInSeason(dateKey: string, range: SeasonRange): boolean {
  const k = String(dateKey).trim().slice(0, 10);
  return k >= range.startKey && k <= range.endKey;
}

export function defaultDateKeyInSeason(range: SeasonRange, now = new Date()): string {
  const today = getAttendanceDateKey(now);
  if (isDateKeyInSeason(today, range)) return today;
  return range.startKey;
}

export function seasonUtcBounds(range: SeasonRange): { gte: Date; lt: Date } {
  return {
    gte: new Date(`${range.startKey}T00:00:00+02:00`),
    lt: new Date(`${range.endYear}-07-01T00:00:00+02:00`),
  };
}

export function isYearMonthInSeason(year: number, month: number, range: SeasonRange): boolean {
  return (year === range.startYear && month >= 9) || (year === range.endYear && month <= 6);
}

export function seasonPaymentWhere(range: SeasonRange) {
  return {
    OR: [
      { AND: [{ year: range.startYear }, { month: { gte: 9 } }] },
      { AND: [{ year: range.endYear }, { month: { lte: 6 } }] },
    ],
  };
}

export function filterPaymentHistoryBySeason(
  history: PaymentEntry[] | null | undefined,
  range: SeasonRange,
): PaymentEntry[] {
  if (!Array.isArray(history)) return [];
  return history.filter((e) => e?.date && isDateKeyInSeason(String(e.date), range));
}
