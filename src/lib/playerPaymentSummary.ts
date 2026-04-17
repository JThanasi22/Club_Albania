export type PaymentEntry = { amount: number; date: string };

export type PlayerPaymentSummaryInput = {
  totalPayment?: number | null;
  paymentHistory?: PaymentEntry[] | null;
};

export function getPlayerPaymentSummary(player: PlayerPaymentSummaryInput) {
  const total = Number(player.totalPayment) || 0;
  const history = player.paymentHistory ?? [];
  const amountPaid = history.reduce((sum, e) => sum + (e?.amount ?? 0), 0);
  const amountLeft = total - amountPaid;
  return { totalBills: total, amountPaid, amountLeft };
}
