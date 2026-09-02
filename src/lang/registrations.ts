const sq = {
  tabShort: 'Regjistrime',
  pageTitle: 'Regjistrime',
  pageDescription: 'Përgjigjet e formularit të regjistrimit, të përditësuara në kohë reale.',
  searchPlaceholder: 'Kërko regjistrime...',
  empty: 'Nuk ka regjistrime ende',
  emptyFilter: 'Nuk u gjet asnjë regjistrim',
  colPhoto: 'Foto',
  colName: 'Emri',
  colEmail: 'Email',
  colPhone: 'Telefoni',
  colBirthDate: 'Datelindja',
  colContact: 'Kontakti i preferuar',
  colSubmitted: 'Dërguar',
  colStatus: 'Statusi',
  colActions: 'Veprimet',
  statusPending: 'Në pritje',
  statusConverted: 'Lojtar',
  addAsPlayer: 'Shto si lojtar',
  alreadyPlayer: 'Në listën e lojtarëve',
  contactPhone: 'Telefon',
  contactWhatsapp: 'WhatsApp',
  contactEmail: 'Email',
  preferredContact: 'Kontakti i preferuar',
  createFromTitle: 'Shto lojtar nga regjistrimi',
  createFromDescription: 'Të dhënat nga formulari janë plotësuar. Plotësoni të dhënat e mbetura, përfshirë datën e mbarimit.',
  remainingHint: 'Të detyrueshme nga ju: data e mbarimit. Ekipi, numri i fanellës dhe pagesa janë opsionale.',
  toastCreated: 'Lojtari u shtua nga regjistrimi',
  loading: 'Duke ngarkuar…',
} as const;

const en = {
  tabShort: 'Registrations',
  pageTitle: 'Registrations',
  pageDescription: 'Google Form registration responses, updated live.',
  searchPlaceholder: 'Search registrations...',
  empty: 'No registrations yet',
  emptyFilter: 'No matching registrations',
  colPhoto: 'Photo',
  colName: 'Name',
  colEmail: 'Email',
  colPhone: 'Phone',
  colBirthDate: 'Birth date',
  colContact: 'Preferred contact',
  colSubmitted: 'Submitted',
  colStatus: 'Status',
  colActions: 'Actions',
  statusPending: 'Pending',
  statusConverted: 'Player',
  addAsPlayer: 'Add as player',
  alreadyPlayer: 'Already a player',
  contactPhone: 'Phone',
  contactWhatsapp: 'WhatsApp',
  contactEmail: 'Email',
  preferredContact: 'Preferred contact',
  createFromTitle: 'Add player from registration',
  createFromDescription: 'Form answers are filled in. Complete the remaining fields, including contract end date.',
  remainingHint: 'Required from you: contract end date. Team, jersey number, and payment are optional.',
  toastCreated: 'Player created from registration',
  loading: 'Loading…',
} as const;

export const registrationsLocales = { sq, en } as const;

export type RegistrationsLocale = keyof typeof registrationsLocales;

export type RegistrationsLang = (typeof registrationsLocales)['sq'];

export function getRegistrationsLang(locale: RegistrationsLocale): RegistrationsLang {
  return registrationsLocales[locale] as RegistrationsLang;
}
