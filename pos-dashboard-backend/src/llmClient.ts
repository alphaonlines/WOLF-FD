import Anthropic from "@anthropic-ai/sdk";
import {
  ANTHROPIC_API_KEY,
  BOTBOT_LOCAL_AI_TOKEN,
  BOTBOT_LOCAL_AI_URL,
  OLLAMA_BASE_URL,
  OPENAI_API_KEY,
  OPENAI_BASE_URL,
  OPENROUTER_API_KEY,
  OPENROUTER_BASE_URL,
} from "./runtimeConfig";

export type LLMMessage = {
  role: "user" | "assistant";
  content: string;
};

export type LLMResponse = {
  text: string;
  inputTokens: number;
  outputTokens: number;
};

export async function callOllama(
  ollamaModelName: string,
  messages: LLMMessage[],
  systemPrompt: string,
  ollamaBaseUrl: string = OLLAMA_BASE_URL
): Promise<LLMResponse> {
  const body = {
    model: ollamaModelName,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    stream: false,
    options: { temperature: 0.7 },
  };

  const res = await fetch(`${ollamaBaseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Ollama error: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as any;
  return {
    text: data.message?.content ?? "",
    inputTokens: data.prompt_eval_count ?? 0,
    outputTokens: data.eval_count ?? 0,
  };
}

export async function callBotBotLocalAi(
  ollamaModelName: string,
  messages: LLMMessage[],
  systemPrompt: string
): Promise<LLMResponse> {
  const baseUrl = BOTBOT_LOCAL_AI_URL.replace(/\/+$/, "");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (BOTBOT_LOCAL_AI_TOKEN) {
    headers["x-botbot-token"] = BOTBOT_LOCAL_AI_TOKEN;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const res = await fetch(`${baseUrl}/api/botbot/chat`, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: ollamaModelName,
        messages,
        systemPrompt,
        source: "wolf-fd-botbot",
      }),
    });

    const text = await res.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (_error) {
      data = { error: text };
    }

    if (!res.ok || data.ok === false) {
      throw new Error(
        `BotBot AI platform error: ${res.status} ${data.error || text || "request_failed"}`
      );
    }

    const reply = String(data.text ?? data.message ?? data.response ?? "").trim();
    if (!reply) {
      throw new Error("BotBot AI platform returned an empty reply");
    }

    return {
      text: reply,
      inputTokens: Number(data.inputTokens ?? data.usage?.inputTokens ?? 0) || 0,
      outputTokens: Number(data.outputTokens ?? data.usage?.outputTokens ?? 0) || 0,
    };
  } catch (_error) {
    return callOllama(ollamaModelName, messages, systemPrompt, OLLAMA_BASE_URL);
  } finally {
    clearTimeout(timeout);
  }
}

export async function callOpenAI(
  modelKey: string,
  messages: LLMMessage[],
  systemPrompt: string
): Promise<LLMResponse> {
  if (!OPENAI_API_KEY) {
    throw new Error("openai_unavailable");
  }

  const baseUrl = OPENAI_BASE_URL.replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: modelKey,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.4,
      max_tokens: 1024,
    }),
  });

  const data = (await response.json()) as any;
  if (!response.ok) {
    throw new Error(
      `OpenAI error: ${response.status} ${data?.error?.message ?? "request_failed"}`
    );
  }

  const reply = String(data?.choices?.[0]?.message?.content ?? "").trim();
  if (!reply) {
    throw new Error("OpenAI returned an empty reply");
  }

  return {
    text: reply,
    inputTokens: Number(data?.usage?.prompt_tokens ?? 0) || 0,
    outputTokens: Number(data?.usage?.completion_tokens ?? 0) || 0,
  };
}

export async function callOpenRouter(
  modelKey: string,
  messages: LLMMessage[],
  systemPrompt: string
): Promise<LLMResponse> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("openrouter_unavailable");
  }

  const baseUrl = OPENROUTER_BASE_URL.replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://furnituredistributors.wolf.discount/fd/",
      "X-Title": "WOLF FD BotBot",
    },
    body: JSON.stringify({
      model: modelKey,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.4,
      max_tokens: 1024,
    }),
  });

  const data = (await response.json().catch(() => ({}))) as any;
  if (!response.ok) {
    throw new Error(
      `OpenRouter error: ${response.status} ${data?.error?.message ?? "request_failed"}`
    );
  }

  const reply = String(data?.choices?.[0]?.message?.content ?? "").trim();
  if (!reply) {
    throw new Error("OpenRouter returned an empty reply");
  }

  return {
    text: reply,
    inputTokens: Number(data?.usage?.prompt_tokens ?? 0) || 0,
    outputTokens: Number(data?.usage?.completion_tokens ?? 0) || 0,
  };
}

export async function callClaude(
  modelKey: string,
  messages: LLMMessage[],
  systemPrompt: string
): Promise<LLMResponse> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("model_unavailable");
  }

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: modelKey,
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as any).text)
    .join("");

  return {
    text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
