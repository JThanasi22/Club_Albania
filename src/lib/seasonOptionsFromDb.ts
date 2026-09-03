import { db } from '@/lib/db';
import { getAttendanceDateKey } from '@/lib/attendance';
import type { PaymentEntry } from '@/lib/playerPaymentSummary';
import {
  formatSeasonLabel,
  getDefaultSeasonId,
  seasonIdFromDateKey,
  seasonRangesFromIds,
  type SeasonRange,
} from '@/lib/season';

function addSeasonFromDateKey(ids: Set<string>, dateKey: string | null | undefined) {
  if (!dateKey) return;
  const id = seasonIdFromDateKey(dateKey);
  if (id) ids.add(id);
}

export async function buildSeasonOptionsFromDb(): Promise<SeasonRange[]> {
  const [attendance, matches, registrations, invoices, players] = await Promise.all([
    db.practiceAttendance.findMany({ select: { dateKey: true } }),
    db.teamMatch.findMany({ select: { matchDate: true } }),
    db.registration.findMany({ select: { submittedAt: true } }),
    db.payment.findMany({ select: { year: true, month: true } }),
    db.player.findMany({ select: { paymentHistory: true } }),
  ]);

  const ids = new Set<string>();
  const current = getDefaultSeasonId();
  ids.add(current);

  for (const row of attendance) {
    addSeasonFromDateKey(ids, row.dateKey);
  }
  for (const row of matches) {
    addSeasonFromDateKey(ids, getAttendanceDateKey(row.matchDate));
  }
  for (const row of registrations) {
    addSeasonFromDateKey(ids, getAttendanceDateKey(row.submittedAt));
  }
  for (const row of invoices) {
    const month = String(row.month).padStart(2, '0');
    addSeasonFromDateKey(ids, `${row.year}-${month}-01`);
  }
  for (const player of players) {
    const history = (player.paymentHistory as PaymentEntry[] | null) ?? [];
    for (const entry of history) {
      addSeasonFromDateKey(ids, entry?.date);
    }
  }

  return seasonRangesFromIds(ids);
}

export function serializeSeasonOptions(ranges: SeasonRange[]) {
  return ranges.map((s) => ({
    id: s.id,
    label: formatSeasonLabel(s.id),
    startKey: s.startKey,
    endKey: s.endKey,
  }));
}
