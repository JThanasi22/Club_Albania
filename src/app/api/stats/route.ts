import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    const totalPlayers = await db.player.count({
      where: { active: true },
    });

    const currentMonthPayments = await db.payment.findMany({
      where: {
        month: currentMonth,
        year: currentYear,
      },
      include: {
        player: true,
      },
    });

    const paidInvoices = currentMonthPayments.filter(p => p.status === 'paid');
    const pendingThisMonth = currentMonthPayments.filter(p => p.status === 'pending').length;
    const totalAmountCollected = paidInvoices.reduce((sum, p) => sum + p.amount, 0);

    const distinctPaidPlayerIds = new Set(paidInvoices.map(p => p.playerId));
    const paidPlayersCount = distinctPaidPlayerIds.size;

    const allPayments = await db.payment.findMany({
      select: { status: true },
    });
    const totalPaid = allPayments.filter(p => p.status === 'paid').length;
    const totalPending = allPayments.filter(p => p.status === 'pending').length;
    const totalOverdue = allPayments.filter(p => p.status === 'overdue').length;

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
        paid: paidPlayersCount,
        pending: pendingThisMonth,
        totalExpected: totalPlayers,
        collectionRate: totalPlayers > 0 ? (paidPlayersCount / totalPlayers) * 100 : 0,
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
