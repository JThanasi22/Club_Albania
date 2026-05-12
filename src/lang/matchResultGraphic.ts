const sq = {
  imageAlt: (opponent: string) => `Rezultati i ndeshjes — ${opponent}`,
} as const;

const en = {
  imageAlt: (opponent: string) => `Match result — ${opponent}`,
} as const;

export const matchResultGraphicLocales = { sq, en } as const;

export type MatchResultGraphicLocale = keyof typeof matchResultGraphicLocales;

export type MatchResultGraphicLang = (typeof matchResultGraphicLocales)['sq'];

export function getMatchResultGraphicLang(locale: MatchResultGraphicLocale): MatchResultGraphicLang {
  return matchResultGraphicLocales[locale] as MatchResultGraphicLang;
}
