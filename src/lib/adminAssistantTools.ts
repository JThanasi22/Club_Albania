import { SchemaType, type FunctionDeclaration } from '@google/generative-ai';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { computeDashboardStats } from '@/lib/computeDashboardStats';
import { getPlayerPaymentSummary, type PaymentEntry } from '@/lib/playerPaymentSummary';
import type { AdminChatArtifact } from '@/lib/adminAssistantArtifacts';
import { mergeArtifactsUnique } from '@/lib/adminAssistantArtifacts';

export type ToolContext = {
  artifacts: AdminChatArtifact[];
};

const MAX_INVOICES_LIST = 300;
const MAX_PLAYER_INVOICES = 400;

export function getAdminAssistantToolDeclarations(): FunctionDeclaration[] {
  return [
    {
      name: 'get_dashboard_stats',
      description:
        'Returns club-wide stats: player counts, total expected vs collected, collection rates, recent paymentHistory entries, and players who still owe (unpaid balance). Use for overview questions.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {},
      },
    },
    {
      name: 'list_players',
      description:
        'Lists players with id, name, team, active flag, contract total (totalPayment), paid from paymentHistory, and balance left. Optional text search on name and filter by team or activeOnly.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          search_name: {
            type: SchemaType.STRING,
            description: 'Substring to match against player name (case-insensitive).',
            nullable: true,
          },
          team: {
            type: SchemaType.STRING,
            description: 'Exact team label e.g. U20, U18.',
            nullable: true,
          },
          active_only: {
            type: SchemaType.BOOLEAN,
            description: 'If true, only active players.',
            nullable: true,
          },
          limit: {
            type: SchemaType.INTEGER,
            description: 'Max rows (default 150, max 250).',
            nullable: true,
          },
        },
      },
    },
    {
      name: 'get_player_detail',
      description:
        'Full detail for one player by Mongo id: profile fields, paymentHistory, computed balance, and invoice/payment plan rows (payments table). Use when the user names a specific player or you need invoice-level data.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          player_id: {
            type: SchemaType.STRING,
            description: 'Player _id from list_players or dashboard stats.',
          },
        },
        required: ['player_id'],
      },
    },
    {
      name: 'query_invoices',
      description:
        'Query billing invoices (Payment model): filter by player_id, status (paid/pending/overdue), calendar month/year. Returns rows with player name, amounts, due dates.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          player_id: { type: SchemaType.STRING, nullable: true },
          status: { type: SchemaType.STRING, nullable: true },
          year: { type: SchemaType.INTEGER, nullable: true },
          month: { type: SchemaType.INTEGER, nullable: true },
          limit: {
            type: SchemaType.INTEGER,
            description: 'Max rows (default 80, max 300).',
            nullable: true,
          },
        },
      },
    },
    {
      name: 'prepare_player_payment_pdf',
      description:
        'Registers a same-origin download link for the official player payment summary PDF. Call when the user asks for a PDF for a player. Requires player_id.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          player_id: { type: SchemaType.STRING, description: 'Player Mongo id.' },
        },
        required: ['player_id'],
      },
    },
    {
      name: 'prepare_all_players_csv_export',
      description:
        'Registers a download link for a CSV spreadsheet of all players (profile + balance + invoice counts). Use when the user asks for Excel/CSV/export of all players.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {},
      },
    },
  ] as FunctionDeclaration[];
}

function clampInt(n: unknown, def: number, min: number, max: number): number {
  const v = typeof n === 'number' ? n : typeof n === 'string' ? parseInt(n, 10) : def;
  if (Number.isNaN(v)) return def;
  return Math.min(max, Math.max(min, v));
}

