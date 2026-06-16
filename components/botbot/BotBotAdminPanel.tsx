import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Bot, Loader, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Users } from 'lucide-react';
import {
  fetchAdminModelConfig,
  fetchAdminUsage,
  fetchAdminUsageBySkill,
  fetchAdminUsageHistory,
  fetchRoleAccess,
  fetchUserAccess,
  patchAdminModelConfig,
  patchRoleAccess,
  patchUserAccess,
  resetUserQuota,
  type BotBotAccessState,
  type BotBotModel,
  type BotBotSkillUsageRow,
  type BotBotUsagePoint,
} from '../../services/botbotApi';

type BotBotAdminPanelProps = {
  isDarkMode: boolean;
};

type TabKey = 'usage' | 'models' | 'skills' | 'roles' | 'users';

const ROLE_OPTIONS = [
  { key: 'owner', label: 'Owner' },
  { key: 'admin', label: 'Admin' },
  { key: 'manager', label: 'Manager' },
  { key: 'employee', label: 'Employee' },
  { key: 'support', label: 'Support' },
];

const RANGE_OPTIONS = ['15m', '1h', '24h', '7d'];

const formatNumber = (value: number) => Number(value || 0).toLocaleString();

const usageUserId = (row: any) => Number(row.userId ?? row.user_id ?? 0);
const usageUserName = (row: any) => String(row.userName ?? row.user_name ?? 'Unknown user');
const usageEmail = (row: any) => String(row.email ?? '');
const usageModelKey = (row: any) => String(row.modelKey ?? row.model_key ?? '');
const usageTokens = (row: any) => Number(row.tokensUsed ?? row.tokens_used ?? 0);
const usageQuota = (row: any) => Number(row.quota ?? 0);

const classNames = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');

