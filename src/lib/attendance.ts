export const CLUB_TEAMS = ['U20', 'U18', 'U16', 'U14', 'U10'] as const;

export type ClubTeam = (typeof CLUB_TEAMS)[number];

export type AttendanceRecord = { playerId: string; present: boolean };

const TIRANE_TZ = 'Europe/Tirane';

export function getAttendanceDateKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIRANE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function sessionDateFromDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

function readTiraneParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIRANE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    year: Number(pick('year')),
    month: Number(pick('month')),
    day: Number(pick('day')),
    hour: Number(pick('hour')),
    minute: Number(pick('minute')),
  };
}

export function sessionDateFromDateAndTime(dateKey: string, timeHm: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeHm);
  if (!dateMatch || !timeMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (hour > 23 || minute > 59) return null;

  let t = Date.UTC(year, month - 1, day, hour - 1, minute);
  for (let i = 0; i < 8; i++) {
    const got = readTiraneParts(new Date(t));
    if (got.year === year && got.month === month && got.day === day && got.hour === hour && got.minute === minute) {
      return new Date(t);
    }
    t +=
      ((year - got.year) * 372 + (month - got.month) * 31 + (day - got.day)) * 86_400_000 +
      ((hour - got.hour) * 60 + (minute - got.minute)) * 60_000;
  }
  return new Date(t);
}

export function isValidAttendanceDateKey(dateKey: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey);
}

export function countAttendance(records: AttendanceRecord[]): { presentCount: number; totalCount: number } {
  const presentCount = records.filter((r) => r.present).length;
  return { presentCount, totalCount: records.length };
}

export function parseAttendanceRecords(json: unknown): AttendanceRecord[] {
  if (!Array.isArray(json)) return [];
  const out: AttendanceRecord[] = [];
  for (const item of json) {
    if (
      item &&
      typeof item === 'object' &&
      typeof (item as AttendanceRecord).playerId === 'string' &&
      typeof (item as AttendanceRecord).present === 'boolean'
    ) {
      out.push({ playerId: (item as AttendanceRecord).playerId, present: (item as AttendanceRecord).present });
    }
  }
  return out;
}

export function validateAttendanceRecords(
  rosterIds: string[],
  records: AttendanceRecord[],
): 'incomplete' | 'invalid_player' | 'duplicate' | 'missing_player' | null {
  if (records.length !== rosterIds.length) return 'incomplete';
  const rosterSet = new Set(rosterIds);
  const seen = new Set<string>();
  for (const r of records) {
    if (!rosterSet.has(r.playerId)) return 'invalid_player';
    if (seen.has(r.playerId)) return 'duplicate';
    seen.add(r.playerId);
  }
  for (const id of rosterIds) {
    if (!seen.has(id)) return 'missing_player';
  }
  return null;
}

export function formatAttendanceDisplayDate(dateKey: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return dateKey;
}

export function formatAttendanceDateTime(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat('sq-AL', {
    timeZone: TIRANE_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function compareTeams(a: string, b: string): number {
  const ia = CLUB_TEAMS.indexOf(a as ClubTeam);
  const ib = CLUB_TEAMS.indexOf(b as ClubTeam);
  if (ia === -1 && ib === -1) return a.localeCompare(b);
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}
