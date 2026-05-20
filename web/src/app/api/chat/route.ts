import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import {
  MONZA_SYSTEM_PROMPT_STATIC,
  buildCallerContextBlock,
  type CallerContext,
} from "@/lib/ai/system-prompt";

/**
 * POST /api/chat
 *
 * Streams a Claude Opus 4.7 response for the in-app AI assistant widget.
 *
 * Request body:
 *   {
 *     messages: Array<{ role: "user" | "assistant"; content: string }>,
 *     context?: { url?: string; role?: string; fullName?: string }
 *   }
 *
 * Auth: requires a signed-in Supabase session. Returns 401 otherwise.
 *
 * Response: SSE stream of Anthropic message events. The client iterates
 * `content_block_delta` events with `text_delta` to render incrementally.
 */

// Anthropic streaming responses can run longer than the default Vercel
// 10s edge timeout; bump to 30s for the chat route.
export const maxDuration = 30;
export const dynamic = "force-dynamic";

const MODEL_ID = "claude-opus-4-7";
const MAX_TOKENS = 1024;

type ChatMessage = { role: "user" | "assistant"; content: string };

function isChatMessage(m: unknown): m is ChatMessage {
  if (!m || typeof m !== "object") return false;
  const obj = m as Record<string, unknown>;
  return (
    (obj.role === "user" || obj.role === "assistant") &&
    typeof obj.content === "string"
  );
}

function validateMessages(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length === 0) return null;
  const messages: ChatMessage[] = [];
  for (const m of raw) {
    if (!isChatMessage(m)) return null;
    // Drop empty content — Anthropic rejects empty text blocks.
    if (m.content.trim().length === 0) continue;
    messages.push({ role: m.role, content: m.content });
  }
  if (messages.length === 0) return null;
  if (messages[0].role !== "user") return null;
  return messages;
}

function validateContext(raw: unknown): CallerContext {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const ctx: CallerContext = {};
  if (typeof obj.url === "string" && obj.url.length <= 300) ctx.url = obj.url;
  if (typeof obj.role === "string" && obj.role.length <= 64) ctx.role = obj.role;
  if (typeof obj.fullName === "string" && obj.fullName.length <= 128)
    ctx.fullName = obj.fullName;
  return ctx;
}

export async function POST(req: Request) {
  // 1. Auth — require an active Supabase session.
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Look up the caller profile. We follow the dead-`role`-column-safe
  //    pattern from session-app-role.ts — never select a `role` column.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, user_role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  // 3. Parse body.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const bodyObj = body as Record<string, unknown>;

  const messages = validateMessages(bodyObj.messages);
  if (!messages) {
    return NextResponse.json(
      { error: "messages must be a non-empty array starting with a user turn" },
      { status: 400 }
    );
  }

  // Merge any client-supplied context with the server-known role/name so
  // the prompt always reflects the authenticated profile.
  const clientCtx = validateContext(bodyObj.context);
  const ctx: CallerContext = {
    url: clientCtx.url,
    role:
      (typeof profile?.user_role === "string" ? profile.user_role : undefined) ??
      clientCtx.role,
    fullName:
      (typeof profile?.full_name === "string" ? profile.full_name : undefined) ??
      clientCtx.fullName,
  };

  // 4. Validate the API key is configured. We want a useful error in dev
  //    rather than a stack trace from the SDK.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "AI assistant is not configured. ANTHROPIC_API_KEY environment variable is missing.",
      },
      { status: 503 }
    );
  }

  // 5. Stream from Anthropic.
  const client = new Anthropic({ apiKey });

  // System prompt has two pieces:
  //   - the large frozen knowledge base (cached via cache_control)
  //   - the small per-request caller-context block (not cached)
  // The cached block is placed first so the prefix stays stable across requests
  // (see prompt-caching docs: any change in the prefix invalidates the cache).
  const systemBlocks: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: MONZA_SYSTEM_PROMPT_STATIC,
      cache_control: { type: "ephemeral" },
    },
    {
      type: "text",
      text: buildCallerContextBlock(ctx),
    },
  ];

  try {
    const stream = client.messages.stream({
      model: MODEL_ID,
      max_tokens: MAX_TOKENS,
      system: systemBlocks,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    // Forward the raw SSE stream from the SDK as-is so the client can parse
    // the standard Anthropic event types (`content_block_delta`, etc.).
    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of stream) {
            const line = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(line));
          }
          controller.close();
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "stream error";
          const errLine = `event: error\ndata: ${JSON.stringify({
            type: "error",
            error: { type: "api_error", message },
          })}\n\n`;
          controller.enqueue(encoder.encode(errLine));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "AI assistant API key is invalid." },
        { status: 503 }
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "AI assistant is rate-limited. Try again shortly." },
        { status: 429 }
      );
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `AI assistant error: ${err.message}` },
        { status: err.status ?? 500 }
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
