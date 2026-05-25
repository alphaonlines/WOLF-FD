import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Mic, Paperclip, Send, Settings, Sparkles } from 'lucide-react';
import { AI_BRAND } from '../../constants/aiBranding';
import type { BotBotConversation, BotBotMessage, BotBotModel, BotBotSettings, PageContext, TokenUsageRow } from '../../services/botbotApi';
import {
  createConversation,
  fetchBotBotModels,
  fetchSettings,
  fetchTokenUsage,
  saveSettings,
  sendMessage,
} from '../../services/botbotApi';
import WolfAiPromptChips from './WolfAiPromptChips';

const WOLF_AI_PAGE_CONTEXT: PageContext = {
  module: 'wolf-ai',
  pageName: 'WOLF AI Playground',
  userRole: 'Employee',
  keyMetricsVisible: [],
  suggestedActions: [],
};

const normalizeAssistantName = (settings: BotBotSettings | null) => {
  const configuredName = settings?.assistantName?.trim();
  if (!configuredName || configuredName.toLowerCase() === 'botbot') {
    return AI_BRAND.assistantDefaultName;
  }
  return configuredName;
};

const formatNumber = (value: number | undefined) => (value ?? 0).toLocaleString();

const formatWolfAiError = (err: any, fallback: string) => {
  const status = Number(err?.status ?? err?.body?.status ?? 0);
  if (status === 401 || /\b401\b/.test(String(err?.message ?? ''))) {
    return 'Sign in to use WOLF AI, then reopen the playground.';
  }
  const raw = String(err?.body?.error || err?.message || fallback);
  return raw.replace(/BotBot API/g, 'WOLF AI service').replace(/\/api\/botbot/g, '/api/wolf-ai');
};

const createEmptyUserMessage = (content: string, modelKey: string): BotBotMessage => ({
  id: Date.now(),
  role: 'user',
  content,
  modelKey,
  inputTokens: 0,
  outputTokens: 0,
  finishReason: null,
  createdAt: new Date().toISOString(),
});

