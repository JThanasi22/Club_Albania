import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST() {
    try {
        const today = new Date();
        const todayDay = today.getDate();
        const todayMonth = today.getMonth() + 1;
        const todayYear = today.getFullYear();

        const monthlyPayments = await db.payment.findMany({
            where: {
                paymentType: 'monthly',
                planId: { not: null },
            },
        });

        if (monthlyPayments.length === 0) {
            return NextResponse.json({ message: 'Nuk u gjetën planera mujore', created: 0 });
        }

        const plans = new Map<string, typeof monthlyPayments[0]>();
        const existingMonthYearByPlan = new Map<string, Set<string>>();

        for (const p of monthlyPayments) {
            if (!p.planId) continue;

            if (!plans.has(p.planId)) {
                plans.set(p.planId, p);
                existingMonthYearByPlan.set(p.planId, new Set());
            }
            existingMonthYearByPlan.get(p.planId)!.add(`${p.year}-${p.month}`);
        }

        const toCreate: Parameters<typeof db.payment.createMany>[0]['data'] = [];

        for (const [planId, planMeta] of plans) {
            const existing = existingMonthYearByPlan.get(planId)!;
            const planStart = planMeta.planStartDate ? new Date(planMeta.planStartDate) : null;
            const planEnd = planMeta.planEndDate ? new Date(planMeta.planEndDate) : null;
            const totalInstallments = planMeta.totalInstallments ?? 0;

            if (!planStart || !planEnd) continue;

            const dueDay = planStart.getDate();
            const lastDayOfCurrentMonth = new Date(todayYear, todayMonth, 0).getDate();
            const dueDayForMonth = Math.min(dueDay, lastDayOfCurrentMonth);

            if (todayDay < dueDayForMonth) continue;

            const candidateDue = new Date(todayYear, todayMonth - 1, dueDayForMonth);

            if (candidateDue < planStart || candidateDue > planEnd) continue;

            const key = `${todayYear}-${todayMonth}`;
            if (existing.has(key)) continue;

            const monthsSinceStart =
                (todayYear - planStart.getFullYear()) * 12 +
                (todayMonth - (planStart.getMonth() + 1));
            const installmentNumber = monthsSinceStart + 1;

            if (installmentNumber > totalInstallments) continue;

            toCreate.push({
                playerId: planMeta.playerId,
                month: todayMonth,
                year: todayYear,
                amount: planMeta.amount,
                status: 'pending',
                paidDate: null,
                notes: planMeta.notes,
                paymentType: 'monthly',
                planId,
                planStartDate: planMeta.planStartDate,
                planEndDate: planMeta.planEndDate,
                dueDate: candidateDue,
                installmentNumber,
                totalInstallments,
            });
        }

        if (toCreate.length === 0) {
            return NextResponse.json({ message: 'Nuk ka fatura të dakshme në këtë kohë', created: 0 });
        }

        const result = await db.payment.createMany({ data: toCreate });
        return NextResponse.json({
            message: `U krijuan ${result.count} fatura`,
            created: result.count,
        });
    } catch (error) {
        console.error('Error generating due invoices:', error);
        return NextResponse.json({ error: 'Gjenerimi i faturave dështoi' }, { status: 500 });
    }
}
