import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET dashboard statistics
export async function GET() {
  try {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    // Get all players
    const totalPlayers = await db.player.count({
      where: { active: true },
    });

    // Get current month payments
    const currentMonthPayments = await db.payment.findMany({
      where: {
        month: currentMonth,
        year: currentYear,
      },
      include: {
        player: true,
      },
    });

    const paidThisMonth = currentMonthPayments.filter(p => p.status === 'paid').length;
    const pendingThisMonth = currentMonthPayments.filter(p => p.status === 'pending').length;
    const totalAmountCollected = currentMonthPayments
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + p.amount, 0);

    // Get total payments by status
    const allPayments = await db.payment.findMany();
    const totalPaid = allPayments.filter(p => p.status === 'paid').length;
    const totalPending = allPayments.filter(p => p.status === 'pending').length;
    const totalOverdue = allPayments.filter(p => p.status === 'overdue').length;

    // Get recent payments
    const recentPayments = await db.payment.findMany({
      where: {
        status: 'paid',
      },
      include: {
        player: true,
      },
      orderBy: {
        paidDate: 'desc',
      },
      take: 5,
    });

    // Get players who haven't paid this month
    const playersNotPaidThisMonth = await db.player.findMany({
      where: {
        active: true,
        NOT: {
          payments: {
            some: {
              month: currentMonth,
              year: currentYear,
              status: 'paid',
            },
          },
        },
      },
    });

    return NextResponse.json({
      totalPlayers,
      currentMonth: {
        month: currentMonth,
        year: currentYear,
        paid: paidThisMonth,
        pending: pendingThisMonth,
        totalExpected: totalPlayers,
        collectionRate: totalPlayers > 0 ? (paidThisMonth / totalPlayers) * 100 : 0,
        amountCollected: totalAmountCollected,
      },
      overall: {
        totalPaid,
        totalPending,
        totalOverdue,
      },
      recentPayments,
      playersNotPaidThisMonth,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Marrja e statistikave dështoi' }, { status: 500 });
  }
}
