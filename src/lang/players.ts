const sq = {
  contractEndDateLabel: 'Data e Mbarimit',
  contractEndDateRequired: 'Data e mbarimit është e detyrueshme',
  finalReportButton: 'Te Dhenat Perfundimtare',
  finalReportPdfError: 'Gjenerimi i PDF të dhënave përfundimtare dështoi',
  finalReportNotAvailable: 'Raporti përfundimtar është i disponueshëm pas datës së mbarimit të kontratës',
} as const;

const en = {
  contractEndDateLabel: 'Contract end date',
  contractEndDateRequired: 'Contract end date is required',
  finalReportButton: 'Final report data',
  finalReportPdfError: 'Failed to generate final report PDF',
  finalReportNotAvailable: 'Final report is available after the contract end date',
} as const;

export const playersLocales = { sq, en } as const;

export type PlayersLocale = keyof typeof playersLocales;

export type PlayersLang = (typeof playersLocales)['sq'];

export function getPlayersLang(locale: PlayersLocale): PlayersLang {
  return playersLocales[locale] as PlayersLang;
}
