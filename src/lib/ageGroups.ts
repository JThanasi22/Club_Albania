import { getAttendanceDateKey, type ClubTeam } from '@/lib/attendance';
import { getDefaultSeasonId, parseSeasonId } from '@/lib/season';

// Each age group covers two full birth years (1 Jan – 31 Dec) and moves up one year per season.
// For season 2026–2027: U20 2008–2009, U18 2010–2011, U16 2012–2013, U14 2014–2015, U12 2016–2017, U10 2018–2019.
const AGE_GROUPS: { team: ClubTeam; age: number }[] = [
  { team: 'U20', age: 20 },
  { team: 'U18', age: 18 },
  { team: 'U16', age: 16 },
  { team: 'U14', age: 14 },
  { team: 'U12', age: 12 },
  { team: 'U10', age: 10 },
];

function birthYearOf(dateOfBirth: Date | string): number | null {
  if (typeof dateOfBirth === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateOfBirth)) {
    return Number(dateOfBirth.slice(0, 4));
  }
  const d = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
  if (Number.isNaN(d.getTime())) return null;
  return Number(getAttendanceDateKey(d).slice(0, 4));
}

export function birthYearRangeForTeam(age: number, seasonStartYear: number): { from: number; to: number } {
  const from = seasonStartYear - age + 2;
  return { from, to: from + 1 };
}

/** Team for a birth date in the given season (defaults to the current season); null when outside all groups. */
export function teamForDateOfBirth(
  dateOfBirth: Date | string | null | undefined,
  seasonId: string = getDefaultSeasonId(),
): ClubTeam | null {
  if (!dateOfBirth) return null;
  const year = birthYearOf(dateOfBirth);
  const season = parseSeasonId(seasonId);
  if (year == null || !season) return null;
  for (const { team, age } of AGE_GROUPS) {
    const { from, to } = birthYearRangeForTeam(age, season.startYear);
    if (year >= from && year <= to) return team;
  }
  return null;
}

/**
 * Decides the stored team and whether it is automatic.
 * An empty team, or one equal to the computed team, counts as automatic and follows the birth date each season.
 * Any other team was chosen by hand and is never overwritten.
 */
export function resolvePlayerTeam(
  team: string | null | undefined,
  dateOfBirth: Date | string | null | undefined,
): { team: string | null; teamAuto: boolean } {
  const chosen = team ? String(team).trim() : '';
  const computed = teamForDateOfBirth(dateOfBirth);
  if (!chosen) return { team: computed, teamAuto: computed != null };
  return { team: chosen, teamAuto: computed != null && chosen === computed };
}
