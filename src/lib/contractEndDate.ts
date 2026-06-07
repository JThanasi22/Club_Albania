const TIRANE_TZ = 'Europe/Tirane';

export function getTodayDateKeyInTirane(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIRANE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function dateKeyFromValue(val: Date | string | null | undefined): string {
  if (val == null) return '';
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).trim().slice(0, 10);
}

export function isContractEnded(contractEndDate: Date | string | null | undefined): boolean {
  const endKey = dateKeyFromValue(contractEndDate);
  if (!endKey) return false;
  return getTodayDateKeyInTirane() >= endKey;
}

export function parseContractEndDateInput(
  value: unknown,
): { ok: true; date: Date } | { ok: false; error: string } {
  if (value == null || String(value).trim() === '') {
    return { ok: false, error: 'Data e mbarimit është e detyrueshme' };
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return { ok: false, error: 'Data e mbarimit nuk është valide' };
  }
  return { ok: true, date };
}
