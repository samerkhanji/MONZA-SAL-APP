"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, X, RotateCcw, Send, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/contexts/UserContext";
import { USER_ROLE_LABELS } from "@/lib/constants/user";
import { cn } from "@/lib/utils";

/**
 * Floating AI chat assistant for the Monza App.
 *
 * v1 design:
 *   - Hidden when the user is not signed in.
 *   - Floating bubble in the bottom-right corner (left of the existing scan
 *     button so they don't overlap).
 *   - Click → expands into a 400×600 chat panel with history, input, reset.
 *   - History is in-memory only (cleared on refresh).
 *   - Streams responses from /api/chat using the standard Anthropic SSE
 *     event shape and renders text deltas as they arrive.
 *   - Markdown: very light, hand-rolled (bold, italics, code, line breaks,
 *     and links) — no extra dependency to keep the bundle small.
 */

type ChatRole = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  /** True while the assistant message is still streaming in. */
  streaming?: boolean;
  /** True if this assistant message failed mid-stream. */
  error?: boolean;
}

const SUGGESTIONS: string[] = [
  "How do I add a new car?",
  "What does the garage manager do?",
  "Where do I track customer payments?",
];

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function AIChatWidget() {
  const { profile, appRole, loading } = useUser();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-scroll to the bottom when messages change.
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    // Defer to next frame so DOM is painted.
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [messages, open]);

  // Focus the input when opening.
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Cancel any in-flight request when the widget unmounts.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const roleLabel = useMemo(() => {
    if (!appRole) return "your role";
    return USER_ROLE_LABELS[appRole] ?? appRole;
  }, [appRole]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      const userMsg: ChatMessage = {
        id: newId(),
        role: "user",
        content: trimmed,
      };
      const assistantMsg: ChatMessage = {
        id: newId(),
        role: "assistant",
        content: "",
        streaming: true,
      };

      // Snapshot the history we'll actually send to the API (omit the empty
      // assistant placeholder) — and append both to local state.
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput("");
      setSending(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            context: {
              url: pathname,
              role: appRole ?? undefined,
              fullName: profile?.full_name ?? undefined,
            },
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          let errMsg = `Request failed (${res.status})`;
          try {
            const j = await res.json();
            if (j?.error) errMsg = String(j.error);
          } catch {
            // body wasn't JSON; keep default
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: errMsg, streaming: false, error: true }
                : m
            )
          );
          return;
        }

        // Parse the SSE stream. Each event is two lines (event: X / data: Y)
        // separated by a blank line.
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let sep: number;
          while ((sep = buffer.indexOf("\n\n")) !== -1) {
            const block = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);

            // Pull out the `data:` line(s) — there may be multiple.
            const dataLines: string[] = [];
            for (const line of block.split("\n")) {
              if (line.startsWith("data:")) {
                dataLines.push(line.slice(5).trim());
              }
            }
            if (dataLines.length === 0) continue;
            const dataStr = dataLines.join("\n");
            if (!dataStr) continue;

            let parsed: unknown;
            try {
              parsed = JSON.parse(dataStr);
            } catch {
              continue;
            }

            const evt = parsed as {
              type?: string;
              delta?: { type?: string; text?: string };
              error?: { message?: string };
            };

            if (
              evt.type === "content_block_delta" &&
              evt.delta?.type === "text_delta" &&
              typeof evt.delta.text === "string"
            ) {
              accumulated += evt.delta.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, content: accumulated }
                    : m
                )
              );
            } else if (evt.type === "error") {
              const msg = evt.error?.message ?? "Stream error";
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? {
                        ...m,
                        content:
                          accumulated.length > 0
                            ? `${accumulated}\n\n_${msg}_`
                            : msg,
                        streaming: false,
                        error: true,
                      }
                    : m
                )
              );
              return;
            }
          }
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? {
                  ...m,
                  content:
                    accumulated.length > 0
                      ? accumulated
                      : "(no response)",
                  streaming: false,
                }
              : m
          )
        );
      } catch (err) {
        if (controller.signal.aborted) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? {
                    ...m,
                    content: m.content || "(cancelled)",
                    streaming: false,
                  }
                : m
            )
          );
          return;
        }
        const msg = err instanceof Error ? err.message : "Network error";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: msg, streaming: false, error: true }
              : m
          )
        );
      } finally {
        setSending(false);
        abortRef.current = null;
      }
    },
    [messages, pathname, appRole, profile, sending]
  );

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      void send(input);
    },
    [send, input]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void send(input);
      }
    },
    [send, input]
  );

  const resetChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setInput("");
    setSending(false);
  }, []);

  // Hide the widget entirely while the user context is loading or when the
  // user isn't signed in — there's no point rendering a chatbot they can't use.
  if (loading || !profile) return null;

  return (
    <>
      {/* Floating launcher button */}
      <button
        type="button"
        aria-label={open ? "Close AI assistant" : "Open AI assistant"}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95",
          // Mobile: sits above the bottom tab bar, beside the scan button
          // Desktop: bottom-6 right-20 (left of the scan button)
          "bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] right-20 sm:bottom-6 sm:right-20"
        )}
      >
        {open ? (
          <X className="size-5" />
        ) : (
          <MessageCircle className="size-5" />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Monza AI assistant"
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl",
            // Mobile: nearly full-width above the launcher buttons.
            "bottom-20 left-4 right-4 h-[min(600px,calc(100dvh-6rem))]",
            // Desktop: 400×600 panel, tucked under the launcher.
            "sm:bottom-20 sm:left-auto sm:right-6 sm:h-[600px] sm:w-[400px]"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
            <div className="flex min-w-0 flex-col">
              <div className="text-sm font-semibold">Monza Assistant</div>
              <div className="truncate text-xs text-muted-foreground">
                Tailored for {roleLabel}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={resetChat}
                aria-label="Reset chat"
                title="Reset chat"
              >
                <RotateCcw className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setOpen(false)}
                aria-label="Close"
                title="Close"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto bg-background p-4"
          >
            {messages.length === 0 ? (
              <WelcomeBlock
                roleLabel={roleLabel}
                onPick={(text) => {
                  setInput(text);
                  void send(text);
                }}
                disabled={sending}
              />
            ) : (
              messages.map((m) => <MessageBubble key={m.id} message={m} />)
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={onSubmit}
            className="border-t border-border bg-card p-3"
          >
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder="Ask me anything about the app…"
                disabled={sending}
                className={cn(
                  "flex max-h-32 min-h-9 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow]",
                  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-primary/25",
                  "disabled:cursor-not-allowed disabled:opacity-50"
                )}
              />
              <Button
                type="submit"
                size="icon-sm"
                disabled={!input.trim() || sending}
                aria-label="Send"
              >
                {sending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </div>
            <p className="mt-2 text-[10px] leading-tight text-muted-foreground">
              AI can be wrong — double-check important details.
            </p>
          </form>
        </div>
      )}
    </>
  );
}

