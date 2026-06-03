import { parseAttendanceRecords } from '@/lib/attendance';

export type PlayerMissedPractice = {
  sessionId: string;
  teamName: string;
  dateKey: string;
  sessionDate: string;
  recordedAt: string;
};

export type PlayerAttendanceSummary = {
  totalPractices: number;
  missedCount: number;
  misses: PlayerMissedPractice[];
};

export type PlayerAttendanceSummaryMap = Record<string, PlayerAttendanceSummary>;

type SessionRow = {
  id: string;
  teamName: string;
  dateKey: string;
  sessionDate: Date;
  updatedAt: Date;
  records: unknown;
};

export function buildPlayerAttendanceSummaryMap(sessions: SessionRow[]): PlayerAttendanceSummaryMap {
  const map: PlayerAttendanceSummaryMap = {};

  for (const session of sessions) {
    const records = parseAttendanceRecords(session.records);
    for (const r of records) {
      if (!map[r.playerId]) {
        map[r.playerId] = { totalPractices: 0, missedCount: 0, misses: [] };
      }
      const entry = map[r.playerId];
      entry.totalPractices += 1;
      if (!r.present) {
        entry.missedCount += 1;
        entry.misses.push({
          sessionId: session.id,
          teamName: session.teamName,
          dateKey: session.dateKey,
          sessionDate: session.sessionDate.toISOString(),
          recordedAt: session.updatedAt.toISOString(),
        });
      }
    }
  }

  for (const entry of Object.values(map)) {
    entry.misses.sort(
      (a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime(),
    );
  }

  return map;
}

export function getMissedPracticePercent(summary: PlayerAttendanceSummary | undefined): number {
  if (!summary || summary.totalPractices === 0) return 0;
  return Math.round((summary.missedCount / summary.totalPractices) * 100);
}

export type MissedPracticeTier = 'good' | 'warning' | 'bad';

export function getMissedPracticeTier(missedPct: number): MissedPracticeTier {
  if (missedPct <= 25) return 'good';
  if (missedPct <= 50) return 'warning';
  return 'bad';
}

export const MISSED_PRACTICE_TIER_COLORS: Record<
  MissedPracticeTier,
  { missed: string; present: string }
> = {
  good: {
    missed: 'hsl(142.1 76.2% 36.3%)',
    present: 'hsl(142.1 50% 88%)',
  },
  warning: {
    missed: 'hsl(45 93% 47%)',
    present: 'hsl(48 96% 88%)',
  },
  bad: {
    missed: 'hsl(0 72% 51%)',
    present: 'hsl(0 60% 92%)',
  },
};
