import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/payments/generate-due
// Checks all active monthly payment plans and creates invoices for months
// that are due (i.e. today >= the plan's due-day for this month) but haven't been created yet.
export async function POST() {
    try {
        const today = new Date();
        const todayDay = today.getDate();
        const todayMonth = today.getMonth() + 1; // 1-indexed
        const todayYear = today.getFullYear();

        // Find all monthly payments that have a planId (they belong to a plan)
        const monthlyPayments = await db.payment.findMany({
            where: {
                paymentType: 'monthly',
                planId: { not: null },
            },
        });

        if (monthlyPayments.length === 0) {
            return NextResponse.json({ message: 'Nuk u gjetën planera mujore', created: 0 });
        }

        // Group by planId to get plan metadata
        const plans = new Map<string, typeof monthlyPayments[0]>();
        const existingMonthYearByPlan = new Map<string, Set<string>>();

        for (const p of monthlyPayments) {
            if (!p.planId) continue;

            // Track plan metadata (use any invoice to get it, they all share the same plan info)
            if (!plans.has(p.planId)) {
                plans.set(p.planId, p);
                existingMonthYearByPlan.set(p.planId, new Set());
            }
            // Record which month/year invoices already exist for this plan
            existingMonthYearByPlan.get(p.planId)!.add(`${p.year}-${p.month}`);
        }

        const toCreate: Parameters<typeof db.payment.createMany>[0]['data'] = [];

        for (const [planId, planMeta] of plans) {
            const existing = existingMonthYearByPlan.get(planId)!;
            const planStart = planMeta.planStartDate ? new Date(planMeta.planStartDate) : null;
            const planEnd = planMeta.planEndDate ? new Date(planMeta.planEndDate) : null;
            const totalInstallments = planMeta.totalInstallments ?? 0;

            if (!planStart || !planEnd) continue;

            const dueDay = planStart.getDate(); // e.g. 5 if start was the 5th

            // Only generate if today's day >= the due day for this month
            if (todayDay < dueDay) continue;

            // Current month due date
            const candidateDue = new Date(todayYear, todayMonth - 1, dueDay);

            // Check: candidate is within plan range
            if (candidateDue < planStart || candidateDue > planEnd) continue;

            // Check: invoice for this month/year doesn't already exist
            const key = `${todayYear}-${todayMonth}`;
            if (existing.has(key)) continue;

            // Determine installment number (how many months since start + 1)
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
