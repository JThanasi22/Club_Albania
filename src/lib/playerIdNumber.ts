import { Prisma } from '@prisma/client';
import { getPlayersLang } from '@/lang/players';
import { db } from '@/lib/db';

const pl = getPlayersLang('sq');

let idNumberIndexReady: Promise<void> | null = null;

export function parseIdNumberInput(value: unknown): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim().toUpperCase();
  return trimmed === '' ? null : trimmed;
}

export function ensureIdNumberIndex(): Promise<void> {
  if (!idNumberIndexReady) {
    idNumberIndexReady = db
      .$runCommandRaw({
        createIndexes: 'Player',
        indexes: [
          {
            key: { idNumber: 1 },
            name: 'Player_idNumber_partial_unique',
            unique: true,
            partialFilterExpression: { idNumber: { $type: 'string' } },
          },
        ],
      })
      .then(() => undefined)
      .catch((error: unknown) => {
        idNumberIndexReady = null;
        throw error;
      });
  }
  return idNumberIndexReady;
}

export function duplicateIdNumberMessage(error: unknown): string | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return pl.idNumberDuplicate;
  }
  const message = error instanceof Error ? error.message : '';
  if (/E11000|duplicate key/i.test(message) && /idNumber/i.test(message)) {
    return pl.idNumberDuplicate;
  }
  return null;
}
