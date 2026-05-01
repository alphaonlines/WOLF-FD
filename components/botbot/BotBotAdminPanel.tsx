import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader, Search, RefreshCw, AlertCircle, ShieldCheck } from 'lucide-react';
import {
  fetchAdminUsage,
  fetchAdminModelConfig,
  patchAdminModelConfig,
  resetUserQuota,
  type BotBotModel
} from '../../services/botbotApi';

type BotBotAdminPanelProps = {
  isDarkMode: boolean;
};

const BotBotAdminPanel: React.FC<BotBotAdminPanelProps> = ({ isDarkMode }) => {
  const [loading, setLoading] = useState(true);
  const [usageData, setUsageData] = useState<any[]>([]);
  const [models, setModels] = useState<BotBotModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [usage, mods] = await Promise.all([
        fetchAdminUsage(1, 100),
        fetchAdminModelConfig()
      ]);
      setUsageData(usage.rows);
      setModels(mods);
    } catch (err: any) {
      setError('Admin access denied or server error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleResetQuota = async (userId: number, modelKey: string) => {
    if (!confirm('Reset token usage for this user?')) return;
    
    const id = `${userId}-${modelKey}`;
    setResettingId(id);
    try {
      await resetUserQuota(userId, modelKey);
      await loadData(); // Refresh list
    } catch (err: any) {
      setError('Failed to reset quota');
    } finally {
      setResettingId(null);
    }
  };

  const handleUpdateQuota = async (modelKey: string, newQuota: number) => {
    try {
      await patchAdminModelConfig(modelKey, { freeTokenQuota: newQuota });
      setModels(prev => prev.map(m => m.modelKey === modelKey ? { ...m, freeTokenQuota: newQuota } : m));
    } catch (err: any) {
      setError('Failed to update model config');
    }
  };

  const filteredUsage = usageData.filter(u => 
    u.user_name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <Loader className="animate-spin text-slate-400 mb-2" size={24} />
        <span className="text-xs font-bold uppercase tracking-widest opacity-40">Scanning Swarm Usage...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto flex flex-col h-full">
      {/* ── Tabs/Sections ────────────────────────────────────────── */}
      <div className="p-4 space-y-6">
        {/* Model Quotas Section */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={14} className="text-sky-500" />
            <h3 className={`text-[10px] uppercase tracking-widest font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              Model Quotas (Free)
            </h3>
          </div>
          <div className="grid gap-2">
            {models.map(m => (
              <div 
                key={m.modelKey} 
                className={`flex items-center justify-between p-3 rounded-xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
              >
                <div>
                  <p className="text-xs font-bold">{m.displayName}</p>
                  <p className="text-[10px] opacity-40 uppercase tracking-tighter">{m.provider}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    defaultValue={m.freeTokenQuota}
                    onBlur={(e) => handleUpdateQuota(m.modelKey, parseInt(e.target.value, 10))}
                    className={`w-24 text-right rounded-lg border px-2 py-1 text-xs font-bold ${isDarkMode ? 'bg-slate-900 border-slate-600 text-sky-400' : 'bg-white border-slate-300 text-sky-600'}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* User Usage Section */}
        <section className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <RefreshCw size={14} className="text-emerald-500" />
              <h3 className={`text-[10px] uppercase tracking-widest font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                Employee Usage
              </h3>
            </div>
            <button onClick={loadData} className="p-1 opacity-50 hover:opacity-100 transition">
              <RefreshCw size={12} />
            </button>
          </div>

          <div className={`relative mb-3 flex items-center rounded-xl border px-3 py-1.5 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <Search size={14} className="opacity-30 mr-2" />
            <input
              type="text"
              placeholder="Filter by name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-transparent border-none p-0 text-xs focus:ring-0 placeholder:opacity-40"
            />
          </div>

          <div className="space-y-2">
            {filteredUsage.length === 0 ? (
              <div className="py-8 text-center opacity-30 text-xs italic">No usage records found</div>
            ) : (
              filteredUsage.map((u, i) => {
                const pct = Math.min(100, Math.round((u.tokens_used / (u.quota || 1)) * 100));
                return (
                  <div 
                    key={`${u.user_id}-${u.model_key}-${i}`}
                    className={`p-3 rounded-xl border group ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100 shadow-sm'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="overflow-hidden">
                        <p className="text-xs font-bold truncate">{u.user_name}</p>
                        <p className="text-[10px] opacity-40 truncate">{u.model_key}</p>
                      </div>
                      <button
                        onClick={() => handleResetQuota(u.user_id, u.model_key)}
                        disabled={resettingId === `${u.user_id}-${u.model_key}`}
                        className={`text-[10px] font-bold uppercase px-2 py-1 rounded-lg transition ${isDarkMode ? 'bg-slate-700 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                      >
                        {resettingId === `${u.user_id}-${u.model_key}` ? '...' : 'Reset'}
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between text-[10px] font-bold mb-1 opacity-60">
                      <span>{u.tokens_used.toLocaleString()}</span>
                      <span className={pct > 90 ? 'text-red-500' : pct > 70 ? 'text-amber-500' : ''}>{pct}%</span>
                    </div>
                    <div className={`h-1 w-full rounded-full overflow-hidden ${isDarkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
                      <div 
                        className={`h-full transition-all duration-700 ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {error && (
        <div className="mt-auto p-4 bg-red-500/10 border-t border-red-500/20 text-red-500 text-[10px] font-bold text-center uppercase tracking-tight">
          {error}
        </div>
      )}
    </div>
  );
};

export default BotBotAdminPanel;
