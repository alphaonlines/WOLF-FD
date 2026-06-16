import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Plus, Settings, Loader, Trash2, ChevronLeft, BarChart3, Bot, Maximize2, Minimize2 } from 'lucide-react';
import type { BotBotConversation, BotBotMessage, TokenUsageRow } from '../../services/botbotApi';
import {
  fetchConversations,
  fetchBotBotModels,
  fetchTokenUsage,
  fetchSettings,
  fetchMessages,
  sendMessage,
  createConversation,
  deleteConversation,
} from '../../services/botbotApi';
import { useBotBotContext } from './BotBotContext';
import BotBotSettingsPanel from './BotBotSettingsPanel';
import BotBotAdminPanel from './BotBotAdminPanel';

type BotBotChatPanelProps = {
  authUser: { id: string; name: string; roles: string[] } | null;
  isDarkMode: boolean;
  onClose: () => void;
  initialFullscreen?: boolean;
  fullscreenRequestKey?: number;
};

const THEME_COLORS: Record<string, { bg: string; text: string; border: string; button: string }> = {
  sky: { bg: 'bg-sky-50 dark:bg-sky-950', text: 'text-sky-600 dark:text-sky-400', border: 'border-sky-200 dark:border-sky-800', button: 'bg-sky-500 hover:bg-sky-600' },
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800', button: 'bg-emerald-500 hover:bg-emerald-600' },
  violet: { bg: 'bg-violet-50 dark:bg-violet-950', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-800', button: 'bg-violet-500 hover:bg-violet-600' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800', button: 'bg-amber-500 hover:bg-amber-600' },
  rose: { bg: 'bg-rose-50 dark:bg-rose-950', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-800', button: 'bg-rose-500 hover:bg-rose-600' },
  teal: { bg: 'bg-teal-50 dark:bg-teal-950', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-200 dark:border-teal-800', button: 'bg-teal-500 hover:bg-teal-600' },
};

const PROMPT_CARDS = [
  {
    id: 'explain',
    label: 'Explain this page',
    prompt: 'Explain what I am looking at on this page and what matters most.',
    systemPrompt: 'Act as a patient dashboard trainer. Explain the current page in plain language, prioritize what matters first, and avoid overwhelming the user.',
  },
  {
    id: 'coach',
    label: 'Coach my next step',
    prompt: 'Coach me through the next best action here.',
    systemPrompt: 'Act as a floor coach. Give one recommended next action, explain why it matters, and include a short checklist the user can follow.',
  },
  {
    id: 'risks',
    label: 'Find risks',
    prompt: 'Look for risks, mistakes, or things I should double-check.',
    systemPrompt: 'Act as an operations reviewer. Look for likely risks, missing context, data quality warnings, and practical safeguards before making recommendations.',
  },
  {
    id: 'objections',
    label: 'Handling objections',
    prompt: 'Help me handle a customer objection and coach me on what to say next.',
    systemPrompt: 'Act as a furniture sales objection-handling coach. Use calm, non-pushy language, acknowledge the customer first, ask a clarifying question, then offer two or three practical rebuttal options.',
    includeObjections: true,
  },
  {
    id: 'doc',
    label: 'Read context',
    prompt: 'Use the context note I added and help me turn it into a clear answer or plan.',
    systemPrompt: 'Treat the provided context note as source material. Summarize it first, then suggest concrete next steps. If the note is incomplete, ask for the missing detail.',
  },
];

const FOLLOW_UP_PROMPTS = [
  'Make that simpler.',
  'Turn that into a checklist.',
  'Give me the next 3 steps.',
  'Write this as a message I can send.',
];

const BotBotChatPanel: React.FC<BotBotChatPanelProps> = ({
  authUser,
  isDarkMode,
  onClose,
  initialFullscreen = false,
  fullscreenRequestKey = 0,
}) => {
  const { pageContext } = useBotBotContext();
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<BotBotConversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<BotBotMessage[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [selectedModelKey, setSelectedModelKey] = useState('local');
  const [tokenUsage, setTokenUsage] = useState<TokenUsageRow[]>([]);
  const [inputText, setInputText] = useState('');
  const [contextText, setContextText] = useState('');
  const [contextOpen, setContextOpen] = useState(false);
  const [pendingSystemPrompt, setPendingSystemPrompt] = useState<string | null>(null);
  const [pendingIncludeObjections, setPendingIncludeObjections] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assistantName, setAssistantName] = useState('BotBot');
  const [theme, setTheme] = useState('sky');
  const [showAdmin, setShowAdmin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(initialFullscreen);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isOwner = authUser?.roles?.includes('Owner') ?? false;

  const loadInitialData = async () => {
    try {
      const [convs, mods, usage, settings] = await Promise.all([
        fetchConversations(),
        fetchBotBotModels(),
        fetchTokenUsage(),
        fetchSettings(),
      ]);
      setConversations(convs);
      setModels(mods);
      setTokenUsage(usage);
      if (settings) {
        setAssistantName(settings.assistantName);
        setTheme(settings.assistantTheme);
        setSelectedModelKey(settings.preferredModelKey || 'local');
      }
    } catch (err: any) {
      setFetchError(err.message || 'Failed to load BotBot data');
    } finally {
      setIsLoading(false);
    }
  };

  // Load initial data on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (fullscreenRequestKey > 0) {
      setIsFullscreen(true);
    }
  }, [fullscreenRequestKey]);

  // Fetch messages when conversation changes
  useEffect(() => {
    if (selectedConvId) {
      const loadMessages = async () => {
        try {
          const msgs = await fetchMessages(selectedConvId);
          setMessages(msgs);
          
          // Set model key based on the conversation
          const conv = conversations.find(c => c.id === selectedConvId);
          if (conv) {
            setSelectedModelKey(conv.modelKey);
          }
        } catch (err: any) {
          setError('Failed to load messages');
        }
      };
      loadMessages();
    } else {
      setMessages([]);
    }
  }, [selectedConvId, conversations]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const colors = THEME_COLORS[theme] ?? THEME_COLORS.sky;
  const panelSizeClass = isFullscreen
    ? 'fixed inset-2 sm:inset-4 lg:inset-6 flex flex-col rounded-2xl border shadow-2xl z-50'
    : 'fixed inset-x-2 top-16 bottom-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] flex flex-col rounded-3xl border shadow-2xl z-40 lg:inset-auto lg:bottom-32 lg:right-6 lg:h-[560px] lg:max-h-[calc(100dvh-9rem)] lg:w-[min(24rem,calc(100vw-2rem))]';

  // Get current model's quota usage
  const currentModelUsage = tokenUsage.find(u => u.modelKey === selectedModelKey) || tokenUsage.find(u => u.modelKey === 'local');
  const quotaPct = currentModelUsage?.pctUsed ?? 0;

  const applyPromptCard = (card: (typeof PROMPT_CARDS)[number]) => {
    setInputText(card.prompt);
    setPendingSystemPrompt(card.systemPrompt);
    setPendingIncludeObjections(Boolean(card.includeObjections));
    if (card.id === 'doc') {
      setContextOpen(true);
    }
  };

  const applyFollowUpPrompt = (prompt: string) => {
    setInputText(current => current.trim() ? `${current.trim()}\n\n${prompt}` : prompt);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isSending || isQuotaExceeded) return;

    const text = inputText.trim();
    setInputText('');
    setIsSending(true);
    setError(null);

    try {
      let activeConvId = selectedConvId;

      // 1. Create conversation if it's a new chat
      if (!activeConvId) {
        const newConv = await createConversation(selectedModelKey, text.slice(0, 30) + (text.length > 30 ? '...' : ''), pageContext.module);
        activeConvId = newConv.id;
        setSelectedConvId(activeConvId);
        setConversations(prev => [newConv, ...prev]);
      }

      // 2. Add optimistic user message
      const optimisticUserMsg: BotBotMessage = {
        id: Date.now(),
        role: 'user',
        content: text,
        modelKey: selectedModelKey,
        inputTokens: 0,
        outputTokens: 0,
        finishReason: null,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, optimisticUserMsg]);

      // 3. Send to backend
      const result = await sendMessage(activeConvId, text, pageContext, {
        systemPrompt: pendingSystemPrompt || undefined,
        documentContext: contextText.trim() || undefined,
        includeObjections: pendingIncludeObjections,
      });
      setPendingSystemPrompt(null);
      setPendingIncludeObjections(false);

      // 4. Update UI with AI response and token usage
      setMessages(prev => [...prev, result.message]);
      setTokenUsage(prev => {
        const billingKey = result.billingModelKey || selectedModelKey;
        return prev.map(row => {
          const rowBillingKey = row.billingModelKey || row.modelKey;
          if (rowBillingKey !== billingKey) return row;
          return {
            ...row,
            tokensUsed: result.tokensUsed,
            quota: result.quota,
            quotaRemaining: result.quotaRemaining,
            pctUsed: Math.min(100, Math.round((result.tokensUsed / (result.quota || 1)) * 100)),
          };
        });
      });

      // 5. Update conversation list with last message count (if needed)
      setConversations(prev => prev.map(c => c.id === activeConvId ? { ...c, updatedAt: new Date().toISOString(), messageCount: (c.messageCount || 0) + 2 } : c));

    } catch (err: any) {
      if (err.status === 402) {
        setIsQuotaExceeded(true);
      } else {
        setError(err.body?.error || err.message || 'Failed to send message');
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this conversation?')) return;
    
    try {
      await deleteConversation(id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (selectedConvId === id) {
        setSelectedConvId(null);
      }
    } catch (err: any) {
      setError('Failed to delete conversation');
    }
  };

  const handleSettingsChanged = () => {
    // Reload settings to update local UI state (theme, name, etc.)
    loadInitialData();
  };

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className={`${panelSizeClass} items-center justify-center ${isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}
      >
        <Loader size={32} className={`animate-spin ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
        <p className={`mt-2 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Loading BotBot...</p>
      </motion.div>
    );
  }

  if (fetchError) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className={`${panelSizeClass} items-center justify-center p-6 ${isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}
      >
        <p className={`text-sm font-semibold ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>Error</p>
        <p className={`mt-2 text-xs text-center ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{fetchError}</p>
        <button
          onClick={onClose}
          className={`mt-4 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${isDarkMode ? 'hover:bg-slate-800 text-slate-300 hover:text-white' : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'}`}
        >
          Close
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`${panelSizeClass} ${isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}
    >
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6 sm:py-4 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
        <div className="flex min-w-0 items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${colors.bg}`} />
          <div>
            <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {assistantName}
            </h2>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          {!selectedConvId && !showSettings && !showAdmin && models.length > 0 && (
            <select
              value={selectedModelKey}
              onChange={e => setSelectedModelKey(e.target.value)}
              disabled={isSending}
              className={`max-w-[10rem] rounded-lg border px-2 py-1 text-xs font-medium sm:max-w-none ${isDarkMode ? 'border-slate-600 bg-slate-800 text-slate-100' : 'border-slate-300 bg-white text-slate-900'} disabled:opacity-50`}
            >
              {models.map(m => (
                <option key={m.modelKey} value={m.modelKey}>
                  {m.displayName}
                </option>
              ))}
            </select>
          )}

          {selectedConvId && !showSettings && !showAdmin && (
            <span className={`text-xs font-medium px-2 py-1 rounded-md ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
              {models.find(m => m.modelKey === selectedModelKey)?.displayName || selectedModelKey}
            </span>
          )}

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsFullscreen(prev => !prev)}
              title={isFullscreen ? 'Restore panel' : 'Expand chat'}
              aria-label={isFullscreen ? 'Restore BotBot panel' : 'Expand BotBot chat'}
              className={`rounded-lg p-1.5 transition ${isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-700'}`}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            <button
              onClick={() => {
                setShowSettings(!showSettings);
                setShowAdmin(false);
              }}
              title="Settings"
              className={`rounded-lg p-1.5 transition ${showSettings ? (isDarkMode ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-900') : (isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-700')}`}
            >
              <Settings size={16} />
            </button>

            {isOwner && (
              <button
                onClick={() => {
                  setShowAdmin(!showAdmin);
                  setShowSettings(false);
                }}
                title="Admin panel"
                className={`rounded-lg p-1.5 transition ${showAdmin ? (isDarkMode ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-900') : (isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-700')}`}
              >
                <BarChart3 size={16} />
              </button>
            )}

            <button
              onClick={onClose}
              className={`rounded-lg p-1.5 transition ${isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-700'}`}
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* ── Conversation List Sidebar (hidden on mobile) ────────── */}
        <div className={`hidden sm:flex flex-col w-32 border-r ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50/50'}`}>
          <div className="p-3">
            <button
              onClick={() => {
                setSelectedConvId(null);
                setShowSettings(false);
                setShowAdmin(false);
              }}
              className={`flex w-full items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-bold transition shadow-sm ${isDarkMode ? 'border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-200' : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'}`}
            >
              <Plus size={14} /> New
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 space-y-1 pb-4">
            {conversations.map(conv => (
              <div 
                key={conv.id}
                className="group relative"
              >
                <button
                  onClick={() => {
                    setSelectedConvId(conv.id);
                    setShowSettings(false);
                    setShowAdmin(false);
                  }}
                  className={`w-full truncate rounded-lg px-2 py-2 text-left text-[11px] leading-tight transition pr-6 ${selectedConvId === conv.id && !showSettings && !showAdmin ? `${colors.bg} font-bold ${isDarkMode ? 'text-white' : 'text-slate-900 shadow-inner'}` : isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' : 'text-slate-600 hover:text-slate-900 hover:bg-white hover:shadow-sm'}`}
                >
                  {conv.title}
                </button>
                <button
                  onClick={(e) => handleDeleteConversation(e, conv.id)}
                  className={`absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded-md transition hover:bg-red-500 hover:text-white ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
                >
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Main Panel Area ────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          
          {/* Admin Panel */}
          <AnimatePresence>
            {showAdmin && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={`absolute inset-0 z-10 flex flex-col ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}
              >
                <div className={`flex items-center gap-2 p-4 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                  <button onClick={() => setShowAdmin(false)} className={`p-1 rounded-lg ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}>
                    <ChevronLeft size={20} />
                  </button>
                  <span className="font-bold text-sm">Swarm Console</span>
                </div>
                <BotBotAdminPanel isDarkMode={isDarkMode} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Settings Panel */}
          <AnimatePresence>
            {showSettings && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={`absolute inset-0 z-10 flex flex-col ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}
              >
                <div className={`flex items-center gap-2 p-4 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                  <button onClick={() => setShowSettings(false)} className={`p-1 rounded-lg ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}>
                    <ChevronLeft size={20} />
                  </button>
                  <span className="font-bold text-sm">Preferences</span>
                </div>
                <BotBotSettingsPanel isDarkMode={isDarkMode} onSettingsChange={handleSettingsChanged} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Chat Messages */}
          <div className={`flex-1 overflow-y-auto space-y-4 p-4 scroll-smooth ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
            {messages.length === 0 && !isSending && (
              <div className={`flex h-full flex-col items-center justify-center text-center px-6 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                <Bot size={40} className="mb-3 opacity-20" />
                <p className="text-sm font-medium">Hello {authUser?.name?.split(' ')[0]}!</p>
                <p className="text-xs mt-1">I&apos;m {assistantName}, your personal AI agent. How can I help you in the {pageContext.pageName} today?</p>
                <div className="mt-5 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
                  {PROMPT_CARDS.map(card => (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => applyPromptCard(card)}
                      className={`rounded-2xl border px-3 py-3 text-left transition ${
                        isDarkMode
                          ? 'border-slate-700 bg-slate-800/70 text-slate-200 hover:border-sky-500/50 hover:bg-slate-800'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-200 hover:bg-white'
                      }`}
                    >
                      <div className="text-xs font-bold">{card.label}</div>
                      <div className="mt-1 text-[10px] leading-relaxed opacity-60">{card.prompt}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <AnimatePresence initial={false}>
              {messages.map(msg => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`rounded-2xl px-4 py-2.5 max-w-[85%] text-sm shadow-sm ${msg.role === 'user' ? `${isDarkMode ? 'bg-slate-800 text-white' : 'bg-slate-900 text-white'}` : `${isDarkMode ? 'border border-slate-700 bg-slate-800 text-slate-100' : 'border border-slate-200 bg-white text-slate-900'}`}`}
                  >
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                    <div className={`text-[9px] mt-1.5 opacity-40 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {msg.role === 'assistant' && msg.modelKey && ` • ${msg.modelKey}`}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {isSending && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex justify-start"
              >
                <div className={`rounded-2xl px-4 py-3 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <div className="flex gap-1.5">
                    <motion.div className={`h-1.5 w-1.5 rounded-full ${isDarkMode ? 'bg-slate-500' : 'bg-slate-400'}`} animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
                    <motion.div className={`h-1.5 w-1.5 rounded-full ${isDarkMode ? 'bg-slate-500' : 'bg-slate-400'}`} animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.1 }} />
                    <motion.div className={`h-1.5 w-1.5 rounded-full ${isDarkMode ? 'bg-slate-500' : 'bg-slate-400'}`} animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} />
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} className="h-2" />
          </div>

          {/* ── Token Meter ───────────────────────────────────────────── */}
          {currentModelUsage && (
            <div className={`border-t px-4 py-3 ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-bold mb-1.5">
                <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>
                  {currentModelUsage.displayName} Credits
                </span>
                <span className={quotaPct > 90 ? 'text-red-500' : quotaPct > 70 ? 'text-amber-500' : isDarkMode ? 'text-slate-400' : 'text-slate-600'}>
                  {currentModelUsage.tokensUsed.toLocaleString()} / {currentModelUsage.quota.toLocaleString()}
                </span>
              </div>
              <div className={`h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}>
                <motion.div
                  className={`h-full transition-all ${quotaPct > 90 ? 'bg-red-500' : quotaPct > 70 ? 'bg-amber-500' : colors.button.split(' ')[0]}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, quotaPct)}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          )}

          {/* ── Alerts Banner ────────────────────────────────────────── */}
          <AnimatePresence>
            {(isQuotaExceeded || error) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className={`mx-4 mb-2 p-3 rounded-xl border text-xs shadow-sm ${error ? 'bg-red-50 border-red-100 text-red-700 dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-300' : 'bg-amber-50 border-amber-100 text-amber-700 dark:bg-amber-900/20 dark:border-amber-900/50 dark:text-amber-300'}`}
              >
                <div className="flex items-start gap-2">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold">{error ? 'System Error' : 'Quota Reached'}</p>
                    <p className="mt-0.5 opacity-90">{error || `You've used all free credits for ${currentModelUsage?.displayName}.`}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Input Area ────────────────────────────────────────────── */}
          <div className={`p-4 border-t ${isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}>
            {messages.length > 0 && !showSettings && !showAdmin && (
              <div className="mb-3 flex flex-wrap gap-2">
                {FOLLOW_UP_PROMPTS.map(prompt => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => applyFollowUpPrompt(prompt)}
                    className={`rounded-full border px-3 py-1.5 text-[10px] font-bold transition ${
                      isDarkMode
                        ? 'border-slate-700 bg-slate-800 text-slate-300 hover:border-sky-500/50'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-sky-200'
                    }`}
                  >
                    {prompt}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setContextOpen(value => !value)}
                  className={`rounded-full border px-3 py-1.5 text-[10px] font-bold transition ${
                    contextText.trim()
                      ? 'border-sky-400 bg-sky-500/10 text-sky-500'
                      : isDarkMode
                        ? 'border-slate-700 bg-slate-800 text-slate-300 hover:border-sky-500/50'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-sky-200'
                  }`}
                >
                  {contextText.trim() ? 'Context attached' : 'Add context/doc'}
                </button>
              </div>
            )}

            {(contextOpen || contextText.trim()) && (
              <div className={`mb-3 rounded-2xl border p-3 ${isDarkMode ? 'border-slate-700 bg-slate-800/70' : 'border-slate-200 bg-slate-50'}`}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Context BotBot can read</span>
                  <button
                    type="button"
                    onClick={() => {
                      setContextText('');
                      setContextOpen(false);
                    }}
                    className="text-[10px] font-bold uppercase tracking-widest opacity-45 hover:opacity-80"
                  >
                    Clear
                  </button>
                </div>
                <textarea
                  value={contextText}
                  onChange={event => setContextText(event.target.value.slice(0, 8000))}
                  placeholder="Paste a note, policy, customer detail, product info, or rough document here. BotBot will use it as extra context for your next messages."
                  rows={3}
                  className={`w-full resize-none rounded-xl border px-3 py-2 text-xs outline-none ${
                    isDarkMode
                      ? 'border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500'
                      : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400'
                  }`}
                />
              </div>
            )}

            {pendingSystemPrompt && (
              <div className={`mb-3 flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-[10px] ${
                isDarkMode ? 'border-sky-500/30 bg-sky-500/10 text-sky-200' : 'border-sky-100 bg-sky-50 text-sky-700'
              }`}>
                <span className="font-bold uppercase tracking-widest">Prompt mode loaded</span>
                <button type="button" onClick={() => setPendingSystemPrompt(null)} className="font-bold opacity-60 hover:opacity-100">Clear</button>
              </div>
            )}

            <div className={`relative flex items-end gap-2 p-1.5 rounded-2xl border transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 focus-within:border-slate-500' : 'bg-slate-50 border-slate-200 focus-within:border-slate-400'}`}>
              <textarea
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={isSending || isQuotaExceeded}
                placeholder="Ask BotBot..."
                rows={1}
                className="w-full bg-transparent border-none px-3 py-1.5 text-sm resize-none focus:ring-0 max-h-32 placeholder:opacity-50"
              />
              <button
                onClick={handleSendMessage}
                disabled={isSending || isQuotaExceeded || !inputText.trim()}
                className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-xl text-white transition disabled:opacity-30 disabled:grayscale ${colors.button}`}
              >
                {isSending ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
            <p className="mt-2 text-[9px] text-center opacity-30 uppercase tracking-widest font-bold">
              Powered by Wolf Swarm AI
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Internal icon for alerts
const AlertCircle = ({ size, className }: { size: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

export default BotBotChatPanel;
