import type { PracticeAttendance } from '@prisma/client';
import {
  countAttendance,
  formatAttendanceDateTime,
  formatAttendanceDisplayDate,
  parseAttendanceRecords,
  compareTeams,
} from '@/lib/attendance';

export type AttendanceSessionSummary = {
  id: string;
  teamName: string;
  dateKey: string;
  sessionDate: string;
  createdAt: string;
  updatedAt: string;
  presentCount: number;
  totalCount: number;
};

export function mapAttendanceSession(row: PracticeAttendance): AttendanceSessionSummary {
  const records = parseAttendanceRecords(row.records);
  const { presentCount, totalCount } = countAttendance(records);
  return {
    id: row.id,
    teamName: row.teamName,
    dateKey: row.dateKey,
    sessionDate: row.sessionDate.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    presentCount,
    totalCount,
  };
}

export function sortAttendanceSessions(rows: AttendanceSessionSummary[]): AttendanceSessionSummary[] {
  return [...rows].sort((a, b) => {
    const tc = compareTeams(a.teamName, b.teamName);
    if (tc !== 0) return tc;
    return b.sessionDate.localeCompare(a.sessionDate);
  });
}

export function formatSessionRecordedAt(iso: string): string {
  return formatAttendanceDateTime(iso);
}

export function formatSessionDateKey(dateKey: string): string {
  return formatAttendanceDisplayDate(dateKey);
}