const MiniLineChart: React.FC<{ points: BotBotUsagePoint[]; isDarkMode: boolean }> = ({ points, isDarkMode }) => {
  const width = 520;
  const height = 160;
  const padded = points.length ? points : [{ bucket: '', events: 0, totalTokens: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0, errors: 0, denied: 0, slowResponses: 0 }];
  const maxTokens = Math.max(1, ...padded.map(point => point.totalTokens));
  const maxEvents = Math.max(1, ...padded.map(point => point.events));
  const tokenLine = padded.map((point, index) => {
    const x = padded.length === 1 ? 0 : (index / (padded.length - 1)) * width;
    const y = height - (point.totalTokens / maxTokens) * height;
    return `${x},${y}`;
  }).join(' ');
  const eventLine = padded.map((point, index) => {
    const x = padded.length === 1 ? 0 : (index / (padded.length - 1)) * width;
    const y = height - (point.events / maxEvents) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className={classNames('rounded-2xl border p-3', isDarkMode ? 'border-slate-700 bg-slate-950' : 'border-slate-200 bg-white')}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full overflow-visible">
        <polyline points={tokenLine} fill="none" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={eventLine} fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
        {padded.map((point, index) => {
          if (!point.errors && !point.denied && !point.slowResponses) return null;
          const x = padded.length === 1 ? 0 : (index / (padded.length - 1)) * width;
          return <circle key={`${point.bucket}-${index}`} cx={x} cy={14} r="5" fill="#f97316" />;
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-wider opacity-60">
        <span className="text-sky-500">Tokens</span>
        <span className="text-emerald-500">Events</span>
        <span className="text-orange-500">Spike / issue marker</span>
      </div>
    </div>
  );
};

const AccessEditor: React.FC<{
  access: BotBotAccessState | null;
  isDarkMode: boolean;
  onModelChange: (modelKey: string, patch: { allowed: boolean; tokenQuota: number }) => void;
  onSkillChange: (skillKey: string, allowed: boolean) => void;
}> = ({ access, isDarkMode, onModelChange, onSkillChange }) => {
  if (!access) {
    return <div className="py-6 text-center text-xs opacity-50">Choose a role or user to edit access.</div>;
  }

  return (
    <div className="grid gap-4">
      <section>
        <h4 className="mb-2 text-[10px] font-bold uppercase tracking-widest opacity-50">Models</h4>
        <div className="grid gap-2">
          {access.models.map(model => (
            <div key={model.modelKey} className={classNames('grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center', isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50')}>
              <div>
                <p className="text-xs font-bold">{model.displayName}</p>
                <p className="text-[10px] uppercase tracking-wider opacity-45">{model.provider} · {model.modelKey}</p>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={model.allowed}
                  onChange={event => onModelChange(model.modelKey, { allowed: event.target.checked, tokenQuota: model.tokenQuota })}
                />
                Allowed
              </label>
              <input
                type="number"
                value={model.tokenQuota}
                min={0}
                onChange={event => onModelChange(model.modelKey, { allowed: model.allowed, tokenQuota: Number(event.target.value || 0) })}
                className={classNames('w-28 rounded-lg border px-2 py-1 text-right text-xs font-bold', isDarkMode ? 'border-slate-600 bg-slate-950 text-sky-300' : 'border-slate-300 bg-white text-sky-700')}
              />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h4 className="mb-2 text-[10px] font-bold uppercase tracking-widest opacity-50">Skills / Tasks</h4>
        <div className="grid gap-2">
          {access.skills.map(skill => (
            <label key={skill.skillKey} className={classNames('flex items-start gap-3 rounded-xl border p-3', isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50')}>
              <input
                type="checkbox"
                checked={skill.allowed}
                onChange={event => onSkillChange(skill.skillKey, event.target.checked)}
                className="mt-1"
              />
              <span>
                <span className="block text-xs font-bold">{skill.label}</span>
                <span className="block text-[10px] opacity-50">{skill.description}</span>
              </span>
            </label>
          ))}
        </div>
      </section>
    </div>
  );
};

const BotBotAdminPanel: React.FC<BotBotAdminPanelProps> = ({ isDarkMode }) => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('usage');
  const [range, setRange] = useState('1h');
  const [usageData, setUsageData] = useState<any[]>([]);
  const [models, setModels] = useState<BotBotModel[]>([]);
  const [history, setHistory] = useState<BotBotUsagePoint[]>([]);
  const [skillUsage, setSkillUsage] = useState<BotBotSkillUsageRow[]>([]);
  const [roleKey, setRoleKey] = useState('employee');
  const [roleAccess, setRoleAccess] = useState<BotBotAccessState | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [userAccess, setUserAccess] = useState<BotBotAccessState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filteredUsage = useMemo(() => usageData.filter(row =>
    usageUserName(row).toLowerCase().includes(search.toLowerCase()) ||
    usageEmail(row).toLowerCase().includes(search.toLowerCase())
  ), [usageData, search]);

  const usageTotals = useMemo(() => history.reduce((acc, point) => ({
    events: acc.events + point.events,
    tokens: acc.tokens + point.totalTokens,
    errors: acc.errors + point.errors,
    denied: acc.denied + point.denied,
    slow: acc.slow + point.slowResponses,
  }), { events: 0, tokens: 0, errors: 0, denied: 0, slow: 0 }), [history]);

  const loadRoleAccess = async (nextRole = roleKey) => {
    setRoleAccess(await fetchRoleAccess(nextRole));
  };

  const loadUserAccess = async (userId: number | null) => {
    if (!userId) {
      setUserAccess(null);
      return;
    }
    setUserAccess(await fetchUserAccess(userId));
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [usage, mods, trend, skills] = await Promise.all([
        fetchAdminUsage(1, 100),
        fetchAdminModelConfig(),
        fetchAdminUsageHistory(range),
        fetchAdminUsageBySkill(range === '15m' || range === '1h' ? '24h' : range),
      ]);
      setUsageData(usage.rows);
      setModels(mods);
      setHistory(trend.points);
      setSkillUsage(skills);
      await loadRoleAccess(roleKey);
      if (selectedUserId) await loadUserAccess(selectedUserId);
    } catch (err: any) {
      setError('Admin access denied or server error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [range]);

  useEffect(() => {
    loadRoleAccess(roleKey).catch(() => setError('Failed to load role access'));
  }, [roleKey]);

  useEffect(() => {
    loadUserAccess(selectedUserId).catch(() => setError('Failed to load user access'));
  }, [selectedUserId]);

  const handleResetQuota = async (userId: number, modelKey: string) => {
    if (!confirm('Reset token usage for this user and model?')) return;
    const id = `${userId}-${modelKey}`;
    setResettingId(id);
    try {
      await resetUserQuota(userId, modelKey);
      await loadData();
    } catch (_err: any) {
      setError('Failed to reset quota');
    } finally {
      setResettingId(null);
    }
  };

  const handleUpdateQuota = async (modelKey: string, newQuota: number) => {
    try {
      await patchAdminModelConfig(modelKey, { freeTokenQuota: newQuota });
      setModels(prev => prev.map(model => model.modelKey === modelKey ? { ...model, freeTokenQuota: newQuota } : model));
    } catch (_err: any) {
      setError('Failed to update model config');
    }
  };

  const updateRoleModel = async (modelKey: string, patch: { allowed: boolean; tokenQuota: number }) => {
    const next = await patchRoleAccess(roleKey, { models: { [modelKey]: patch } });
    setRoleAccess(next);
  };

  const updateRoleSkill = async (skillKey: string, allowed: boolean) => {
    const next = await patchRoleAccess(roleKey, { skills: { [skillKey]: allowed } });
    setRoleAccess(next);
  };

  const updateUserModel = async (modelKey: string, patch: { allowed: boolean; tokenQuota: number }) => {
    if (!selectedUserId) return;
    const next = await patchUserAccess(selectedUserId, { models: { [modelKey]: patch } });
    setUserAccess(next);
  };

  const updateUserSkill = async (skillKey: string, allowed: boolean) => {
    if (!selectedUserId) return;
    const next = await patchUserAccess(selectedUserId, { skills: { [skillKey]: allowed } });
    setUserAccess(next);
  };

  const tabs: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
    { key: 'usage', label: 'Usage', icon: <BarChart3 size={14} /> },
    { key: 'models', label: 'Models', icon: <Bot size={14} /> },
    { key: 'skills', label: 'Skills', icon: <ShieldCheck size={14} /> },
    { key: 'roles', label: 'Roles', icon: <SlidersHorizontal size={14} /> },
    { key: 'users', label: 'Users', icon: <Users size={14} /> },
  ];

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <Loader className="mb-2 animate-spin text-slate-400" size={24} />
        <span className="text-xs font-bold uppercase tracking-widest opacity-40">Loading AI Control Center...</span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <div className={classNames('border-b p-3', isDarkMode ? 'border-slate-700' : 'border-slate-200')}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest opacity-50">AI Control Center</p>
            <h3 className="text-sm font-bold">AlphaAI, BotBot, models, skills, and usage</h3>
          </div>
          <button onClick={loadData} className="rounded-lg p-2 opacity-60 transition hover:opacity-100">
            <RefreshCw size={14} />
          </button>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={classNames(
                'flex items-center justify-center gap-1 rounded-xl px-2 py-2 text-[10px] font-bold uppercase tracking-tight transition',
                activeTab === tab.key
                  ? 'bg-sky-500 text-white'
                  : isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-900'
              )}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'usage' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-bold">Usage over time</h4>
              <div className="flex gap-1">
                {RANGE_OPTIONS.map(option => (
                  <button
                    key={option}
                    onClick={() => setRange(option)}
                    className={classNames('rounded-lg px-2 py-1 text-[10px] font-bold uppercase', range === option ? 'bg-sky-500 text-white' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600')}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[
                ['Events', usageTotals.events],
                ['Tokens', usageTotals.tokens],
                ['Errors', usageTotals.errors],
                ['Denied', usageTotals.denied],
                ['Slow', usageTotals.slow],
              ].map(([label, value]) => (
                <div key={label} className={classNames('rounded-xl border p-3', isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50')}>
                  <p className="text-[10px] font-bold uppercase opacity-50">{label}</p>
                  <p className="mt-1 text-lg font-black">{formatNumber(Number(value))}</p>
                </div>
              ))}
            </div>
            <MiniLineChart points={history} isDarkMode={isDarkMode} />
            <section>
              <h4 className="mb-2 text-sm font-bold">Skill usage</h4>
              <div className="grid gap-2">
                {skillUsage.length ? skillUsage.map(skill => (
                  <div key={skill.skillKey} className={classNames('rounded-xl border p-3', isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white')}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold">{skill.label}</p>
                        <p className="text-[10px] opacity-50">{skill.skillKey}</p>
                      </div>
                      <div className="text-right text-[10px] font-bold opacity-70">
                        <p>{formatNumber(skill.totalTokens)} tokens</p>
                        <p>{skill.events} events · {skill.denied} denied · {skill.errors} errors</p>
                      </div>
                    </div>
                  </div>
                )) : <div className="py-6 text-center text-xs opacity-40">No usage history yet.</div>}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'models' && (
          <div className="space-y-3">
            <p className="text-xs opacity-60">Set global model quotas. Access is controlled separately in Roles and Users.</p>
            {models.map(model => (
              <div key={model.modelKey} className={classNames('flex items-center justify-between gap-3 rounded-xl border p-3', isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50')}>
                <div>
                  <p className="text-xs font-bold">{model.displayName}</p>
                  <p className="text-[10px] uppercase tracking-wider opacity-45">{model.provider} · {model.modelKey}</p>
                </div>
                <input
                  type="number"
                  defaultValue={model.freeTokenQuota}
                  onBlur={event => handleUpdateQuota(model.modelKey, Number(event.target.value || 0))}
                  className={classNames('w-28 rounded-lg border px-2 py-1 text-right text-xs font-bold', isDarkMode ? 'border-slate-600 bg-slate-950 text-sky-300' : 'border-slate-300 bg-white text-sky-700')}
                />
              </div>
            ))}
          </div>
        )}

        {activeTab === 'skills' && (
          <div className="space-y-3">
            <p className="text-xs opacity-60">Skills are enforced gates. If a user is denied a skill, BotBot will not perform that help path.</p>
            <AccessEditor access={roleAccess} isDarkMode={isDarkMode} onModelChange={updateRoleModel} onSkillChange={updateRoleSkill} />
          </div>
        )}

        {activeTab === 'roles' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {ROLE_OPTIONS.map(role => (
                <button
                  key={role.key}
                  onClick={() => setRoleKey(role.key)}
                  className={classNames('rounded-xl px-3 py-2 text-xs font-bold', roleKey === role.key ? 'bg-sky-500 text-white' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600')}
                >
                  {role.label}
                </button>
              ))}
            </div>
            <AccessEditor access={roleAccess} isDarkMode={isDarkMode} onModelChange={updateRoleModel} onSkillChange={updateRoleSkill} />
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className={classNames('relative flex items-center rounded-xl border px-3 py-1.5', isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50')}>
              <Search size={14} className="mr-2 opacity-30" />
              <input
                type="text"
                placeholder="Filter by name or email..."
                value={search}
                onChange={event => setSearch(event.target.value)}
                className="w-full border-none bg-transparent p-0 text-xs placeholder:opacity-40 focus:ring-0"
              />
            </div>
            <div className="grid gap-2">
              {filteredUsage.map((row, index) => {
                const userId = usageUserId(row);
                const modelKey = usageModelKey(row);
                const quota = usageQuota(row);
                const tokens = usageTokens(row);
                const pct = Math.min(100, Math.round((tokens / (quota || 1)) * 100));
                return (
                  <div key={`${userId}-${modelKey}-${index}`} className={classNames('rounded-xl border p-3', selectedUserId === userId ? 'border-sky-500' : isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white')}>
                    <div className="flex justify-between gap-3">
                      <button onClick={() => setSelectedUserId(userId)} className="min-w-0 text-left">
                        <p className="truncate text-xs font-bold">{usageUserName(row)}</p>
                        <p className="truncate text-[10px] opacity-40">{usageEmail(row)} · {modelKey}</p>
                      </button>
                      <button
                        onClick={() => handleResetQuota(userId, modelKey)}
                        disabled={resettingId === `${userId}-${modelKey}`}
                        className={classNames('rounded-lg px-2 py-1 text-[10px] font-bold uppercase', isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600')}
                      >
                        {resettingId === `${userId}-${modelKey}` ? '...' : 'Reset'}
                      </button>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-500/20">
                      <div className={classNames('h-full', pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {!filteredUsage.length && <div className="py-6 text-center text-xs opacity-40">Users appear here after BotBot usage.</div>}
            </div>
            {selectedUserId && (
              <div className="mt-4 rounded-2xl border border-sky-500/30 p-3">
                <h4 className="mb-3 text-xs font-bold uppercase tracking-widest opacity-60">Selected user override</h4>
                <AccessEditor access={userAccess} isDarkMode={isDarkMode} onModelChange={updateUserModel} onSkillChange={updateUserSkill} />
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="border-t border-red-500/20 bg-red-500/10 p-3 text-center text-[10px] font-bold uppercase tracking-tight text-red-500">
          {error}
        </div>
      )}
    </div>
  );
};

export default BotBotAdminPanel;