function WelcomeBlock({
  roleLabel,
  onPick,
  disabled,
}: {
  roleLabel: string;
  onPick: (text: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
        Hi! I&apos;m your Monza assistant. Ask me anything about the app, your
        data, or how to do something. I know your role ({roleLabel}), so
        I&apos;ll tailor my answers. What would you like to know?
      </div>
      <div className="space-y-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            disabled={disabled}
            className={cn(
              "w-full rounded-md border border-border bg-background px-3 py-2 text-left text-xs transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : message.error
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-foreground"
        )}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap break-words">
            {message.content}
          </div>
        ) : (
          <div className="break-words">
            <SimpleMarkdown text={message.content} />
            {message.streaming && (
              <span
                aria-hidden="true"
                className="ml-1 inline-block h-3 w-1 animate-pulse rounded-sm bg-current align-baseline"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Very small markdown-ish renderer for assistant messages.
 *
 * Why hand-rolled: react-markdown + remark-parse + rehype is ~50KB
 * gzipped. v1 just needs **bold**, *italics*, `code`, [links](url),
 * line breaks, and `- ` / `1. ` bullets. We can swap in a real
 * markdown library later if richer rendering is needed.
 *
 * This intentionally does NOT render raw HTML — content is split,
 * escaped via React text nodes, and only inline patterns are turned
 * into elements. No `dangerouslySetInnerHTML`.
 */
function SimpleMarkdown({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split("\n");
  type Block =
    | { kind: "p"; lines: string[] }
    | { kind: "ul"; items: string[] }
    | { kind: "ol"; items: string[] };
  const blocks: Block[] = [];
  let current: Block | null = null;

  const flush = () => {
    if (current) {
      blocks.push(current);
      current = null;
    }
  };

  for (const raw of lines) {
    const line = raw;
    const ulMatch = /^\s*[-*]\s+(.*)$/.exec(line);
    const olMatch = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (ulMatch) {
      if (!current || current.kind !== "ul") {
        flush();
        current = { kind: "ul", items: [] };
      }
      current.items.push(ulMatch[1]);
    } else if (olMatch) {
      if (!current || current.kind !== "ol") {
        flush();
        current = { kind: "ol", items: [] };
      }
      current.items.push(olMatch[1]);
    } else if (line.trim() === "") {
      flush();
    } else {
      if (!current || current.kind !== "p") {
        flush();
        current = { kind: "p", lines: [] };
      }
      current.lines.push(line);
    }
  }
  flush();

  return (
    <div className="space-y-1.5">
      {blocks.map((b, i) => {
        if (b.kind === "p") {
          return (
            <p key={i} className="whitespace-pre-wrap leading-snug">
              {b.lines.map((ln, j) => (
                <span key={j}>
                  {j > 0 && <br />}
                  <InlineMarkdown text={ln} />
                </span>
              ))}
            </p>
          );
        }
        if (b.kind === "ul") {
          return (
            <ul key={i} className="list-disc space-y-0.5 pl-5 leading-snug">
              {b.items.map((it, j) => (
                <li key={j}>
                  <InlineMarkdown text={it} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <ol key={i} className="list-decimal space-y-0.5 pl-5 leading-snug">
            {b.items.map((it, j) => (
              <li key={j}>
                <InlineMarkdown text={it} />
              </li>
            ))}
          </ol>
        );
      })}
    </div>
  );
}

/**
 * Inline patterns: **bold**, *italic*, `code`, [text](url).
 * Parses left-to-right; everything else is plain text.
 */
function InlineMarkdown({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    // Code: `...`
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end !== -1) {
        out.push(
          <code
            key={key++}
            className="rounded bg-background/60 px-1 py-0.5 font-mono text-[0.85em]"
          >
            {text.slice(i + 1, end)}
          </code>
        );
        i = end + 1;
        continue;
      }
    }
    // Bold: **...**
    if (text[i] === "*" && text[i + 1] === "*") {
      const end = text.indexOf("**", i + 2);
      if (end !== -1) {
        out.push(
          <strong key={key++} className="font-semibold">
            {text.slice(i + 2, end)}
          </strong>
        );
        i = end + 2;
        continue;
      }
    }
    // Italic: *...*
    if (text[i] === "*") {
      const end = text.indexOf("*", i + 1);
      if (end !== -1 && end > i + 1) {
        out.push(
          <em key={key++}>{text.slice(i + 1, end)}</em>
        );
        i = end + 1;
        continue;
      }
    }
    // Link: [text](url)
    if (text[i] === "[") {
      const closeBracket = text.indexOf("]", i + 1);
      if (
        closeBracket !== -1 &&
        text[closeBracket + 1] === "(" &&
        text.indexOf(")", closeBracket + 2) !== -1
      ) {
        const closeParen = text.indexOf(")", closeBracket + 2);
        const label = text.slice(i + 1, closeBracket);
        const url = text.slice(closeBracket + 2, closeParen);
        // Only allow http(s) and root-relative links to avoid javascript: etc.
        const safe = /^(https?:\/\/|\/)/.test(url);
        if (safe) {
          out.push(
            <a
              key={key++}
              href={url}
              target={url.startsWith("/") ? undefined : "_blank"}
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2"
            >
              {label}
            </a>
          );
          i = closeParen + 1;
          continue;
        }
      }
    }
    // Default: accumulate plain text until the next special char.
    let j = i + 1;
    while (
      j < text.length &&
      text[j] !== "`" &&
      text[j] !== "*" &&
      text[j] !== "["
    ) {
      j++;
    }
    out.push(<span key={key++}>{text.slice(i, j)}</span>);
    i = j;
  }
  return <>{out}</>;
}
