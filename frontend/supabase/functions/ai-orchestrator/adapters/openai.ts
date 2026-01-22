import { logEvent, logError } from "../observability.ts";

type Message = { role: "system" | "user"; content: string };

type CallOptions = {
  messages: Message[];
  response_format: "json";
};

const DEFAULT_MODEL = "gpt-4o-mini";

function extractOutputText(payload: any): string {
  if (typeof payload?.output_text === "string") return payload.output_text;

  const output = Array.isArray(payload?.output) ? payload.output : [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if ((part?.type === "output_text" || part?.type === "text") && typeof part?.text === "string") {
        return part.text;
      }
    }
  }

  const fallback = payload?.choices?.[0]?.message?.content;
  if (typeof fallback === "string") return fallback;
  return "";
}

export async function callLLM(options: CallOptions) {
  const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  const model = Deno.env.get("OPENAI_ORCHESTRATOR_MODEL") ?? DEFAULT_MODEL;
  const start = Date.now();

  const body = {
    model,
    input: options.messages,
    response_format: { type: "json_object" },
    temperature: 0.2,
  };

  const resp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const durationMs = Date.now() - start;

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    logError("openai_error", new Error(text || resp.statusText), {
      status: resp.status,
      duration_ms: durationMs,
    });
    throw new Error(`OpenAI request failed (${resp.status}).`);
  }

  const payload = await resp.json();
  const outputText = extractOutputText(payload);
  if (!outputText) {
    throw new Error("OpenAI response missing output text.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(outputText);
  } catch (err) {
    logError("openai_parse_error", err, { output_text: outputText.slice(0, 500) });
    throw new Error("Failed to parse OpenAI JSON response.");
  }

  const usage = payload?.usage ?? {};

  logEvent("openai_response", {
    model,
    duration_ms: durationMs,
    input_tokens: usage?.input_tokens,
    output_tokens: usage?.output_tokens,
    total_tokens: usage?.total_tokens,
  });

  return {
    data: parsed,
    model,
    duration_ms: durationMs,
    usage,
  };
}
