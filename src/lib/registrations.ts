export const PREFERRED_CONTACT_VALUES = ['phone', 'whatsapp', 'email'] as const;

export type PreferredContact = (typeof PREFERRED_CONTACT_VALUES)[number];

export type Registration = {
  id: string;
  googleResponseId: string;
  name: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  photo: string | null;
  preferredContact: PreferredContact;
  submittedAt: string;
  playerId: string | null;
  convertedAt: string | null;
};

export function normalizePreferredContact(value: unknown): PreferredContact {
  const s = String(value ?? '')
    .trim()
    .toLowerCase();
  if (s.includes('whats') || s === 'wa') return 'whatsapp';
  if (s.includes('email') || s.includes('e-mail') || s.includes('post')) return 'email';
  return 'phone';
}

export function parseRegistrationDate(value: unknown): Date | null {
  const s = String(value ?? '').trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const dmy = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmy) {
    const d = new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function dateInputFromValue(val: Date | string | null | undefined): string {
  if (val == null) return '';
  const d = typeof val === 'string' ? new Date(val) : val;
  if (Number.isNaN(d.getTime())) return String(val).slice(0, 10);
  return d.toISOString().slice(0, 10);
}
