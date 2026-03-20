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

export function buildPaymentReminderMessage(amountLeftFormatted: string): string {
  return [
    'Njoftim pagese',
    '',
    'Pershendetje:',
    `Sjellim ne vemendjen tuaj pagesen e mbetur per Club Albania me vleren: ${amountLeftFormatted}`,
    '',
    `Lutemi te kryeni pagesen ne llogarine bankare te komunikuar te Club Albania ne BKT Bank: duke percaktuar ne pershkrim dhe emrin e sportistes per te cilen behet pagesa dhe nje kopje te mandat pageses na e dergoni elektronikisht nepermjet WhatsApp ne numrin ${CLUB_WHATSAPP_NUMBER}.`,
    '',
    'Duke ju falenderuar per mirekuptimin',
    'Club Albania',
    'Dite te mbare !',
  ].join('\n');
}

export function getPaymentReminderWhatsAppHref(phoneDigits: string, message: string): string {
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
}
