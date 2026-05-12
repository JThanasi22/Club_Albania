export type VolleyballSetPoints = { our: number; their: number };

export function parseVolleyballSets(raw: unknown): VolleyballSetPoints[] {
  if (!Array.isArray(raw)) return [];
  const out: VolleyballSetPoints[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const our = Number(o.our);
    const their = Number(o.their);
    if (!Number.isFinite(our) || !Number.isFinite(their)) continue;
    if (!Number.isInteger(our) || !Number.isInteger(their)) continue;
    if (our < 0 || their < 0) continue;
    out.push({ our, their });
  }
  return out;
}

export function setsWonFromPoints(sets: VolleyballSetPoints[]): { ourSets: number; theirSets: number } {
  let ourSets = 0;
  let theirSets = 0;
  for (const s of sets) {
    if (s.our > s.their) ourSets++;
    else if (s.their > s.our) theirSets++;
  }
  return { ourSets, theirSets };
}

export function formatVolleyballSetsSummary(sets: VolleyballSetPoints[]): string {
  if (sets.length === 0) return '';
  const { ourSets, theirSets } = setsWonFromPoints(sets);
  const parts = sets.map((s) => `${s.our}-${s.their}`);
  return `${ourSets}-${theirSets} (${parts.join(', ')})`;
}

export type SetDraftRow = { our: string; their: string };

export function parseSetDraftRows(
  rows: SetDraftRow[],
): { ok: true; sets: VolleyballSetPoints[] } | { ok: false; reason: 'empty' | 'invalid' | 'tie' } {
  const sets: VolleyballSetPoints[] = [];
  for (const row of rows) {
    const ou = row.our.trim();
    const th = row.their.trim();
    if (ou === '' && th === '') continue;
    if (ou === '' || th === '') {
      return { ok: false, reason: 'invalid' };
    }
    const our = Number.parseInt(ou, 10);
    const their = Number.parseInt(th, 10);
    if (Number.isNaN(our) || Number.isNaN(their) || our < 0 || their < 0) {
      return { ok: false, reason: 'invalid' };
    }
    if (our === their) {
      return { ok: false, reason: 'tie' };
    }
    sets.push({ our, their });
  }
  if (sets.length === 0) {
    return { ok: false, reason: 'empty' };
  }
  return { ok: true, sets };
}
