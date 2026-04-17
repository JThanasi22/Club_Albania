'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, ChevronsRight, Download, Loader2, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { getAssistantChatLabels } from '@/lang/assistantChat';
import type { AdminChatArtifact } from '@/lib/adminAssistantArtifacts';
import { cn } from '@/lib/utils';

type ChatMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; artifacts?: AdminChatArtifact[] };

export function AdminAssistantChat() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const l = getAssistantChatLabels();

  useEffect(() => {
    if (!open || minimized) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open, minimized, sending]);

  useEffect(() => {
    if (!open || minimized) {
      document.body.style.paddingRight = '';
      return;
    }
    const rail = railRef.current;
    if (!rail) return;
    const apply = () => {
      const w = rail.offsetWidth;
      const vw = typeof window !== 'undefined' ? window.innerWidth : w;
      if (vw - w < 240) {
        document.body.style.paddingRight = '';
        return;
      }
      document.body.style.paddingRight = `${w}px`;
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(rail);
    window.addEventListener('resize', apply);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', apply);
      document.body.style.paddingRight = '';
    };
  }, [open, minimized]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setSending(true);
    try {
      const apiMessages = nextMessages.map((m) =>
        m.role === 'user' ? { role: 'user' as const, content: m.content } : { role: 'assistant' as const, content: m.content }
      );
      const res = await fetch('/api/admin-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messages: apiMessages }),
      });
      const data = (await res.json()) as {
        reply?: string;
        artifacts?: AdminChatArtifact[];
        error?: string;
      };
      if (!res.ok) {
        const err =
          res.status === 401
            ? l.loginRequired
            : res.status === 503 && data.error === 'missing_api_key'
              ? l.configMissing
              : res.status === 429 || data.error === 'rate_limit'
                ? l.errorRateLimit
                : res.status === 502 && data.error === 'gemini_auth'
                  ? l.errorGeminiAuth
                  : l.errorGeneric;
        setMessages((prev) => [...prev, { role: 'assistant', content: err }]);
        return;
      }
      if (data.reply) {
        const arts = Array.isArray(data.artifacts) ? data.artifacts : [];
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.reply!,
            artifacts: arts.length > 0 ? arts : undefined,
          },
        ]);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: l.errorGeneric }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: l.errorGeneric }]);
    } finally {
      setSending(false);
    }
  }, [input, sending, messages, l]);

  const handleClose = () => {
    setOpen(false);
    setMinimized(false);
  };

  const handleOpenFab = () => {
    setOpen(true);
    setMinimized(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpenFab}
        className={cn(
          'fixed top-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg ring-2 ring-orange-200/80 transition hover:bg-orange-600 focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:outline-none dark:ring-orange-900/50',
          open && !minimized && 'pointer-events-none opacity-0'
        )}
        aria-label={l.openChat}
      >
        <Bot className="h-6 w-6" aria-hidden />
      </button>

      {open && minimized && (
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="fixed top-1/2 right-0 z-[60] flex h-44 w-12 -translate-y-1/2 flex-col items-center justify-center gap-2 rounded-l-md border border-r-0 border-orange-600/40 bg-orange-500 text-white shadow-lg transition hover:bg-orange-600"
          aria-label={l.expandPanel}
        >
          <Bot className="h-6 w-6 shrink-0" aria-hidden />
          <span
            className="select-none text-center text-[11px] font-semibold uppercase leading-tight tracking-wider text-white/95"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            {l.assistantTabMark}
          </span>
        </button>
      )}

      <div
        ref={railRef}
        className={cn(
          'pointer-events-none fixed top-0 right-0 z-50 flex h-dvh max-w-[100vw] flex-row border-l border-border bg-background shadow-2xl transition-transform duration-300 ease-out',
          'w-[calc(3rem+min(32rem,calc(100vw-4rem)))] sm:w-[calc(3rem+min(32rem,calc(100vw-1rem)))]',
          !open && 'translate-x-full',
          open && minimized && 'translate-x-full'
        )}
      >
        <div className="pointer-events-auto flex min-h-0 w-[min(32rem,calc(100vw-4rem))] shrink-0 flex-col sm:w-[min(32rem,calc(100vw-1rem))]">
          <div className="flex shrink-0 items-start justify-between gap-2 border-b px-4 py-3">
            <div className="min-w-0 pr-2 text-left">
              <h2 className="text-lg font-semibold leading-tight tracking-tight">{l.title}</h2>
              <p className="text-muted-foreground mt-1 text-sm leading-snug">{l.description}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setMinimized(true)}
                aria-label={l.minimizePanel}
              >
                <ChevronsRight className="h-5 w-5" aria-hidden />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={handleClose} aria-label={l.closePanel}>
                <X className="h-5 w-5" aria-hidden />
              </Button>
            </div>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            <div className="space-y-3">
              {messages.length === 0 && (
                <p className="text-muted-foreground text-sm">{l.emptyThread}</p>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === 'user'
                      ? 'ml-6 rounded-lg bg-muted px-3 py-2 text-sm'
                      : 'mr-4 rounded-lg border bg-card px-3 py-2 text-sm'
                  }
                >
                  <div className="whitespace-pre-wrap">{m.content}</div>
                  {m.role === 'assistant' && m.artifacts && m.artifacts.length > 0 && (
                    <div className="mt-3 space-y-2 border-t border-dashed pt-2">
                      <p className="text-muted-foreground text-xs font-medium">{l.downloadsHeading}</p>
                      <div className="flex flex-col gap-2">
                        {m.artifacts.map((a) => (
                          <Button key={a.url} variant="secondary" size="sm" className="justify-start" asChild>
                            <a href={a.url} download rel="noopener noreferrer">
                              <Download className="mr-2 h-4 w-4 shrink-0" aria-hidden />
                              <span className="truncate">{a.label}</span>
                              <span className="sr-only">{l.downloadFile}</span>
                            </a>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {sending && (
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  {l.sending}
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 space-y-2 border-t p-3">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={l.placeholder}
              rows={2}
              className="resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMessages([])}
                disabled={sending || messages.length === 0}
              >
                {l.clear}
              </Button>
              <Button type="button" size="sm" onClick={() => void send()} disabled={sending || !input.trim()}>
                <Send className="mr-2 h-4 w-4" aria-hidden />
                {l.send}
              </Button>
            </div>
          </div>
        </div>

        <div
          className="pointer-events-auto flex w-12 shrink-0 flex-col items-center gap-3 border-l border-orange-600/30 bg-orange-500 py-6 text-white shadow-inner"
          aria-hidden
        >
          <Bot className="h-6 w-6 shrink-0 opacity-95" aria-hidden />
          <span
            className="select-none text-center text-[11px] font-semibold uppercase leading-tight tracking-wider text-white/95"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            {l.assistantTabMark}
          </span>
        </div>
      </div>
    </>
  );
}
