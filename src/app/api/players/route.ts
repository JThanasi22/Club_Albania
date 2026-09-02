import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseContractEndDateInput } from '@/lib/contractEndDate';

// GET all players
export async function GET() {
  try {
    const players = await db.player.findMany({
      include: {
        payments: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return NextResponse.json(players);
  } catch (error) {
    console.error('Error fetching players:', error);
    return NextResponse.json({ error: 'Marrja e lojtarëve dështoi' }, { status: 500 });
  }
}

// POST create a new player
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, phone, team, jerseyNumber, photo, joinDate, dateOfBirth, contractEndDate, active, totalPayment, registrationId } = body;

    if (!name) {
      return NextResponse.json({ error: 'Emri është i detyrueshëm' }, { status: 400 });
    }

    const contractEndParsed = parseContractEndDateInput(contractEndDate);
    if (!contractEndParsed.ok) {
      return NextResponse.json({ error: contractEndParsed.error }, { status: 400 });
    }

    const linkedRegistrationId =
      typeof registrationId === 'string' && registrationId.trim() ? registrationId.trim() : '';
    if (linkedRegistrationId) {
      const registration = await db.registration.findUnique({
        where: { id: linkedRegistrationId },
        select: { id: true, playerId: true, convertedAt: true },
      });
      if (!registration) {
        return NextResponse.json({ error: 'Regjistrimi nuk u gjet' }, { status: 404 });
      }
      if (registration.playerId || registration.convertedAt) {
        return NextResponse.json({ error: 'Ky regjistrim është tashmë lojtar' }, { status: 409 });
      }
    }

    const total = totalPayment != null ? Number(totalPayment) : 0;
    const player = await db.player.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
        team: team || null,
        jerseyNumber: jerseyNumber ? parseInt(jerseyNumber) : null,
        photo: photo || null,
        joinDate: joinDate ? new Date(joinDate) : new Date(),
        dateOfBirth:
          dateOfBirth != null && String(dateOfBirth).trim() !== '' ? new Date(dateOfBirth) : null,
        contractEndDate: contractEndParsed.date,
        active: active !== undefined ? active : true,
        totalPayment: Number.isNaN(total) ? 0 : Math.max(0, total),
        paymentHistory: [],
      },
    });

    if (linkedRegistrationId) {
      await db.registration.update({
        where: { id: linkedRegistrationId },
        data: { playerId: player.id, convertedAt: new Date() },
      });
    }

    return NextResponse.json(player, { status: 201 });
  } catch (error) {
    console.error('Error creating player:', error);
    return NextResponse.json({ error: 'Krijimi i lojtarit dështoi' }, { status: 500 });
  }
}
