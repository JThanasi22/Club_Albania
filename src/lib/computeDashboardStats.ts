import { db } from '@/lib/db';

type PaymentEntry = { amount: number; date: string };

function sumPaymentHistory(history: PaymentEntry[] | null): number {
  if (!Array.isArray(history)) return 0;
  return history.reduce((s, e) => s + (e?.amount ?? 0), 0);
}

export type DashboardStatsPayload = {
  totalPlayers: number;
  activePlayerCount: number;
  inactivePlayerCount: number;
  totalExpectedAmount: number;
  amountCollectedAllTime: number;
  currentMonth: {
    month: number;
    year: number;
    paid: number;
    pending: number;
    totalExpected: number;
    collectionRate: number;
    amountCollected: number;
  };
  allTime: {
    paid: number;
    pending: number;
    overdue: number;
    totalExpected: number;
    collectionRate: number;
    amountCollected: number;
  };
  overall: {
    totalPaid: number;
    totalPending: number;
    totalOverdue: number;
  };
  recentPayments: {
    id: string;
    amount: number;
    paidDate: string;
    player: { id: string; name: string };
  }[];
  playersWithUnpaidBills: {
    id: string;
    name: string;
    team: string | null;
    active: boolean;
    totalPayment: number;
    paymentHistory: unknown;
  }[];
  teamMatches: {
    id: string;
    teamName: string;
    matchDate: string;
    opponent: string;
    isHome: boolean;
    venue: string | null;
  }[];
};

export async function computeDashboardStats(): Promise<DashboardStatsPayload> {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  const [players, teamMatchRows] = await Promise.all([
    db.player.findMany({
      select: {
        id: true,
        name: true,
        team: true,
        active: true,
        totalPayment: true,
        paymentHistory: true,
      },
    }),
    db.teamMatch.findMany({
      select: {
        id: true,
        teamName: true,
        matchDate: true,
        opponent: true,
        isHome: true,
        venue: true,
      },
      orderBy: { matchDate: 'asc' },
    }),
  ]);

  const teamMatches = teamMatchRows.map((m) => ({
    id: m.id,
    teamName: m.teamName,
    matchDate: m.matchDate.toISOString(),
    opponent: m.opponent,
    isHome: m.isHome,
    venue: m.venue,
  }));

  const totalPlayers = players.length;
  const activePlayerCount = players.filter((p) => p.active).length;
  const inactivePlayerCount = totalPlayers - activePlayerCount;
  let totalExpected = 0;
  let amountCollectedAllTime = 0;
  const recentEntries: { amount: number; date: string; playerId: string; playerName: string }[] = [];
  const playersWithUnpaidBills: DashboardStatsPayload['playersWithUnpaidBills'] = [];
  let currentMonthCollected = 0;

  for (const p of players) {
    const total = Number(p.totalPayment) || 0;
    const history = (p.paymentHistory as PaymentEntry[] | null) ?? [];
    const paid = sumPaymentHistory(history);
    totalExpected += total;
    amountCollectedAllTime += paid;
    if (p.active && total > 0 && paid < total) {
      playersWithUnpaidBills.push(p);
    }
    for (const e of history) {
      if (!e?.date) continue;
      const [y, m] = e.date.split('-').map(Number);
      if (m === currentMonth && y === currentYear) {
        currentMonthCollected += e.amount ?? 0;
      }
      if (p.active) {
        recentEntries.push({
          amount: e.amount ?? 0,
          date: e.date,
          playerId: p.id,
          playerName: p.name,
        });
      }
    }
  }

  recentEntries.sort((a, b) => (b.date < a.date ? -1 : b.date > a.date ? 1 : 0));
  const recentPayments = recentEntries.map((e) => ({
    id: `${e.playerId}-${e.date}-${e.amount}`,
    amount: e.amount,
    paidDate: e.date,
    player: { id: e.playerId, name: e.playerName },
  }));

  const collectionRate = totalExpected > 0 ? (amountCollectedAllTime / totalExpected) * 100 : 0;
  const currentMonthRate = totalExpected > 0 ? (currentMonthCollected / totalExpected) * 100 : 0;

  return {
    totalPlayers,
    activePlayerCount,
    inactivePlayerCount,
    totalExpectedAmount: totalExpected,
    amountCollectedAllTime,
    currentMonth: {
      month: currentMonth,
      year: currentYear,
      paid: 0,
      pending: 0,
      totalExpected: totalPlayers,
      collectionRate: currentMonthRate,
      amountCollected: currentMonthCollected,
    },
    allTime: {
      paid: 0,
      pending: 0,
      overdue: 0,
      totalExpected: totalExpected,
      collectionRate,
      amountCollected: amountCollectedAllTime,
    },
    overall: {
      totalPaid: 0,
      totalPending: 0,
      totalOverdue: 0,
    },
    recentPayments,
    playersWithUnpaidBills,
    teamMatches,
  };
}
