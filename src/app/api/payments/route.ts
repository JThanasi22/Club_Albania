import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { randomUUID } from 'crypto';

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

    if (month) {
      const m = parseInt(month);
      if (!isNaN(m) && m >= 1 && m <= 12) where.month = m;
    }
    if (year) {
      const y = parseInt(year);
      if (!isNaN(y) && y >= 2000 && y <= 2100) where.year = y;
    }
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      playerId,
      paymentType,
      totalAmount,
      amountPerMonth,
      totalPlanAmount,
      startDate,
      endDate,
      installments,
      installmentDueDates,
      installmentAmounts,
      installmentAmountsPaid,
      status,
      notes,
      month,
      year,
      amount,
    } = body;

    if (!playerId) {
      return NextResponse.json({ error: 'Mungon fusha e detyrueshme: playerId' }, { status: 400 });
    }

    if (month && year && amount !== undefined && !paymentType) {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount < 0) {
        return NextResponse.json({ error: 'Shuma nuk mund të jetë negative' }, { status: 400 });
      }
      const payment = await db.payment.create({
        data: {
          playerId,
          month: parseInt(month),
          year: parseInt(year),
          amount: parsedAmount,
          status: status || 'pending',
          paidDate: status === 'paid' ? new Date() : null,
          notes: notes || null,
          paymentType: 'monthly',
        },
        include: { player: true },
      });
      return NextResponse.json(payment, { status: 201 });
    }

    if (!paymentType || !startDate || (amount === undefined && totalAmount === undefined && amountPerMonth === undefined && totalPlanAmount === undefined)) {
      return NextResponse.json(
        { error: 'Mungojnë fushat e detyrueshme: paymentType, startDate, dhe shuma' },
        { status: 400 }
      );
    }

    const planStartDate = new Date(startDate);
    const planEndDate = endDate ? new Date(endDate) : null;
    const planId = randomUUID();
    const initialStatus = status || 'pending';

    if (paymentType === 'installment') {
      const rawAmount = parseFloat(totalAmount ?? amount);
      if (isNaN(rawAmount) || rawAmount < 0) {
        return NextResponse.json({ error: 'Shuma nuk mund të jetë negative' }, { status: 400 });
      }

      const numInstallments = parseInt(installments);
      if (!numInstallments || numInstallments < 1) {
        return NextResponse.json({ error: 'Numri i kësteve duhet të jetë të paktën 1' }, { status: 400 });
      }

      if (!planEndDate) {
        return NextResponse.json({ error: 'Data e mbarimit është e detyrueshme për pagesat me këste' }, { status: 400 });
      }

      if (planEndDate <= planStartDate) {
        return NextResponse.json({ error: 'Data e mbarimit duhet të jetë pas datës së fillimit' }, { status: 400 });
      }

      const useCustomAmounts = Array.isArray(installmentAmounts) && installmentAmounts.length === numInstallments;
      const amountEach = Math.round((rawAmount / numInstallments) * 100) / 100;
      const invoices = [];
      let dueDates: Date[];

      if (Array.isArray(installmentDueDates) && installmentDueDates.length === numInstallments) {
        dueDates = installmentDueDates.map((d: string) => new Date(d));
        for (let i = 0; i < dueDates.length; i++) {
          if (isNaN(dueDates[i].getTime()) || dueDates[i] < planStartDate || dueDates[i] > planEndDate) {
            return NextResponse.json({ error: `Data e këstit ${i + 1} duhet të jetë midis datës së fillimit dhe mbarimit` }, { status: 400 });
          }
        }
      } else {
        const totalPeriodMs = planEndDate.getTime() - planStartDate.getTime();
        const intervalMs = totalPeriodMs / numInstallments;
        dueDates = Array.from({ length: numInstallments }, (_, i) =>
          new Date(planStartDate.getTime() + (intervalMs * (i + 1)))
        );
      }

      for (let i = 0; i < numInstallments; i++) {
        const dueDate = dueDates[i];
        const midPeriod = dueDate;

        let thisAmount: number;
        if (useCustomAmounts) {
          const custom = Number(installmentAmounts[i]);
          thisAmount = typeof custom === 'number' && !Number.isNaN(custom) && custom >= 0
            ? Math.round(custom * 100) / 100
            : amountEach;
        } else {
          const isLast = i === numInstallments - 1;
          thisAmount = isLast ? Math.round((rawAmount - amountEach * (numInstallments - 1)) * 100) / 100 : amountEach;
        }

        invoices.push({
          playerId,
          month: midPeriod.getMonth() + 1,
          year: midPeriod.getFullYear(),
          amount: thisAmount,
          creditApplied: 0,
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

      const amountsPaid = Array.isArray(installmentAmountsPaid) && installmentAmountsPaid.length === numInstallments
        ? installmentAmountsPaid.map((p: unknown) => (typeof p === 'number' && !Number.isNaN(p) && p >= 0 ? p : 0))
        : null;

      if (amountsPaid) {
        for (let i = 0; i < numInstallments; i++) {
          const paid = Math.round((amountsPaid[i] as number) * 100) / 100;
          if (paid <= 0) continue;
          const inv = invoices[i] as { amount: number; creditApplied?: number; amountPaid?: number; status: string; paidDate: Date | null };
          const credit = inv.creditApplied ?? 0;
          const amountDue = inv.amount - credit;
          inv.amountPaid = paid;
          inv.status = 'paid';
          inv.paidDate = new Date();
          if (paid >= amountDue) {
            const overpayment = Math.round((paid - amountDue) * 100) / 100;
            if (overpayment > 0 && i + 1 < numInstallments) {
              const next = invoices[i + 1] as { creditApplied?: number };
              next.creditApplied = (next.creditApplied ?? 0) + overpayment;
            }
          } else {
            const shortfall = Math.round((amountDue - paid) * 100) / 100;
            if (i + 1 < numInstallments) {
              const next = invoices[i + 1] as { amount: number };
              next.amount = Math.round((next.amount + shortfall) * 100) / 100;
            }
          }
        }
      }

      const created = await db.payment.createMany({ data: invoices });
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

    if (paymentType === 'monthly') {
      if (!planEndDate) {
        return NextResponse.json({ error: 'Data e mbarimit është e detyrueshme për pagesat mujore' }, { status: 400 });
      }

      const startYear = planStartDate.getFullYear();
      const startMonth = planStartDate.getMonth();
      const endYear = planEndDate.getFullYear();
      const endMonth = planEndDate.getMonth();
      const totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;

      if (totalMonths < 1) {
        return NextResponse.json({ error: 'Data e mbarimit duhet të jetë në ose pas datës së fillimit' }, { status: 400 });
      }

      let amountPerInvoice: number;

      if (totalPlanAmount !== undefined && totalPlanAmount !== null && totalPlanAmount !== '') {
        const parsedTotal = parseFloat(totalPlanAmount);
        if (isNaN(parsedTotal) || parsedTotal < 0) {
          return NextResponse.json({ error: 'Shuma totale nuk mund të jetë negative' }, { status: 400 });
        }
        amountPerInvoice = Math.round((parsedTotal / totalMonths) * 100) / 100;
      } else {
        const rawPerMonth = parseFloat(amountPerMonth ?? totalAmount ?? amount);
        if (isNaN(rawPerMonth) || rawPerMonth < 0) {
          return NextResponse.json({ error: 'Shuma nuk mund të jetë negative' }, { status: 400 });
        }
        amountPerInvoice = rawPerMonth;
      }

      const dueDay = planStartDate.getDate();
      const invoices = [];

      for (let i = 0; i < totalMonths; i++) {
        let invoiceMonth = startMonth + i;
        let invoiceYear = startYear;

        invoiceYear += Math.floor(invoiceMonth / 12);
        invoiceMonth = invoiceMonth % 12;

        const lastDayOfMonth = new Date(invoiceYear, invoiceMonth + 1, 0).getDate();
        const cappedDay = Math.min(dueDay, lastDayOfMonth);
        const dueDate = new Date(invoiceYear, invoiceMonth, cappedDay);

        invoices.push({
          playerId,
          month: invoiceMonth + 1,
          year: invoiceYear,
          amount: amountPerInvoice,
          status: initialStatus,
          paidDate: initialStatus === 'paid' ? new Date() : null,
          notes: notes || null,
          paymentType: 'monthly',
          planId,
          planStartDate,
          planEndDate,
          dueDate,
          installmentNumber: i + 1,
          totalInstallments: totalMonths,
        });
      }

      const created = await db.payment.createMany({ data: invoices });
      const payments = await db.payment.findMany({
        where: { planId },
        include: { player: true },
        orderBy: { installmentNumber: 'asc' },
      });

      return NextResponse.json(
        { count: created.count, totalPlanned: totalMonths, payments },
        { status: 201 }
      );
    }

    return NextResponse.json({ error: 'Lloji i pagesës është i pavlefshëm' }, { status: 400 });
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ error: 'Krijimi i pagesës dështoi' }, { status: 500 });
  }
}