const WolfAiComposer = () => {
  const [models, setModels] = useState<BotBotModel[]>([]);
  const [tokenUsage, setTokenUsage] = useState<TokenUsageRow[]>([]);
  const [settings, setSettings] = useState<BotBotSettings | null>(null);
  const [selectedModelKey, setSelectedModelKey] = useState('local');
  const [conversation, setConversation] = useState<BotBotConversation | null>(null);
  const [messages, setMessages] = useState<BotBotMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [draftAssistantName, setDraftAssistantName] = useState<string>(AI_BRAND.assistantDefaultName);
  const [error, setError] = useState<string | null>(null);

  const assistantName = normalizeAssistantName(settings);

  const selectedModel = useMemo(
    () => models.find(model => model.modelKey === (conversation?.modelKey || selectedModelKey)) ?? models[0],
    [conversation?.modelKey, models, selectedModelKey]
  );

  const selectedUsage = useMemo(
    () => {
      const activeModelKey = conversation?.modelKey || selectedModelKey;
      return tokenUsage.find(row => row.modelKey === activeModelKey || row.billingModelKey === activeModelKey) ?? tokenUsage[0];
    },
    [conversation?.modelKey, selectedModelKey, tokenUsage]
  );

  useEffect(() => {
    let cancelled = false;

    const loadComposerData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [loadedModels, loadedUsage, loadedSettings] = await Promise.all([
          fetchBotBotModels(),
          fetchTokenUsage(),
          fetchSettings(),
        ]);

        if (cancelled) return;

        setModels(loadedModels);
        setTokenUsage(loadedUsage);
        setSettings(loadedSettings);
        setDraftAssistantName(normalizeAssistantName(loadedSettings));

        const preferredModelKey = loadedSettings?.preferredModelKey || loadedModels[0]?.modelKey || 'local';
        setSelectedModelKey(preferredModelKey);
      } catch (err: any) {
        if (!cancelled) {
          setError(formatWolfAiError(err, 'Unable to load WOLF AI.'));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadComposerData();

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshTokenUsage = async () => {
    const refreshedUsage = await fetchTokenUsage();
    setTokenUsage(refreshedUsage);
  };

  const handlePromptSelect = (prompt: string) => {
    setInputText(prompt);
  };

  const handleNewChat = async () => {
    setError(null);
    try {
      const createdConversation = await createConversation(selectedModelKey, WOLF_AI_PAGE_CONTEXT.pageName, WOLF_AI_PAGE_CONTEXT.module);
      setConversation(createdConversation);
      setMessages([]);
    } catch (err: any) {
      setError(formatWolfAiError(err, 'WOLF AI could not start a new chat.'));
    }
  };

  const ensureConversation = async () => {
    if (conversation) return conversation;

    const createdConversation = await createConversation(selectedModelKey, WOLF_AI_PAGE_CONTEXT.pageName, WOLF_AI_PAGE_CONTEXT.module);
    setConversation(createdConversation);
    return createdConversation;
  };

  const handleSaveSettings = async () => {
    const nextName = draftAssistantName.trim() || AI_BRAND.assistantDefaultName;
    setError(null);
    try {
      await saveSettings({ assistantName: nextName });
      setSettings(current => ({
        assistantName: nextName,
        assistantTheme: current?.assistantTheme || 'amber',
        tutorialCompleted: current?.tutorialCompleted ?? false,
        preferredModelKey: current?.preferredModelKey || selectedModelKey,
        preferredRuntimeNode: current?.preferredRuntimeNode || 'alphaai',
      }));
    } catch (err: any) {
      setError(formatWolfAiError(err, 'WOLF AI could not save settings.'));
    }
  };

  const handleSubmit = async (event?: FormEvent) => {
    event?.preventDefault();
    const text = inputText.trim();
    if (!text || isSending || isLoading) return;

    setInputText('');
    setError(null);
    setIsSending(true);

    try {
      const activeConversation = await ensureConversation();
      const userMessage = createEmptyUserMessage(text, activeConversation.modelKey || selectedModelKey);
      const result = await sendMessage(activeConversation.id, text, WOLF_AI_PAGE_CONTEXT);
      setMessages(current => [...current, userMessage, result.message]);
      try {
        await refreshTokenUsage();
      } catch {
        setError('Answer was sent, but token usage could not refresh.');
      }
    } catch (err: any) {
      setError(formatWolfAiError(err, 'WOLF AI could not send that message.'));
      setInputText(text);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-5xl rounded-[2rem] border border-orange-100 bg-[#fffaf0] p-4 shadow-2xl shadow-orange-900/10 sm:p-6" aria-label="WOLF AI composer">
      <div className="rounded-[1.75rem] border border-white/70 bg-gradient-to-br from-white via-orange-50 to-emerald-50 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/25">
              <Sparkles size={20} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-orange-600">{AI_BRAND.productName}</p>
              <h2 className="text-xl font-black text-stone-950">Try a prompt with {assistantName}</h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">
              {assistantName} ready
            </span>
            <span className="rounded-full border border-orange-200 bg-white px-3 py-1.5 text-xs font-bold text-orange-700">
              {AI_BRAND.engineName}
            </span>
            <button
              type="button"
              onClick={() => setShowSettings(value => !value)}
              className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-bold text-stone-600 transition hover:border-stone-300 hover:text-stone-950"
            >
              <Settings size={14} aria-hidden="true" /> Settings
            </button>
          </div>
        </div>

        {showSettings && (
          <div className="mt-4 rounded-2xl border border-orange-100 bg-white/80 p-4">
            <label className="text-xs font-black uppercase tracking-[0.2em] text-stone-500" htmlFor="wolf-ai-assistant-name">
              Assistant name
            </label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                id="wolf-ai-assistant-name"
                value={draftAssistantName}
                onChange={event => setDraftAssistantName(event.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-orange-400"
              />
              <button
                type="button"
                onClick={handleSaveSettings}
                className="rounded-xl bg-stone-950 px-4 py-2 text-sm font-black text-white transition hover:bg-stone-800"
              >
                Save settings
              </button>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-bold text-stone-600">
          {models.length > 0 ? (
            <label className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2">
              <span>Model</span>
              <select
                value={selectedModelKey}
                onChange={event => setSelectedModelKey(event.target.value)}
                disabled={Boolean(conversation)}
                className="bg-transparent font-black text-stone-950 outline-none"
                aria-label="WOLF AI model"
              >
                {models.map(model => (
                  <option key={model.modelKey} value={model.modelKey}>
                    {model.displayName}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="rounded-full border border-stone-200 bg-white px-3 py-2">Model loading...</span>
          )}

          {selectedModel && (
            <span className="rounded-full border border-stone-200 bg-white px-3 py-2">
              {conversation ? 'Conversation locked to' : 'Selected model:'} {selectedModel.displayName}
            </span>
          )}

          {selectedUsage && (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
              {formatNumber(selectedUsage.tokensUsed)} used • {formatNumber(selectedUsage.quotaRemaining)} remaining
            </span>
          )}
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-orange-100 bg-white/80 p-4 shadow-inner">
          {messages.length === 0 ? (
            <div className="mb-5 rounded-3xl bg-[#fff3d6] px-5 py-6 text-center">
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-orange-700">Prompt playground</p>
              <p className="mt-2 text-2xl font-black text-stone-950">Pick a chip or ask your own question.</p>
            </div>
          ) : (
            <div className="mb-5 space-y-3" aria-label="WOLF AI messages">
              {messages.map(message => (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm shadow-sm ${message.role === 'user' ? 'bg-stone-950 text-white' : 'border border-emerald-100 bg-emerald-50 text-stone-900'}`}>
                    {message.content}
                  </div>
                </div>
              ))}
            </div>
          )}

          <WolfAiPromptChips onSelectPrompt={handlePromptSelect} showFollowUps={messages.length > 0} />

          <form onSubmit={handleSubmit} className="mt-5">
            <label className="sr-only" htmlFor="wolf-ai-prompt">
              Ask {assistantName}
            </label>
            <textarea
              id="wolf-ai-prompt"
              value={inputText}
              onChange={event => setInputText(event.target.value)}
              placeholder={`Ask ${assistantName} anything...`}
              rows={5}
              className="min-h-36 w-full resize-y rounded-[1.5rem] border border-orange-100 bg-[#fffdf8] px-5 py-4 text-base text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-stone-500">
                <button type="button" className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-3 py-2" aria-label="Upload placeholder">
                  <Paperclip size={14} aria-hidden="true" /> Upload soon
                </button>
                <button type="button" className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-3 py-2" aria-label="Mic placeholder">
                  <Mic size={14} aria-hidden="true" /> Mic soon
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleNewChat}
                  disabled={isSending || isLoading}
                  className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-black text-stone-700 transition hover:border-stone-500 hover:text-stone-950 disabled:opacity-50"
                >
                  New Chat
                </button>
                <button
                  type="submit"
                  disabled={isSending || isLoading || !inputText.trim()}
                  className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-2 text-sm font-black text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send size={16} aria-hidden="true" /> {isSending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </form>
        </div>

        {isLoading && <p className="mt-4 text-center text-sm font-bold text-stone-500">Loading WOLF AI...</p>}
        {error && <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}
      </div>
    </section>
  );
};

export default WolfAiComposer;
