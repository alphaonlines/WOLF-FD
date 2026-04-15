import Anthropic from "@anthropic-ai/sdk";
import { OLLAMA_BASE_URL, ANTHROPIC_API_KEY } from "./runtimeConfig";

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
