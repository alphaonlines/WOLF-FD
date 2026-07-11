export type LLMMessage = {
    role: "user" | "assistant";
    content: string;
};
export type LLMResponse = {
    text: string;
    inputTokens: number;
    outputTokens: number;
};
export declare function callOllama(ollamaModelName: string, messages: LLMMessage[], systemPrompt: string, ollamaBaseUrl?: string): Promise<LLMResponse>;
export declare function callBotBotLocalAi(ollamaModelName: string, messages: LLMMessage[], systemPrompt: string): Promise<LLMResponse>;
export declare function callOpenAI(modelKey: string, messages: LLMMessage[], systemPrompt: string): Promise<LLMResponse>;
export declare function callClaude(modelKey: string, messages: LLMMessage[], systemPrompt: string): Promise<LLMResponse>;
