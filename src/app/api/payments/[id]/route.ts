import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payment = await db.payment.findUnique({
      where: { id },
      include: {
        player: true,
      },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Pagesa nuk u gjet' }, { status: 404 });
    }

    return NextResponse.json(payment);
  } catch (error) {
    console.error('Error fetching payment:', error);
    return NextResponse.json({ error: 'Marrja e pagesës dështoi' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { month, year, amount, status, paidDate, notes, amountPaid, dueDate } = body;

    const existing = await db.payment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Pagesa nuk u gjet' }, { status: 404 });
    }

    let resolvedPaidDate: Date | null | undefined = undefined;
    if (paidDate) {
      resolvedPaidDate = new Date(paidDate);
    } else if (status === 'paid' && existing.status !== 'paid') {
      resolvedPaidDate = new Date();
    } else if (status && status !== 'paid' && existing.status === 'paid') {
      resolvedPaidDate = null;
    }

    if (amountPaid !== undefined && amountPaid !== null && existing.paymentType === 'installment' && existing.planId) {
      const paid = parseFloat(amountPaid);
      if (isNaN(paid) || paid < 0) {
        return NextResponse.json({ error: 'Shuma e paguar duhet të jetë numër pozitiv' }, { status: 400 });
      }

      const creditApplied = existing.creditApplied ?? 0;
      const amountDue = existing.amount - creditApplied;

      const payment = await db.payment.update({
        where: { id },
        data: {
          amountPaid: paid,
          status: 'paid',
          paidDate: new Date(),
          notes: notes !== undefined ? notes : undefined,
        },
        include: { player: true },
      });

      if (paid >= amountDue) {
        const overpayment = Math.round((paid - amountDue) * 100) / 100;
        if (overpayment > 0 && existing.installmentNumber != null) {
          const nextInvoice = await db.payment.findFirst({
            where: {
              planId: existing.planId,
              installmentNumber: existing.installmentNumber + 1,
            },
          });

          if (nextInvoice) {
            await db.payment.update({
              where: { id: nextInvoice.id },
              data: {
                creditApplied: (nextInvoice.creditApplied ?? 0) + overpayment,
              },
            });
          }
        }
      } else if (existing.installmentNumber != null) {
        const shortfall = Math.round((amountDue - paid) * 100) / 100;
        const nextInvoice = await db.payment.findFirst({
          where: {
            planId: existing.planId,
            installmentNumber: existing.installmentNumber + 1,
          },
        });

        if (nextInvoice) {
          await db.payment.update({
            where: { id: nextInvoice.id },
            data: {
              amount: nextInvoice.amount + shortfall,
            },
          });
        }
      }

      return NextResponse.json(payment);
    }

    const updateData: {
      month?: number;
      year?: number;
      amount?: number;
      status?: string;
      paidDate?: Date | null;
      notes?: string;
      dueDate?: Date;
    } = {
      month: month ? parseInt(month) : undefined,
      year: year ? parseInt(year) : undefined,
      amount: amount !== undefined ? parseFloat(amount) : undefined,
      status: status || undefined,
      paidDate: resolvedPaidDate,
      notes: notes !== undefined ? notes : undefined,
    };
    if (dueDate != null && existing.paymentType === 'installment') {
      const parsedDue = new Date(dueDate);
      if (!Number.isNaN(parsedDue.getTime())) {
        updateData.dueDate = parsedDue;
        updateData.month = parsedDue.getMonth() + 1;
        updateData.year = parsedDue.getFullYear();
      }
    }

    const payment = await db.payment.update({
      where: { id },
      data: updateData,
      include: {
        player: true,
      },
    });

    return NextResponse.json(payment);
  } catch (error) {
    console.error('Error updating payment:', error);
    return NextResponse.json({ error: 'Përditësimi i pagesës dështoi' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.payment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Pagesa nuk u gjet' }, { status: 404 });
    }

    await db.payment.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Pagesa u fshi me sukses' });
  } catch (error) {
    console.error('Error deleting payment:', error);
    return NextResponse.json({ error: 'Fshirja e pagesës dështoi' }, { status: 500 });
  }
}
