"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.callOllama = callOllama;
exports.callBotBotLocalAi = callBotBotLocalAi;
exports.callOpenAI = callOpenAI;
exports.callClaude = callClaude;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const runtimeConfig_1 = require("./runtimeConfig");
async function callOllama(ollamaModelName, messages, systemPrompt, ollamaBaseUrl = runtimeConfig_1.OLLAMA_BASE_URL) {
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
    const data = (await res.json());
    return {
        text: data.message?.content ?? "",
        inputTokens: data.prompt_eval_count ?? 0,
        outputTokens: data.eval_count ?? 0,
    };
}
async function callBotBotLocalAi(ollamaModelName, messages, systemPrompt) {
    const baseUrl = runtimeConfig_1.BOTBOT_LOCAL_AI_URL.replace(/\/+$/, "");
    const headers = { "Content-Type": "application/json" };
    if (runtimeConfig_1.BOTBOT_LOCAL_AI_TOKEN) {
        headers["x-botbot-token"] = runtimeConfig_1.BOTBOT_LOCAL_AI_TOKEN;
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
        let data = {};
        try {
            data = text ? JSON.parse(text) : {};
        }
        catch (_error) {
            data = { error: text };
        }
        if (!res.ok || data.ok === false) {
            throw new Error(`BotBot AI platform error: ${res.status} ${data.error || text || "request_failed"}`);
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
    }
    catch (_error) {
        return callOllama(ollamaModelName, messages, systemPrompt, runtimeConfig_1.OLLAMA_BASE_URL);
    }
    finally {
        clearTimeout(timeout);
    }
}
async function callOpenAI(modelKey, messages, systemPrompt) {
    if (!runtimeConfig_1.OPENAI_API_KEY) {
        throw new Error("openai_unavailable");
    }
    const baseUrl = runtimeConfig_1.OPENAI_BASE_URL.replace(/\/+$/, "");
    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${runtimeConfig_1.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
            model: modelKey,
            messages: [{ role: "system", content: systemPrompt }, ...messages],
            temperature: 0.4,
            max_tokens: 1024,
        }),
    });
    const data = (await response.json());
    if (!response.ok) {
        throw new Error(`OpenAI error: ${response.status} ${data?.error?.message ?? "request_failed"}`);
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
async function callClaude(modelKey, messages, systemPrompt) {
    if (!runtimeConfig_1.ANTHROPIC_API_KEY) {
        throw new Error("model_unavailable");
    }
    const client = new sdk_1.default({ apiKey: runtimeConfig_1.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
        model: modelKey,
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });
    const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");
    return {
        text,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
    };
}
//# sourceMappingURL=llmClient.js.map