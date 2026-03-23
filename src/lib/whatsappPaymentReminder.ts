const CLUB_WHATSAPP_NUMBER = '+355697091027';

export function normalizePhoneForWhatsApp(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length < 9) return null;
  if (d.startsWith('355')) {
    if (d.length >= 11 && d.length <= 12) return d;
    return null;
  }
  if (d.startsWith('0') && d.length >= 10) {
    return `355${d.slice(1)}`;
  }
  if (d.length === 9 && d.startsWith('6')) {
    return `355${d}`;
  }
  return null;
}

export function formatDueDateForPaymentReminder(isoYyyyMmDd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoYyyyMmDd.trim());
  if (!m) return isoYyyyMmDd.trim();
  return `${m[3]}.${m[2]}.${m[1]}`;
}

export function buildPaymentReminderMessage(amountLeftFormatted: string, dueDateDDMMYYYY: string): string {
  return [
    'Përshëndetje,',
    '',
    `Sjellim në vëmendjen tuaj pagesën e mbetur për Club Albania me vlerën: ${amountLeftFormatted}.`,
    '',
    `Lutemi të kryeni pagesën brenda afatit të përcaktuar ( në kontratën e sportistes )`,
    '',
    `Pagesa mund të kryhet në llogarinë bankare të komunikuar të Club Albania në BKT Bank, duke përcaktuar në përshkrim emrin e sportistes për të cilën bëhet pagesa. Gjithashtu, ju lutemi të na dërgoni një kopje të mandat pagesës në mënyrë elektronike përmes WhatsApp në numrin ${CLUB_WHATSAPP_NUMBER}.`,
    '',
    'Duke ju falënderuar për mirëkuptimin,',
    'Club Albania',
    '',
    'Ditë të mbarë!',
  ].join('\n');
}

export function getPaymentReminderWhatsAppHref(phoneDigits: string, message: string): string {
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
}
