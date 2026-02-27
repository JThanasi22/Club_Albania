import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { randomUUID } from 'crypto';

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
    return NextResponse.json({ error: 'Marrja e pagesave dështoi' }, { status: 500 });
  }
}

// POST create a new payment (or a payment plan with multiple invoices)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      playerId,
      paymentType,
      totalAmount,
      startDate,
      endDate,
      installments,
      status,
      notes,
      // Legacy single-payment fields (for edit compatibility)
      month,
      year,
      amount,
    } = body;

    if (!playerId) {
      return NextResponse.json({ error: 'Mungon fusha e detyrueshme: playerId' }, { status: 400 });
    }

    // ── LEGACY single-payment mode (used by edit dialog) ──────────────────
    if (month && year && amount !== undefined && !paymentType) {
      const payment = await db.payment.create({
        data: {
          playerId,
          month: parseInt(month),
          year: parseInt(year),
          amount: parseFloat(amount),
          status: status || 'pending',
          paidDate: status === 'paid' ? new Date() : null,
          notes: notes || null,
          paymentType: 'monthly',
        },
        include: { player: true },
      });
      return NextResponse.json(payment, { status: 201 });
    }

    // ── NEW payment plan mode ──────────────────────────────────────────────
    if (!paymentType || !startDate || amount === undefined && totalAmount === undefined) {
      return NextResponse.json(
        { error: 'Mungojnë fushat e detyrueshme: paymentType, startDate, dhe totalAmount' },
        { status: 400 }
      );
    }

    const planStartDate = new Date(startDate);
    const planEndDate = endDate ? new Date(endDate) : null;
    const planId = randomUUID();
    const amountPerInvoice = parseFloat(totalAmount);
    const initialStatus = status || 'pending';

    // ── INSTALLMENT plan ──────────────────────────────────────────────────
    if (paymentType === 'installment') {
      const numInstallments = parseInt(installments);
      if (!numInstallments || numInstallments < 1) {
        return NextResponse.json({ error: 'Numri i kësteve duhet të jetë të paktën 1' }, { status: 400 });
      }

      // End date is now mandatory for installments
      if (!planEndDate) {
        return NextResponse.json({ error: 'Data e mbarimit është e detyrueshme për pagesat me këste' }, { status: 400 });
      }

      if (planEndDate <= planStartDate) {
        return NextResponse.json({ error: 'Data e mbarimit duhet të jetë pas datës së fillimit' }, { status: 400 });
      }

      const amountEach = Math.round((amountPerInvoice / numInstallments) * 100) / 100;
      const invoices = [];

      // Calculate the total period in milliseconds
      const totalPeriodMs = planEndDate.getTime() - planStartDate.getTime();
      // Calculate the interval between each installment
      const intervalMs = totalPeriodMs / numInstallments;

      for (let i = 0; i < numInstallments; i++) {
        // Calculate due date for this installment
        // Each installment is due at evenly spaced intervals
        const dueDate = new Date(planStartDate.getTime() + (intervalMs * (i + 1)));

        // Determine the month/year for the "Periudha" display
        // Use the midpoint of the installment period for the month/year
        const periodStart = new Date(planStartDate.getTime() + (intervalMs * i));
        const periodEnd = i === numInstallments - 1 ? planEndDate : new Date(planStartDate.getTime() + (intervalMs * (i + 1)));
        const midPeriod = new Date((periodStart.getTime() + periodEnd.getTime()) / 2);

        invoices.push({
          playerId,
          month: midPeriod.getMonth() + 1,
          year: midPeriod.getFullYear(),
          amount: amountEach,
          status: initialStatus,
          paidDate: initialStatus === 'paid' ? new Date() : null,
          notes: notes || null,
          paymentType: 'installment',
          planId,
          planStartDate,
          planEndDate,
          dueDate,
          installmentNumber: i + 1,
          totalInstallments: numInstallments,
        });
      }

      const created = await db.payment.createMany({ data: invoices });
      // Return total created count + fetch them back
      const payments = await db.payment.findMany({
        where: { planId },
        include: { player: true },
        orderBy: { installmentNumber: 'asc' },
      });
      return NextResponse.json(
        { count: created.count, payments },
        { status: 201 }
      );
    }

    // ── MONTHLY plan ──────────────────────────────────────────────────────
    if (paymentType === 'monthly') {
      if (!planEndDate) {
        return NextResponse.json({ error: 'Data e mbarimit është e detyrueshme për pagesat mujore' }, { status: 400 });
      }

      // Count how many months are in the plan
      const startYear = planStartDate.getFullYear();
      const startMonth = planStartDate.getMonth();
      const endYear = planEndDate.getFullYear();
      const endMonth = planEndDate.getMonth();
      const totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;

      if (totalMonths < 1) {
        return NextResponse.json({ error: 'Data e mbarimit duhet të jetë në ose pas datës së fillimit' }, { status: 400 });
      }

      // Create ONLY the first invoice now
      const dueDate = new Date(planStartDate);
      const firstPayment = await db.payment.create({
        data: {
          playerId,
          month: dueDate.getMonth() + 1,
          year: dueDate.getFullYear(),
          amount: amountPerInvoice,
          status: initialStatus,
          paidDate: initialStatus === 'paid' ? new Date() : null,
          notes: notes || null,
          paymentType: 'monthly',
          planId,
          planStartDate,
          planEndDate,
          dueDate,
          installmentNumber: 1,
          totalInstallments: totalMonths,
        },
        include: { player: true },
      });

      return NextResponse.json(
        { count: 1, totalPlanned: totalMonths, payments: [firstPayment] },
        { status: 201 }
      );
    }

    return NextResponse.json({ error: 'Lloji i pagesës është i pavlefshëm' }, { status: 400 });
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ error: 'Krijimi i pagesës dështoi' }, { status: 500 });
  }
}
