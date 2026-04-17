import {
  FunctionCallingMode,
  GoogleGenerativeAI,
  GoogleGenerativeAIFetchError,
  type Content,
  type Part,
} from '@google/generative-ai';
import type { AdminChatArtifact } from '@/lib/adminAssistantArtifacts';
import { executeAdminAssistantTool, getAdminAssistantToolDeclarations } from '@/lib/adminAssistantTools';

export type AdminChatClientMessage = { role: 'user' | 'assistant'; content: string };

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

const MODEL_FALLBACK_CHAIN = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-1.5-flash',
  'gemini-2.0-flash',
] as const;

const SYSTEM_INSTRUCTION = [
  'You are the Club Albania volleyball admin assistant.',
  'Understand user messages in Albanian or English (and mixed input).',
  'Always write your entire reply to the user in standard Albanian (shqip), including explanations, lists, and headings—even if the user wrote in English.',
  'Use Albanian club terms where natural: lojtar, pagesë, faturë, arkëtim, bilanc, kontratë, ekip.',
  'You MUST call the provided tools whenever the user asks for numbers, lists, balances, invoices, exports, PDFs, or CSV/Excel data. Never invent figures.',
  'Use get_dashboard_stats for club-wide overview.',
  'Use list_players to search or list players with balances.',
  'Use get_player_detail for one player including invoice rows.',
  'Use query_invoices for filters on the billing/invoice table.',
  'When the user wants a payment PDF for a player, call prepare_player_payment_pdf with their player_id.',
  'When the user wants a spreadsheet of all players (Excel/CSV/export), call prepare_all_players_csv_export.',
  'After tools return, answer only in Albanian. Mention downloads briefly; the UI also shows download buttons.',
].join(' ');

const MAX_TOOL_ROUNDS = 14;

function responseTextSafe(response: { text: () => string }): string {
  try {
    return response.text();
  } catch {
    return '';
  }
}

function orderedModels(primary: string): string[] {
  const first = primary.trim() || DEFAULT_GEMINI_MODEL;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of [first, ...MODEL_FALLBACK_CHAIN]) {
    if (seen.has(m)) continue;
    seen.add(m);
    out.push(m);
  }
  return out;
}

function shouldTryNextModel(e: unknown): boolean {
  if (e instanceof GoogleGenerativeAIFetchError) {
    const s = e.status ?? 0;
    return s === 429 || s === 404 || s === 503;
  }
  return false;
}

async function runAdminAssistantSingleModel(params: {
  apiKey: string;
  modelName: string;
  historyContents: Content[];
  lastUserText: string;
}): Promise<{ reply: string; artifacts: AdminChatArtifact[] }> {
  const ctx = { artifacts: [] as AdminChatArtifact[] };
  const genAI = new GoogleGenerativeAI(params.apiKey);
  const model = genAI.getGenerativeModel({
    model: params.modelName,
    systemInstruction: SYSTEM_INSTRUCTION,
    tools: [{ functionDeclarations: getAdminAssistantToolDeclarations() }],
    toolConfig: {
      functionCallingConfig: {
        mode: FunctionCallingMode.AUTO,
      },
    },
    generationConfig: { maxOutputTokens: 8192 },
  });

  const chat = model.startChat({
    history: params.historyContents,
  });

  let result = await chat.sendMessage(params.lastUserText);
  let response = result.response;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const calls = response.functionCalls?.();
    if (!calls?.length) break;

    const functionResponseParts: Part[] = [];
    for (const call of calls) {
      const name = call.name;
      const args = (call.args ?? {}) as Record<string, unknown>;
      let payload: Record<string, unknown>;
      try {
        payload = await executeAdminAssistantTool(name, args, ctx);
      } catch (e) {
        payload = { error: 'tool_execution_failed', detail: String(e) };
      }
      functionResponseParts.push({
        functionResponse: {
          name,
          response: payload as object,
        },
      });
    }

    result = await chat.sendMessage(functionResponseParts);
    response = result.response;
  }

  const reply = responseTextSafe(response).trim();
  return { reply: reply || '…', artifacts: ctx.artifacts };
}

export async function runAdminAssistantGemini(params: {
  apiKey: string;
  modelName: string;
  historyContents: Content[];
  lastUserText: string;
}): Promise<{ reply: string; artifacts: AdminChatArtifact[] }> {
  const candidates = orderedModels(params.modelName);
  let lastError: unknown;
  for (const modelName of candidates) {
    try {
      return await runAdminAssistantSingleModel({
        apiKey: params.apiKey,
        modelName,
        historyContents: params.historyContents,
        lastUserText: params.lastUserText,
      });
    } catch (e) {
      lastError = e;
      if (shouldTryNextModel(e)) continue;
      throw e;
    }
  }
  throw lastError;
}
