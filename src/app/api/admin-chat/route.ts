import { NextResponse } from 'next/server';
import { z } from 'zod';
import { GoogleGenerativeAIFetchError } from '@google/generative-ai';
import { getAdminSessionFromCookies } from '@/lib/adminSessionCookie';
import { runAdminAssistantGemini, type AdminChatClientMessage } from '@/lib/adminAssistantGemini';
import type { Content } from '@google/generative-ai';

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(12000),
      })
    )
    .min(1)
    .max(40),
});

function isAlternatingUserAssistant(messages: { role: string }[]): boolean {
  if (messages[0]?.role !== 'user') return false;
  for (let i = 1; i < messages.length; i++) {
    const expected = i % 2 === 1 ? 'assistant' : 'user';
    if (messages[i].role !== expected) return false;
  }
  return true;
}

function toGeminiHistory(messages: AdminChatClientMessage[]): Content[] {
  return messages.slice(0, -1).map((m) => ({
    role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
    parts: [{ text: m.content }],
  }));
}

export async function POST(request: Request) {
  try {
    const admin = await getAdminSessionFromCookies();
    if (!admin) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'missing_api_key' }, { status: 503 });
    }

    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }

    const { messages } = parsed.data;
    if (!isAlternatingUserAssistant(messages)) {
      return NextResponse.json({ error: 'invalid_message_order' }, { status: 400 });
    }

    const last = messages[messages.length - 1];
    if (last.role !== 'user') {
      return NextResponse.json({ error: 'last_must_be_user' }, { status: 400 });
    }

    const modelName = (process.env.GEMINI_MODEL ?? '').trim() || 'gemini-2.5-flash';
    const historyContents = toGeminiHistory(messages);

    const { reply, artifacts } = await runAdminAssistantGemini({
      apiKey,
      modelName,
      historyContents,
      lastUserText: last.content,
    });

    return NextResponse.json({ reply, artifacts });
  } catch (error) {
    console.error('admin-chat error:', error);
    if (error instanceof GoogleGenerativeAIFetchError) {
      if (error.status === 429) {
        return NextResponse.json({ error: 'rate_limit' }, { status: 429 });
      }
      if (error.status === 400 || error.status === 403) {
        return NextResponse.json({ error: 'gemini_auth' }, { status: 502 });
      }
    }
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
