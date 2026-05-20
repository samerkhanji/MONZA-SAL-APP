import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import {
  MONZA_SYSTEM_PROMPT_STATIC,
  buildCallerContextBlock,
  type CallerContext,
} from "@/lib/ai/system-prompt";
import { MONZA_ASSISTANT_TOOLS, runAssistantTool } from "@/lib/ai/tools";

/**
 * POST /api/chat
 *
 * Streams a Claude Opus 4.7 response for the in-app AI assistant widget.
 *
 * The assistant has a set of read-only data tools (see lib/ai/tools.ts).
 * When the model asks for one, the server runs it through the caller's
 * Supabase client — so Row-Level Security scopes every result to what
 * that user is already allowed to see — and feeds the result back. The
 * loop continues until the model produces a final text answer.
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

// Anthropic streaming + tool rounds can run longer than the default Vercel
// 10s edge timeout; bump to 60s for the chat route.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MODEL_ID = "claude-opus-4-7";
const MAX_TOKENS = 1024;
// How many tool rounds the model may take before it must produce an answer.
const MAX_TOOL_ROUNDS = 5;

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

  // 5. Stream from Anthropic, running the read-only data tools whenever the
  //    model asks for them.
  const client = new Anthropic({ apiKey });

  // System prompt has two pieces:
  //   - the large frozen knowledge base (cached via cache_control)
  //   - the small per-request caller-context block (not cached)
  // The cached block is placed first so the prefix stays stable across requests.
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

  // Conversation transcript — grows as the tool-use loop runs.
  const convo: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (type: string, payload: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`)
        );
      };

      try {
        for (let round = 0; ; round++) {
          // On the final allowed round, drop the tools so the model is
          // forced to answer with text instead of requesting more data.
          const allowTools = round < MAX_TOOL_ROUNDS;

          const stream = client.messages.stream({
            model: MODEL_ID,
            max_tokens: MAX_TOKENS,
            system: systemBlocks,
            messages: convo,
            ...(allowTools ? { tools: MONZA_ASSISTANT_TOOLS } : {}),
          });

          let turnHadText = false;
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              turnHadText = true;
              send(event.type, event);
            }
          }

          const finalMessage = await stream.finalMessage();
          convo.push({
            role: "assistant",
            content: finalMessage.content,
          });

          if (finalMessage.stop_reason !== "tool_use") break;

          // Run every tool the model requested and feed the results back.
          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const block of finalMessage.content) {
            if (block.type === "tool_use") {
              const result = await runAssistantTool(
                block.name,
                block.input,
                supabase
              );
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: result,
              });
            }
          }
          convo.push({ role: "user", content: toolResults });

          // Separate any pre-tool narration from the upcoming answer.
          if (turnHadText) {
            send("content_block_delta", {
              type: "content_block_delta",
              delta: { type: "text_delta", text: "\n\n" },
            });
          }
        }
        controller.close();
      } catch (err) {
        let message = err instanceof Error ? err.message : "stream error";
        if (err instanceof Anthropic.AuthenticationError) {
          message = "AI assistant API key is invalid.";
        } else if (err instanceof Anthropic.RateLimitError) {
          message = "AI assistant is rate-limited. Try again shortly.";
        }
        send("error", {
          type: "error",
          error: { type: "api_error", message },
        });
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
}