export async function executeAdminAssistantTool(
  name: string,
  rawArgs: Record<string, unknown>,
  ctx: ToolContext
): Promise<Record<string, unknown>> {
  switch (name) {
    case 'get_dashboard_stats': {
      const stats = await computeDashboardStats();
      return { stats };
    }
    case 'list_players': {
      const searchName = typeof rawArgs.search_name === 'string' ? rawArgs.search_name.trim() : '';
      const team = typeof rawArgs.team === 'string' ? rawArgs.team.trim() : '';
      const activeOnly = rawArgs.active_only === true;
      const limit = clampInt(rawArgs.limit, 150, 1, 250);

      const where: Prisma.PlayerWhereInput = {};
      if (activeOnly) where.active = true;
      if (team) where.team = team;
      if (searchName) {
        where.name = { contains: searchName, mode: 'insensitive' };
      }

      const rows = await db.player.findMany({
        where,
        select: {
          id: true,
          name: true,
          team: true,
          active: true,
          totalPayment: true,
          paymentHistory: true,
        },
        orderBy: { name: 'asc' },
        take: limit,
      });

      const players = rows.map((p) => {
        const summary = getPlayerPaymentSummary({
          totalPayment: p.totalPayment,
          paymentHistory: (p.paymentHistory as PaymentEntry[] | null) ?? [],
        });
        return {
          id: p.id,
          name: p.name,
          team: p.team,
          active: p.active,
          total_contract_expected: summary.totalBills,
          paid_from_history: summary.amountPaid,
          balance_left: summary.amountLeft,
        };
      });
      return { count: players.length, players };
    }
    case 'get_player_detail': {
      const playerId = String(rawArgs.player_id ?? '').trim();
      if (!playerId) return { error: 'missing_player_id' };
      const player = await db.player.findUnique({
        where: { id: playerId },
        include: {
          payments: {
            orderBy: [{ year: 'desc' }, { month: 'desc' }],
            take: MAX_PLAYER_INVOICES,
          },
        },
      });
      if (!player) return { error: 'player_not_found', player_id: playerId };
      const history = (player.paymentHistory as PaymentEntry[] | null) ?? [];
      const summary = getPlayerPaymentSummary({
        totalPayment: player.totalPayment,
        paymentHistory: history,
      });
      const invoicesTruncated = player.payments.length >= MAX_PLAYER_INVOICES;
      return {
        player: {
          id: player.id,
          name: player.name,
          email: player.email,
          phone: player.phone,
          team: player.team,
          jersey_number: player.jerseyNumber,
          active: player.active,
          join_date: player.joinDate.toISOString(),
          date_of_birth: player.dateOfBirth?.toISOString() ?? null,
          photo_url: player.photo,
          total_contract_expected: summary.totalBills,
          paid_from_history: summary.amountPaid,
          balance_left: summary.amountLeft,
          payment_history: history,
          invoices: player.payments.map((inv) => ({
            id: inv.id,
            month: inv.month,
            year: inv.year,
            amount: inv.amount,
            status: inv.status,
            amount_paid: inv.amountPaid,
            credit_applied: inv.creditApplied,
            due_date: inv.dueDate?.toISOString() ?? null,
            paid_date: inv.paidDate?.toISOString() ?? null,
            payment_type: inv.paymentType,
            installment_number: inv.installmentNumber,
            total_installments: inv.totalInstallments,
            notes: inv.notes,
          })),
          invoices_truncated: invoicesTruncated,
        },
      };
    }
    case 'query_invoices': {
      const playerId = typeof rawArgs.player_id === 'string' ? rawArgs.player_id.trim() : '';
      const status = typeof rawArgs.status === 'string' ? rawArgs.status.trim() : '';
      const limit = clampInt(rawArgs.limit, 80, 1, MAX_INVOICES_LIST);

      const where: Prisma.PaymentWhereInput = {};
      if (playerId) where.playerId = playerId;
      if (status) where.status = status;
      if (rawArgs.year !== undefined && rawArgs.year !== null && rawArgs.year !== '') {
        const y = typeof rawArgs.year === 'number' ? rawArgs.year : parseInt(String(rawArgs.year), 10);
        if (!Number.isNaN(y)) where.year = y;
      }
      if (rawArgs.month !== undefined && rawArgs.month !== null && rawArgs.month !== '') {
        const m = typeof rawArgs.month === 'number' ? rawArgs.month : parseInt(String(rawArgs.month), 10);
        if (!Number.isNaN(m)) where.month = m;
      }

      const list = await db.payment.findMany({
        where,
        include: { player: { select: { id: true, name: true } } },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: limit,
      });

      return {
        count: list.length,
        invoices: list.map((inv) => ({
          id: inv.id,
          player_id: inv.playerId,
          player_name: inv.player.name,
          month: inv.month,
          year: inv.year,
          amount: inv.amount,
          status: inv.status,
          amount_paid: inv.amountPaid,
          credit_applied: inv.creditApplied,
          due_date: inv.dueDate?.toISOString() ?? null,
          paid_date: inv.paidDate?.toISOString() ?? null,
          payment_type: inv.paymentType,
          notes: inv.notes,
        })),
      };
    }
    case 'prepare_player_payment_pdf': {
      const playerId = String(rawArgs.player_id ?? '').trim();
      if (!playerId) return { error: 'missing_player_id' };
      const player = await db.player.findUnique({
        where: { id: playerId },
        select: { id: true, name: true },
      });
      if (!player) return { error: 'player_not_found', player_id: playerId };
      const url = `/api/players/${player.id}/payment-pdf`;
      ctx.artifacts = mergeArtifactsUnique(ctx.artifacts, [
        {
          url,
          label: `PDF — ${player.name}`,
          mimeType: 'application/pdf',
        },
      ]);
      return {
        ok: true,
        player_name: player.name,
        relative_download_path: url,
        hint: 'Njofto përdoruesin se një buton shkarkimi për PDF shfaqet poshtë përgjigjes (e njëjta sesion).',
      };
    }
    case 'prepare_all_players_csv_export': {
      const url = '/api/export/players-csv';
      ctx.artifacts = mergeArtifactsUnique(ctx.artifacts, [
        {
          url,
          label: 'CSV — all players',
          mimeType: 'text/csv',
        },
      ]);
      return {
        ok: true,
        relative_download_path: url,
        hint: 'Njofto përdoruesin se një buton për skedarin CSV shfaqet poshtë përgjigjes; mund ta hapë në Excel.',
      };
    }
    default:
      return { error: 'unknown_tool', name };
  }
}
