const sq = {
  contractEndDateLabel: 'Data e Mbarimit',
  contractEndDateRequired: 'Data e mbarimit është e detyrueshme',
  finalReportButton: 'Te Dhenat Perfundimtare',
  finalReportPdfError: 'Gjenerimi i PDF të dhënave përfundimtare dështoi',
  finalReportNotAvailable: 'Raporti përfundimtar është i disponueshëm pas datës së mbarimit të kontratës',
  filterButton: 'Filtro',
  filterClear: 'Pastro filtrat',
  filterStatus: 'Statusi',
  filterStatusAll: 'Të gjithë',
  filterStatusActive: 'Aktiv',
  filterStatusInactive: 'Joaktiv',
  changeStatus: 'Ndrysho statusin',
  statusUpdated: 'Statusi u përditësua',
  statusUpdateFailed: 'Përditësimi i statusit dështoi',
  filterYear: 'Viti i mbarimit',
  filterYearAll: 'Të gjithë vitet',
  filterPayment: 'Pagesa',
  filterPaymentAll: 'Të gjithë',
  filterPaymentWithBalance: 'Kanë shumë për të paguar',
  filterPaymentPaid: 'Të paguar plotësisht',
  filterPaymentCredit: 'Me tepricë',
  filterSort: 'Renditja',
  filterSortNone: 'Pa renditje',
  filterSortHighest: 'Shuma e mbetur: nga më e madhja',
  filterSortLowest: 'Shuma e mbetur: nga më e vogla',
} as const;

const en = {
  contractEndDateLabel: 'Contract end date',
  contractEndDateRequired: 'Contract end date is required',
  finalReportButton: 'Final report data',
  finalReportPdfError: 'Failed to generate final report PDF',
  finalReportNotAvailable: 'Final report is available after the contract end date',
  filterButton: 'Filter',
  filterClear: 'Clear filters',
  filterStatus: 'Status',
  filterStatusAll: 'All',
  filterStatusActive: 'Active',
  filterStatusInactive: 'Inactive',
  changeStatus: 'Change status',
  statusUpdated: 'Status updated',
  statusUpdateFailed: 'Failed to update status',
  filterYear: 'Contract end year',
  filterYearAll: 'All years',
  filterPayment: 'Payment',
  filterPaymentAll: 'All',
  filterPaymentWithBalance: 'Outstanding balance',
  filterPaymentPaid: 'Paid in full',
  filterPaymentCredit: 'Credit',
  filterSort: 'Sort',
  filterSortNone: 'No sorting',
  filterSortHighest: 'Balance: highest first',
  filterSortLowest: 'Balance: lowest first',
} as const;

export const playersLocales = { sq, en } as const;

export type PlayersLocale = keyof typeof playersLocales;

export type PlayersLang = (typeof playersLocales)['sq'];

export function getPlayersLang(locale: PlayersLocale): PlayersLang {
  return playersLocales[locale] as PlayersLang;
}
