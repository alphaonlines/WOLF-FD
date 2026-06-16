import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, RotateCcw, Loader } from 'lucide-react';
import type { BotBotRuntimeStatus, BotBotSettings, TokenUsageRow } from '../../services/botbotApi';
import { fetchRuntimeStatus, fetchSettings, saveSettings, fetchTokenUsage } from '../../services/botbotApi';

type BotBotSettingsPanelProps = {
  isDarkMode: boolean;
  onSettingsChange?: () => void;
};

const THEME_OPTIONS = [
  { id: 'sky', color: 'bg-sky-500', label: 'Sky' },
  { id: 'emerald', color: 'bg-emerald-500', label: 'Emerald' },
  { id: 'violet', color: 'bg-violet-500', label: 'Violet' },
  { id: 'amber', color: 'bg-amber-500', label: 'Amber' },
  { id: 'rose', color: 'bg-rose-500', label: 'Rose' },
  { id: 'teal', color: 'bg-teal-500', label: 'Teal' },
];

const BotBotSettingsPanel: React.FC<BotBotSettingsPanelProps> = ({ isDarkMode, onSettingsChange }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<BotBotSettings | null>(null);
  const [tokenUsage, setTokenUsage] = useState<TokenUsageRow[]>([]);
  const [runtime, setRuntime] = useState<BotBotRuntimeStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [s, usage, runtimeStatus] = await Promise.all([fetchSettings(), fetchTokenUsage(), fetchRuntimeStatus()]);
        if (s) {
          setSettings(s);
        } else {
          setSettings({
            assistantName: 'BotBot',
            assistantTheme: 'sky',
            tutorialCompleted: false,
            preferredModelKey: 'local',
            preferredRuntimeNode: runtimeStatus.endpointKey || 'alphaai',
          });
        }
        setTokenUsage(usage);
        setRuntime(runtimeStatus);
      } catch (err: any) {
        setError('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleSave = async (updates: Partial<BotBotSettings>) => {
    if (!settings) return;
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    
    setSaving(true);
    try {
      await saveSettings(updates);
      if (onSettingsChange) onSettingsChange();
    } catch (err: any) {
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <Loader className="animate-spin text-slate-400 mb-2" size={24} />
        <span className="text-xs font-medium opacity-50">Loading preferences...</span>
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-8">
      {/* ── Assistant Identity ────────────────────────────────────── */}
      <section>
        <h3 className={`text-[10px] uppercase tracking-widest font-bold mb-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          Bot Identity
        </h3>
        <div className="space-y-4">
          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              Assistant Name
            </label>
            <div className="relative">
              <input
                type="text"
                value={settings.assistantName}
                onChange={(e) => setSettings({ ...settings, assistantName: e.target.value })}
                onBlur={(e) => handleSave({ assistantName: e.target.value })}
                className={`w-full rounded-xl border px-3 py-2 text-sm transition focus:outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-slate-400'}`}
              />
              {saving && <Loader className="absolute right-3 top-2.5 animate-spin text-slate-500" size={14} />}
            </div>
            <p className="mt-1.5 text-[10px] opacity-40">What do you call your AI partner?</p>
          </div>
        </div>
      </section>

      {/* ── Visual Theme ─────────────────────────────────────────── */}
      <section>
        <h3 className={`text-[10px] uppercase tracking-widest font-bold mb-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          Visual Theme
        </h3>
        <div className="grid grid-cols-6 gap-2">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => handleSave({ assistantTheme: opt.id })}
              className={`group relative flex h-10 w-full items-center justify-center rounded-xl transition hover:scale-105 ${opt.color} shadow-sm`}
              title={opt.label}
            >
              {settings.assistantTheme === opt.id && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-white">
                  <Check size={18} strokeWidth={3} />
                </motion.div>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* ── Preferred Model ──────────────────────────────────────── */}
      <section>
        <h3 className={`text-[10px] uppercase tracking-widest font-bold mb-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          Default Model
        </h3>
        <div className={`rounded-xl border p-1 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
          {tokenUsage.map((u) => (
            <button
              key={u.modelKey}
              onClick={() => handleSave({ preferredModelKey: u.modelKey })}
              className={`flex w-full items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition ${settings.preferredModelKey === u.modelKey ? (isDarkMode ? 'bg-slate-700 text-white' : 'bg-white text-slate-900 shadow-sm') : (isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')}`}
            >
              <span>{u.displayName}</span>
              {settings.preferredModelKey === u.modelKey && <Check size={14} />}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed opacity-50">
          All models route through the shared AlphaAI endpoint. Pick the model here; BotBot handles the system routing.
        </p>
      </section>

      {/* ── Shared Endpoint ─────────────────────────────────────── */}
      {runtime && (
        <section>
          <h3 className={`text-[10px] uppercase tracking-widest font-bold mb-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            Shared AI Endpoint
          </h3>
          <div className={`rounded-xl border px-3 py-3 ${isDarkMode ? 'border-slate-700 bg-slate-800/60 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold">{runtime.endpointLabel || 'AlphaAI model endpoint'}</div>
                <div className="mt-1 text-[10px] opacity-70">
                  {runtime.modelCount ?? runtime.models?.length ?? 0} local model{(runtime.modelCount ?? runtime.models?.length ?? 0) === 1 ? '' : 's'} detected. System routing is managed centrally.
                </div>
              </div>
              <div className={`h-2.5 w-2.5 rounded-full ${runtime.reachable ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            </div>
          </div>
        </section>
      )}

      {/* ── Usage Summary ────────────────────────────────────────── */}
      <section>
        <h3 className={`text-[10px] uppercase tracking-widest font-bold mb-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          Credit Summary
        </h3>
        <div className="space-y-4">
          {tokenUsage.map((u) => (
            <div key={u.modelKey}>
              <div className="flex justify-between text-[11px] font-bold mb-1.5">
                <span className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>{u.displayName}</span>
                <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
                  {Math.round(u.pctUsed)}%
                </span>
              </div>
              <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${u.pctUsed > 90 ? 'bg-red-500' : u.pctUsed > 70 ? 'bg-amber-500' : 'bg-sky-500'}`} 
                  style={{ width: `${Math.min(100, u.pctUsed)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Help & Reset ─────────────────────────────────────────── */}
      <section className="pt-4">
        <button
          onClick={() => handleSave({ tutorialCompleted: false })}
          className={`flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-bold transition ${isDarkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-400' : 'border-slate-200 hover:bg-slate-50 text-slate-500'}`}
        >
          <RotateCcw size={14} /> Reset Onboarding Tour
        </button>
        {error && <p className="mt-3 text-[10px] text-red-500 text-center font-bold uppercase tracking-tight">{error}</p>}
      </section>
    </div>
  );
};

export default BotBotSettingsPanel;
