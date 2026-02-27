import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET all payments
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const playerId = searchParams.get('playerId');
    const status = searchParams.get('status');

    const where: {
      month?: number;
      year?: number;
      playerId?: string;
      status?: string;
    } = {};

    if (month) where.month = parseInt(month);
    if (year) where.year = parseInt(year);
    if (playerId) where.playerId = playerId;
    if (status) where.status = status;

    const payments = await db.payment.findMany({
      where,
      include: {
        player: true,
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
      ],
    });

    return NextResponse.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}

// POST create a new payment
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { playerId, month, year, amount, status, paidDate, notes } = body;

    if (!playerId || !month || !year || amount === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if payment already exists for this player/month/year
    const existingPayment = await db.payment.findUnique({
      where: {
        playerId_month_year: {
          playerId,
          month: parseInt(month),
          year: parseInt(year),
        },
      },
    });

    if (existingPayment) {
      return NextResponse.json({ error: 'Payment already exists for this month' }, { status: 400 });
    }

    const payment = await db.payment.create({
      data: {
        playerId,
        month: parseInt(month),
        year: parseInt(year),
        amount: parseFloat(amount),
        status: status || 'pending',
        paidDate: paidDate ? new Date(paidDate) : (status === 'paid' ? new Date() : null),
        notes: notes || null,
      },
      include: {
        player: true,
      },
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
  }
}
