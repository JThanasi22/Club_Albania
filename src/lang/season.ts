const sq = {
  pickerTitle: 'Zgjidhni sezonin',
  pickerDescription: 'Të dhënat e portalit ngarkohen sipas sezonit (1 shtator – 30 qershor).',
  pickerLabel: 'Sezoni',
  pickerConfirm: 'Vazhdo',
  headerLabel: 'Sezoni',
  toastSaved: 'Sezoni u zgjodh',
  toastError: 'Zgjedhja e sezonit dështoi',
} as const;

const en = {
  pickerTitle: 'Choose season',
  pickerDescription: 'Portal data is loaded for the selected season (1 September – 30 June).',
  pickerLabel: 'Season',
  pickerConfirm: 'Continue',
  headerLabel: 'Season',
  toastSaved: 'Season selected',
  toastError: 'Could not select season',
} as const;

export const seasonLocales = { sq, en } as const;

export type SeasonLocale = keyof typeof seasonLocales;

export type SeasonLang = (typeof seasonLocales)['sq'];

export function getSeasonLang(locale: SeasonLocale): SeasonLang {
  return seasonLocales[locale] as SeasonLang;
}
