import { format, isValid, parseISO } from 'date-fns';
import { getCldImageUrl, type GetCldImageUrlOptions } from 'next-cloudinary';
import {
  parseVolleyballSets,
  parseSetDraftRows,
  setsWonFromPoints,
} from '@/lib/volleyballMatchSets';

export const MATCH_RESULT_GRAPHIC_WIDTH = 1080;
export const MATCH_RESULT_GRAPHIC_HEIGHT = 1080;

const TEXT_HEADER = { color: '#0f172a', fontFamily: 'Arial', fontSize: 28 } as const;
const TEXT_BODY = { color: '#0f172a', fontFamily: 'Arial', fontSize: 24 } as const;
const TEXT_SCORE = { color: '#b91c1c', fontFamily: 'Arial', fontSize: 40 } as const;

const LAYOUT_3 = {
  headerY: 132,
  opponent: { x: 80, y: 268 },
  location: { x: 208, y: 402 },
  date: { x: 80, y: 402 },
  setScores: [
    { x: 248, y: 528 },
    { x: 628, y: 528 },
    { x: 248, y: 688 },
  ],
  final: { x: 628, y: 688 },
} as const;

const LAYOUT_5 = {
  headerY: 132,
  opponent: { x: 80, y: 268 },
  location: { x: 208, y: 402 },
  date: { x: 80, y: 402 },
  setScores: [
    { x: 72, y: 540 },
    { x: 246, y: 540 },
    { x: 420, y: 540 },
    { x: 594, y: 540 },
    { x: 768, y: 540 },
  ],
} as const;

export type MatchResultSetInput =
  | { home: number; away: number }
  | { our: number; their: number };

export type MatchResultData = {
  division: string;
  date: Date | string;
  opponent: string;
  isHome: boolean;
  location?: string | null;
  sets: MatchResultSetInput[];
  headerLine?: string;
  opponentDisplay?: string;
  locationDisplay?: string;
};

function normalizeSet(s: MatchResultSetInput): { home: number; away: number } {
  if ('our' in s) {
    return { home: s.our, away: s.their };
  }
  return s;
}

function formatMatchDate(d: Date | string): string {
  const dt = typeof d === 'string' ? parseISO(d) : d;
  if (!isValid(dt)) return '';
  return format(dt, 'dd.MM.yyyy');
}

function scoreLabel(sets: { home: number; away: number }[], index: number): string {
  const row = sets[index];
  if (!row) return '—';
  return `${row.home}-${row.away}`;
}

function finalSetsWonText(sets: { home: number; away: number }[]): string {
  if (sets.length === 0) return '—';
  const { ourSets, theirSets } = setsWonFromPoints(
    sets.map((s) => ({ our: s.home, their: s.away })),
  );
  return `${ourSets}-${theirSets}`;
}

export function getMatchResultImageOptions(
  matchData: MatchResultData,
): Pick<GetCldImageUrlOptions, 'src' | 'width' | 'height' | 'overlays'> {
  const sets = matchData.sets.map(normalizeSet);
  const isFiveSet = sets.length > 3;
  const baseTemplate = isFiveSet ? 'vb-template-5set' : 'vb-template-3set';
  const layout = isFiveSet ? LAYOUT_5 : LAYOUT_3;

  const headerText = matchData.headerLine ?? matchData.division;
  const opponentText = matchData.opponentDisplay ?? matchData.opponent;
  const locationText = matchData.locationDisplay ?? (matchData.location?.trim() || '');
  const dateText = formatMatchDate(matchData.date);

  const overlays: NonNullable<GetCldImageUrlOptions['overlays']> = [
    {
      text: { ...TEXT_HEADER, text: headerText },
      position: { y: layout.headerY, gravity: 'north' },
    },
    {
      text: { ...TEXT_BODY, text: opponentText },
      position: { x: layout.opponent.x, y: layout.opponent.y, gravity: 'north_east' },
    },
    ...(locationText
      ? [
          {
            text: { ...TEXT_BODY, text: locationText },
            position: {
              x: layout.location.x,
              y: layout.location.y,
              gravity: 'north_west' as const,
            },
          },
        ]
      : []),
    ...(dateText
      ? [
          {
            text: { ...TEXT_BODY, text: dateText },
            position: {
              x: layout.date.x,
              y: layout.date.y,
              gravity: 'north_east' as const,
            },
          },
        ]
      : []),
  ];

  if (isFiveSet) {
    for (let i = 0; i < layout.setScores.length; i++) {
      const pos = layout.setScores[i];
      overlays.push({
        text: { ...TEXT_SCORE, text: scoreLabel(sets, i) },
        position: { x: pos.x, y: pos.y, gravity: 'north_west' },
      });
    }
  } else {
    const l3 = layout as typeof LAYOUT_3;
    for (let i = 0; i < l3.setScores.length; i++) {
      const pos = l3.setScores[i];
      overlays.push({
        text: { ...TEXT_SCORE, text: scoreLabel(sets, i) },
        position: { x: pos.x, y: pos.y, gravity: 'north_west' },
      });
    }
    overlays.push({
      text: { ...TEXT_SCORE, text: finalSetsWonText(sets) },
      position: { x: l3.final.x, y: l3.final.y, gravity: 'north_west' },
    });
  }

  return {
    src: baseTemplate,
    width: MATCH_RESULT_GRAPHIC_WIDTH,
    height: MATCH_RESULT_GRAPHIC_HEIGHT,
    overlays,
  };
}

export function getMatchResultConfig(matchData: MatchResultData) {
  const opts = getMatchResultImageOptions(matchData);
  return {
    baseTemplate: opts.src,
    overlays: opts.overlays,
    width: opts.width,
    height: opts.height,
  };
}

export function getMatchResultUrl(matchData: MatchResultData) {
  return getCldImageUrl(getMatchResultImageOptions(matchData));
}

export function teamMatchToMatchResultData(m: {
  teamName: string;
  matchDate: Date | string;
  opponent: string;
  venue?: string | null;
  isHome: boolean;
  volleyballSets?: unknown;
}): MatchResultData {
  const sets = parseVolleyballSets(m.volleyballSets).map((s) => ({
    home: s.our,
    away: s.their,
  }));
  return {
    division: m.teamName,
    date: m.matchDate,
    opponent: m.opponent,
    isHome: m.isHome,
    location: m.venue ?? null,
    sets,
  };
}

export type MatchScoreDraftInput = { sets: { our: string; their: string }[] };

export function buildMatchResultDataFromRow(
  m: {
    teamName: string;
    matchDate: string;
    opponent: string;
    venue: string | null;
    isHome: boolean;
    ourScore: number | null;
    theirScore: number | null;
    volleyballSets?: unknown;
  },
  draft?: MatchScoreDraftInput | null,
): MatchResultData {
  let sets: MatchResultSetInput[] = [];
  if (draft) {
    const parsed = parseSetDraftRows(draft.sets);
    if (parsed.ok) {
      sets = parsed.sets.map((s) => ({ home: s.our, away: s.their }));
    }
  }
  if (sets.length === 0) {
    sets = parseVolleyballSets(m.volleyballSets).map((s) => ({
      home: s.our,
      away: s.their,
    }));
  }
  if (sets.length === 0 && m.ourScore != null && m.theirScore != null) {
    sets = [{ home: m.ourScore, away: m.theirScore }];
  }
  return {
    division: m.teamName,
    date: m.matchDate,
    opponent: m.opponent,
    isHome: m.isHome,
    location: m.venue,
    sets,
  };
}
