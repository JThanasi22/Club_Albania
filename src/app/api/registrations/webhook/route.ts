import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  normalizePreferredContact,
  parseRegistrationDate,
} from '@/lib/registrations';
import { uploadPlayerPhotoBase64 } from '@/lib/uploadPlayerPhoto';

function webhookSecretOk(request: Request): boolean {
  const expected = process.env.REGISTRATIONS_WEBHOOK_SECRET;
  if (!expected) return false;
  const header = request.headers.get('authorization') || request.headers.get('x-webhook-secret') || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  try {
    if (!webhookSecretOk(request)) {
      return NextResponse.json({ error: 'Jo i autorizuar' }, { status: 401 });
    }

    const body = await request.json();
    const googleResponseId = String(body.googleResponseId ?? '').trim();
    const name = String(body.name ?? '').trim();
    if (!googleResponseId || !name) {
      return NextResponse.json({ error: 'Emri dhe googleResponseId janë të detyrueshëm' }, { status: 400 });
    }

    const existing = await db.registration.findUnique({
      where: { googleResponseId },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ ok: true, id: existing.id, duplicate: true });
    }

    let photo: string | null = null;
    const photoBase64 = typeof body.photoBase64 === 'string' ? body.photoBase64.trim() : '';
    if (photoBase64) {
      try {
        const mimeType = typeof body.photoMimeType === 'string' && body.photoMimeType.trim()
          ? body.photoMimeType.trim()
          : 'image/jpeg';
        const uploaded = await uploadPlayerPhotoBase64(photoBase64, mimeType);
        photo = uploaded.url;
      } catch (error) {
        console.error('Error uploading registration photo:', error);
      }
    }

    const submittedRaw = body.submittedAt != null ? new Date(String(body.submittedAt)) : null;
    const submittedAt =
      submittedRaw && !Number.isNaN(submittedRaw.getTime())
        ? submittedRaw
        : parseRegistrationDate(body.submittedAt) || new Date();
    const row = await db.registration.create({
      data: {
        googleResponseId,
        name,
        email: String(body.email ?? '').trim() || null,
        phone: String(body.phone ?? '').trim() || null,
        dateOfBirth: parseRegistrationDate(body.dateOfBirth),
        photo,
        preferredContact: normalizePreferredContact(body.preferredContact),
        submittedAt,
      },
    });

    return NextResponse.json({ ok: true, id: row.id }, { status: 201 });
  } catch (error) {
    console.error('Error ingesting registration:', error);
    return NextResponse.json({ error: 'Ruajtja e regjistrimit dështoi' }, { status: 500 });
  }
}
