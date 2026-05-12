export type FormationSlot = {
  playerId: string;
  position: string;
  inSquad: boolean;
};

export function parseFormationSlots(raw: unknown): FormationSlot[] {
  if (!Array.isArray(raw)) return [];
  const out: FormationSlot[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const playerId = typeof o.playerId === 'string' ? o.playerId : '';
    if (!playerId) continue;
    out.push({
      playerId,
      position: typeof o.position === 'string' ? o.position : '',
      inSquad: typeof o.inSquad === 'boolean' ? o.inSquad : true,
    });
  }
  return out;
}
