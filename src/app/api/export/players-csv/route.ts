import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdminSessionFromCookies } from '@/lib/adminSessionCookie';
import { getPlayerPaymentSummary, type PaymentEntry } from '@/lib/playerPaymentSummary';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET() {
  try {
    const admin = await getAdminSessionFromCookies();
    if (!admin) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const players = await db.player.findMany({
      include: {
        _count: { select: { payments: true } },
      },
      orderBy: { name: 'asc' },
    });

    const headers = [
      'player_id',
      'name',
      'team',
      'active',
      'email',
      'phone',
      'jersey_number',
      'join_date',
      'date_of_birth',
      'total_contract_expected',
      'paid_from_payment_history',
      'balance_left',
      'invoice_row_count',
      'last_history_payment_date',
    ];

    const lines = [headers.map(csvEscape).join(',')];

    for (const p of players) {
      const history = (p.paymentHistory as PaymentEntry[] | null) ?? [];
      const summary = getPlayerPaymentSummary({
        totalPayment: p.totalPayment,
        paymentHistory: history,
      });
      const lastDate =
        history.length > 0
          ? history.reduce((best, e) => (!best || (e.date ?? '') > best ? (e.date ?? '') : best), '')
          : '';
      const row = [
        p.id,
        p.name,
        p.team ?? '',
        p.active ? 'yes' : 'no',
        p.email ?? '',
        p.phone ?? '',
        p.jerseyNumber != null ? String(p.jerseyNumber) : '',
        p.joinDate.toISOString().slice(0, 10),
        p.dateOfBirth ? p.dateOfBirth.toISOString().slice(0, 10) : '',
        String(summary.totalBills),
        String(summary.amountPaid),
        String(summary.amountLeft),
        String(p._count.payments),
        lastDate,
      ].map((c) => csvEscape(String(c)));
      lines.push(row.join(','));
    }

    const body = lines.join('\r\n');
    const asciiName = 'club-albania-players.csv';

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${asciiName}"`,
      },
    });
  } catch (error) {
    console.error('players-csv export error:', error);
    return NextResponse.json({ error: 'export_failed' }, { status: 500 });
  }
}
