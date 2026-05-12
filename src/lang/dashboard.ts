const sq = {
  recentPaymentsTitle: 'Pagesat e Fundit',
  recentPaymentsDescription: 'Aktivitetet e fundit të pagesave',
  recentPaymentsEmpty: 'Nuk ka pagesa të fundit',
  unpaidTitle: 'Pagesat e Papaguara',
  unpaidDescription: 'Lojtarët me fatura të papaguara (në pritje ose vonuar)',
  unpaidEmpty: 'Nuk ka lojtarë me fatura të papaguara',
  noTeam: 'Pa ekip',
  unknownPlayer: 'I panjohur',
  listSearchPlaceholderPayments: 'Kërko sipas emrit, datës ose shumës…',
  listSearchPlaceholderUnpaid: 'Kërko sipas emrit, ekipit ose shumës…',
  listNoResults: 'Nuk u gjet asnjë rezultat',
  listFooterCounts: (shown: number, total: number) => `${shown} nga ${total}`,
  viewPlayers: 'Shiko Lojtarët',
  calendarTitle: 'Kalendar',
  calendarDescription: 'Të gjitha ndeshjet sipas datës; filtro sipas ekipit.',
  calendarTeamFilterLabel: 'Ekipet',
  calendarTeamFilterAll: 'Të gjitha',
  calendarTeamFilterNone: 'Asnjë',
  calendarPickDay: 'Zgjidh një datë në kalendar',
  calendarNoMatchesThisDay: 'Nuk ka ndeshje në këtë datë.',
  calendarNoMatchesFiltered: 'Nuk ka ndeshje për ekipet e zgjedhura.',
  calendarHome: 'Shtëpi',
  calendarAway: 'Transfertë',
  cardPreviewHint: (total: number) =>
    `Rrëshqit brenda kartës për të parë të gjitha (${total}). Prek kartën për kërkim dhe listën e plotë.`,
} as const;

const en = {
  recentPaymentsTitle: 'Recent payments',
  recentPaymentsDescription: 'Latest payment activity',
  recentPaymentsEmpty: 'No recent payments',
  unpaidTitle: 'Unpaid balances',
  unpaidDescription: 'Players with outstanding or overdue invoices',
  unpaidEmpty: 'No players with unpaid balances',
  noTeam: 'No team',
  unknownPlayer: 'Unknown',
  listSearchPlaceholderPayments: 'Search by name, date, or amount…',
  listSearchPlaceholderUnpaid: 'Search by name, team, or amount…',
  listNoResults: 'No matching results',
  listFooterCounts: (shown: number, total: number) => `${shown} of ${total}`,
  viewPlayers: 'View players',
  calendarTitle: 'Calendar',
  calendarDescription: 'All matches by date; filter by team.',
  calendarTeamFilterLabel: 'Teams',
  calendarTeamFilterAll: 'All',
  calendarTeamFilterNone: 'None',
  calendarPickDay: 'Pick a date',
  calendarNoMatchesThisDay: 'No matches on this date.',
  calendarNoMatchesFiltered: 'No matches for the selected teams.',
  calendarHome: 'Home',
  calendarAway: 'Away',
  cardPreviewHint: (total: number) =>
    `Scroll inside the card to see all ${total} entries. Tap the card to search and open the full list.`,
} as const;

export const dashboardLocales = { sq, en } as const;

export type DashboardLocale = keyof typeof dashboardLocales;

export type DashboardLang = (typeof dashboardLocales)['sq'];

export function getDashboardLang(locale: DashboardLocale): DashboardLang {
  return dashboardLocales[locale] as DashboardLang;
}
