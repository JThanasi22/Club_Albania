import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET a single payment
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

// PUT update a payment
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { month, year, amount, status, paidDate, notes } = body;

    const payment = await db.payment.update({
      where: { id },
      data: {
        month: month ? parseInt(month) : undefined,
        year: year ? parseInt(year) : undefined,
        amount: amount !== undefined ? parseFloat(amount) : undefined,
        status: status || undefined,
        paidDate: paidDate ? new Date(paidDate) : (status === 'paid' ? new Date() : undefined),
        notes: notes !== undefined ? notes : undefined,
      },
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


// DELETE a payment
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.payment.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Pagesa u fshi me sukses' });
  } catch (error) {
    console.error('Error deleting payment:', error);
    return NextResponse.json({ error: 'Fshirja e pagesës dështoi' }, { status: 500 });
  }
}
