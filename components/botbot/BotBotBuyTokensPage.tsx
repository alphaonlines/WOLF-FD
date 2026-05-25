import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Coins, Loader2, RefreshCw, ShieldCheck, Ticket } from 'lucide-react';
import { BOTBOT_TOKEN_PACKS, type BotBotTokenPack } from '../../constants';
import { createBotBotTokenCheckout, fetchTokenUsage, redeemShopifyTokenClaim, type TokenUsageRow } from '../../services/botbotApi';

type BotBotBuyTokensPageProps = {
  isDarkMode: boolean;
  tokenPacks?: BotBotTokenPack[];
};

const formatNumber = (value: number) => Math.max(0, Math.round(value || 0)).toLocaleString();

type PaidModelPricing = {
  name: string;
  modelId: string;
  className: string;
  providerCostPer1k: string;
  botbotDebitPer1k: number;
  approxModelTokensPerStarter: string;
  note: string;
};

type FreeModelOption = {
  name: string;
  modelId: string;
  context: string;
  limit: string;
  note: string;
};

const PAID_MODEL_PRICING: PaidModelPricing[] = [
  {
    name: 'OpenAI GPT-5.5',
    modelId: 'openai/gpt-5.5',
    className: 'Flagship',
    providerCostPer1k: '$0.0175',
    botbotDebitPer1k: 53,
    approxModelTokensPerStarter: '18,800',
    note: 'Top shelf reasoning; expensive, so it burns credits fastest.',
  },
  {
    name: 'Claude Sonnet 4.6',
    modelId: 'anthropic/claude-sonnet-4.6',
    className: 'Balanced premium',
    providerCostPer1k: '$0.0090',
    botbotDebitPer1k: 27,
    approxModelTokensPerStarter: '37,000',
    note: 'Best daily writing, coding, and business reasoning balance.',
  },
  {
    name: 'Gemini 2.5 Pro',
    modelId: 'google/gemini-2.5-pro',
    className: 'Long context',
    providerCostPer1k: '$0.0056',
    botbotDebitPer1k: 17,
    approxModelTokensPerStarter: '58,800',
    note: 'Big-context analysis when the prompt has a lot of paperwork attached.',
  },
  {
    name: 'Gemini 3.5 Flash',
    modelId: 'google/gemini-3.5-flash',
    className: 'Fast long context',
    providerCostPer1k: '$0.0053',
    botbotDebitPer1k: 16,
    approxModelTokensPerStarter: '62,500',
    note: 'Quick long-context workhorse for high-volume dashboard help.',
  },
  {
    name: 'Qwen3.7 Max',
    modelId: 'qwen/qwen3.7-max',
    className: 'Code + multilingual',
    providerCostPer1k: '$0.0050',
    botbotDebitPer1k: 15,
    approxModelTokensPerStarter: '66,600',
    note: 'Strong technical and multilingual option without flagship burn.',
  },
  {
    name: 'Grok 4.3',
    modelId: 'x-ai/grok-4.3',
    className: 'Fast research',
    providerCostPer1k: '$0.0019',
    botbotDebitPer1k: 6,
    approxModelTokensPerStarter: '166,600',
    note: 'Fast conversational research lane; good mileage per pack.',
  },
  {
    name: 'Mistral Large 3',
    modelId: 'mistralai/mistral-large-2512',
    className: 'Business assistant',
    providerCostPer1k: '$0.0010',
    botbotDebitPer1k: 3,
    approxModelTokensPerStarter: '333,300',
    note: 'Efficient general business assistant with low credit draw.',
  },
  {
    name: 'DeepSeek V4 Pro',
    modelId: 'deepseek/deepseek-v4-pro',
    className: 'Value reasoning',
    providerCostPer1k: '$0.0007',
    botbotDebitPer1k: 2,
    approxModelTokensPerStarter: '500,000',
    note: 'High-value reasoning/coding lane. The quiet bargain bin with teeth.',
  },
  {
    name: 'Llama 4 Maverick',
    modelId: 'meta-llama/llama-4-maverick',
    className: 'Open model',
    providerCostPer1k: '$0.0004',
    botbotDebitPer1k: 2,
    approxModelTokensPerStarter: '500,000',
    note: 'Open-model general assistant with very friendly burn rate.',
  },
  {
    name: 'GPT-4o Mini',
    modelId: 'openai/gpt-4o-mini',
    className: 'Budget quick answers',
    providerCostPer1k: '$0.0004',
    botbotDebitPer1k: 2,
    approxModelTokensPerStarter: '500,000',
    note: 'Low-cost everyday routing for simple questions and quick summaries.',
  },
];

const FREE_MODEL_OPTIONS: FreeModelOption[] = [
  {
    name: 'DeepSeek V4 Flash Free',
    modelId: 'deepseek/deepseek-v4-flash:free',
    context: '1M context',
    limit: 'Shared free pool',
    note: 'Good free-lane default for quick reasoning while OpenRouter capacity is available.',
  },
  {
    name: 'Qwen3 Coder Free',
    modelId: 'qwen/qwen3-coder:free',
    context: '1M context',
    limit: 'Shared free pool',
    note: 'Coding-heavy free option; prompts are capped so one user cannot drain the lane.',
  },
  {
    name: 'Llama 3.3 70B Free',
    modelId: 'meta-llama/llama-3.3-70b-instruct:free',
    context: '131K context',
    limit: 'Shared free pool',
    note: 'Popular open-model free route for general help and lightweight drafting.',
  },
];


const claimErrorMessages: Record<string, string> = {
  claim_not_found: 'That claim code was not found. Check the code and try again.',
  claim_email_mismatch: 'That claim code email does not match your dashboard login email.',
  claim_status_redeemed: 'That claim code was already redeemed.',
  claim_redeem_failed: 'The claim code was found, but token crediting failed. Try again or contact support.',
  unauthorized: 'You need to be logged in before redeeming a claim code.',
};

const checkoutErrorMessages: Record<string, string> = {
  stripe_not_configured: 'Stripe is not configured yet. Add the server Stripe key before taking live payments.',
  stripe_webhook_not_configured: 'Stripe webhook signing is not configured yet. Add STRIPE_WEBHOOK_SECRET before taking live payments.',
  invalid_pack_id: 'That token pack is not available.',
  stripe_checkout_failed: 'Stripe Checkout could not start. Try again or contact support.',
  unauthorized: 'You need to be logged in before buying BotBot tokens.',
};

const getApiErrorMessage = (error: unknown, fallback: string, messages: Record<string, string>) => {
  const anyError = error as { body?: { error?: string }; message?: string };
  const code = anyError?.body?.error;
  if (code && messages[code]) return messages[code];
  if (code) return code.replace(/_/g, ' ');
  return anyError?.message || fallback;
};

const getClaimErrorMessage = (error: unknown) =>
  getApiErrorMessage(error, 'Could not redeem that claim code.', claimErrorMessages);

const getCheckoutErrorMessage = (error: unknown) =>
  getApiErrorMessage(error, 'Could not start Stripe Checkout.', checkoutErrorMessages);

const BotBotBuyTokensPage: React.FC<BotBotBuyTokensPageProps> = ({
  isDarkMode,
  tokenPacks = BOTBOT_TOKEN_PACKS,
}) => {
  const [usage, setUsage] = useState<TokenUsageRow[]>([]);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [claimCode, setClaimCode] = useState('');
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [checkoutBusyPackId, setCheckoutBusyPackId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const panelClass = isDarkMode
    ? 'border-slate-800 bg-slate-950 text-slate-100 shadow-[0_14px_30px_rgba(2,6,23,0.18)]'
    : 'border-slate-200/80 bg-white text-slate-900 shadow-sm';
  const mutedText = isDarkMode ? 'text-slate-400' : 'text-slate-600';
  const subtlePanel = isDarkMode ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-slate-50/80';
  const inputClass = isDarkMode
    ? 'border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500 focus:border-emerald-400'
    : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-500';

  const loadUsage = useCallback(async () => {
    setUsageLoading(true);
    setUsageError(null);
    try {
      setUsage(await fetchTokenUsage());
    } catch (error: any) {
      setUsageError(error?.body?.error || error?.message || 'Token usage unavailable');
    } finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  const usageTotals = useMemo(() => {
    return usage.reduce(
      (totals, row) => ({
        used: totals.used + Number(row.tokensUsed || 0),
        quota: totals.quota + Number(row.quota || 0),
        remaining: totals.remaining + Number(row.quotaRemaining || 0),
      }),
      { used: 0, quota: 0, remaining: 0 }
    );
  }, [usage]);

  const usagePct = usageTotals.quota > 0 ? Math.min(100, Math.round((usageTotals.used / usageTotals.quota) * 100)) : 0;

  const handleClaimSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedCode = claimCode.trim().toUpperCase();
    if (!normalizedCode || claimBusy) return;

    setClaimBusy(true);
    setClaimMessage(null);
    setClaimError(null);
    try {
      const result = await redeemShopifyTokenClaim(normalizedCode);
      const credited = Object.values(result.credits_by_model || {}).reduce((total, value) => total + Number(value || 0), 0);
      setClaimCode('');
      setClaimMessage(
        credited > 0
          ? `Claim code redeemed. Added ${formatNumber(credited)} tokens.`
          : 'Claim code redeemed.'
      );
      await loadUsage();
    } catch (error) {
      setClaimError(getClaimErrorMessage(error));
    } finally {
      setClaimBusy(false);
    }
  };

  const handleCheckoutClick = async (pack: BotBotTokenPack) => {
    if (checkoutBusyPackId) return;
    setCheckoutBusyPackId(pack.id);
    setCheckoutError(null);
    try {
      const result = await createBotBotTokenCheckout(pack.id);
      if (!result.checkoutUrl) throw new Error('Stripe Checkout did not return a URL. Tiny missing wire, big fire.');
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      setCheckoutError(getCheckoutErrorMessage(error));
      setCheckoutBusyPackId(null);
    }
  };

  return (
    <div className="h-full overflow-auto p-5 lg:p-7">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className={`rounded-3xl border p-5 md:p-6 ${panelClass}`}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-500">
                <Coins size={16} /> AI Token Top-Up
              </div>
              <h1 className={`mt-3 text-3xl font-semibold tracking-tight md:text-4xl ${isDarkMode ? 'text-white' : 'text-slate-950'}`}>
                Buy BotBot Tokens
              </h1>
              <p className={`mt-3 text-sm leading-6 ${mutedText}`}>
                Stripe handles checkout. BotBot tokens are dashboard credits: $1 = 10,000 BotBot tokens, sold in server-owned packs up to $250. Low-cost OpenRouter models sip them, while advanced models burn more because the upstream provider cost is higher.
              </p>
            </div>
            <div className={`rounded-2xl border px-4 py-3 text-sm ${isDarkMode ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
              <div className="flex items-center gap-2 font-semibold">
                <ShieldCheck size={18} /> Secure checkout
              </div>
              <p className="mt-1 max-w-xs text-xs leading-5 opacity-80">
                No card data touches WOLF-FD. The dashboard creates a Stripe Checkout session and receives signed payment events before crediting tokens.
              </p>
            </div>
          </div>
        </section>

        <section className={`grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]`}>
          <div className={`rounded-3xl border p-5 ${panelClass}`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-500">How BotBot billing works</div>
                <h2 className={`mt-2 text-2xl font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>One wallet, different model burn rates</h2>
              </div>
              <div className={`rounded-2xl border px-4 py-3 text-xs leading-5 ${subtlePanel} ${mutedText}`}>
                OpenRouter snapshot: May 22, 2026. Example paid lanes use a 50/50 input-output blended estimate, rounded up to protect the 3x margin target.
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <BillingRuleCard isDarkMode={isDarkMode} title="Buy packs" value="$1–$250" body="Token packs are sold through Stripe Checkout at $1 = 10,000 BotBot tokens, then credited to your BotBot wallet after the signed payment webhook lands." />
              <BillingRuleCard isDarkMode={isDarkMode} title="Route by cost" value="2–53 / 1K" body="The table shows how many BotBot tokens each model lane burns per 1,000 model tokens." />
              <BillingRuleCard isDarkMode={isDarkMode} title="Margin target" value="3x" body="WOLF prices the meter at roughly three times the OpenRouter provider cost before support and operating overhead." />
            </div>
            <div className={`mt-5 overflow-hidden rounded-2xl border ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-800">
                  <thead className={isDarkMode ? 'bg-slate-900 text-slate-300' : 'bg-slate-50 text-slate-600'}>
                    <tr>
                      <th className="px-4 py-3 font-semibold">Model lane</th>
                      <th className="px-4 py-3 font-semibold">Class</th>
                      <th className="px-4 py-3 font-semibold">OpenRouter cost / 1K</th>
                      <th className="px-4 py-3 font-semibold">BotBot debit / 1K</th>
                      <th className="px-4 py-3 font-semibold">Starter pack approx.</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                    {PAID_MODEL_PRICING.map(model => (
                      <tr key={model.modelId} className={isDarkMode ? 'bg-slate-950/40' : 'bg-white'}>
                        <td className="px-4 py-3 align-top">
                          <div className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{model.name}</div>
                          <div className={`mt-1 font-mono text-[11px] ${mutedText}`}>{model.modelId}</div>
                          <div className={`mt-2 max-w-xs text-xs leading-5 ${mutedText}`}>{model.note}</div>
                        </td>
                        <td className={`px-4 py-3 align-top ${mutedText}`}>{model.className}</td>
                        <td className={`px-4 py-3 align-top font-mono ${mutedText}`}>{model.providerCostPer1k}</td>
                        <td className="px-4 py-3 align-top">
                          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-500">
                            {model.botbotDebitPer1k} tokens
                          </span>
                        </td>
                        <td className={`px-4 py-3 align-top ${mutedText}`}>{model.approxModelTokensPerStarter} model tokens</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <aside className={`rounded-3xl border p-5 ${panelClass}`}>
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-500">Free-model lane</div>
            <h2 className={`mt-2 text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Capped access to popular free models</h2>
            <p className={`mt-3 text-sm leading-6 ${mutedText}`}>
              OpenRouter free models are still rate-limited upstream: current docs say 50 free-model requests per day before $10 in purchased OpenRouter credits, and 1,000 per day after that. WOLF keeps this lane separate from paid tokens with 500 shared free-lane prompt credits and a combined 25-prompt daily cap across these three models.
            </p>
            <div className="mt-4 space-y-3">
              {FREE_MODEL_OPTIONS.map(model => (
                <div key={model.modelId} className={`rounded-2xl border p-4 ${subtlePanel}`}>
                  <div className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{model.name}</div>
                  <div className={`mt-1 font-mono text-[11px] ${mutedText}`}>{model.modelId}</div>
                  <div className={`mt-2 flex flex-wrap gap-2 text-[11px] font-semibold ${mutedText}`}>
                    <span className="rounded-full border border-emerald-500/30 px-2 py-1 text-emerald-500">{model.context}</span>
                    <span className="rounded-full border border-amber-500/30 px-2 py-1 text-amber-500">{model.limit}</span>
                  </div>
                  <p className={`mt-2 text-xs leading-5 ${mutedText}`}>{model.note}</p>
                </div>
              ))}
            </div>
            <div className={`mt-4 rounded-2xl border p-4 text-xs leading-5 ${isDarkMode ? 'border-amber-500/30 bg-amber-500/10 text-amber-100' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
              Free does not mean unlimited. OpenRouter charges $0 only while the upstream free route accepts traffic; after throttling, free-lane prompts may pause until capacity resets.
            </div>
          </aside>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className={`rounded-3xl border p-5 ${panelClass}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-500">Current balance</div>
                <h2 className={`mt-1 text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Token usage</h2>
              </div>
              <button
                type="button"
                onClick={loadUsage}
                disabled={usageLoading}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:opacity-60 ${
                  isDarkMode
                    ? 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <RefreshCw size={14} className={usageLoading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>

            {usageLoading ? (
              <div className={`mt-5 flex items-center gap-2 rounded-2xl border p-4 text-sm ${subtlePanel} ${mutedText}`}>
                <Loader2 size={16} className="animate-spin" /> Loading token usage...
              </div>
            ) : usageError ? (
              <div className={`mt-5 rounded-2xl border p-4 text-sm ${isDarkMode ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                {usageError}
              </div>
            ) : (
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <MetricCard isDarkMode={isDarkMode} label="Remaining" value={formatNumber(usageTotals.remaining)} />
                  <MetricCard isDarkMode={isDarkMode} label="Used" value={formatNumber(usageTotals.used)} />
                  <MetricCard isDarkMode={isDarkMode} label="Quota" value={formatNumber(usageTotals.quota)} />
                </div>
                <div className={`mt-5 h-2 overflow-hidden rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <div
                    className={`h-full rounded-full ${usagePct > 90 ? 'bg-red-500' : usagePct > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${usagePct}%` }}
                  />
                </div>
                <div className={`mt-3 text-xs ${mutedText}`}>{usagePct}% of current quota used across visible BotBot models.</div>
              </>
            )}
          </div>

          <form onSubmit={handleClaimSubmit} className={`rounded-3xl border p-5 ${panelClass}`}>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-500">
              <Ticket size={16} /> Claim code
            </div>
            <h2 className={`mt-2 text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Redeem pending tokens</h2>
            <p className={`mt-2 text-sm leading-6 ${mutedText}`}>
              Use this only if an older Shopify top-up generates a pending claim code instead of auto-crediting your login email.
            </p>
            <label htmlFor="botbot-claim-code" className={`mt-4 block text-xs font-semibold uppercase tracking-wide ${mutedText}`}>
              Claim code
            </label>
            <input
              id="botbot-claim-code"
              value={claimCode}
              onChange={event => setClaimCode(event.target.value.toUpperCase())}
              placeholder="BOTP-XXXXXXXX"
              className={`mt-2 w-full rounded-2xl border px-4 py-3 text-sm font-semibold outline-none transition ${inputClass}`}
            />
            <button
              type="submit"
              disabled={!claimCode.trim() || claimBusy}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-950/10 transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {claimBusy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Redeem claim code
            </button>
            {claimMessage && (
              <div className={`mt-4 rounded-2xl border p-3 text-sm ${isDarkMode ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
                {claimMessage}
              </div>
            )}
            {claimError && (
              <div className={`mt-4 rounded-2xl border p-3 text-sm ${isDarkMode ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-red-200 bg-red-50 text-red-700'}`}>
                {claimError}
              </div>
            )}
          </form>
        </section>

        {checkoutError && (
          <div className={`rounded-2xl border p-4 text-sm ${isDarkMode ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-red-200 bg-red-50 text-red-700'}`}>
            {checkoutError}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          {tokenPacks.map(pack => (
            <article
              key={pack.id}
              className={`relative rounded-3xl border p-5 ${
                pack.featured
                  ? isDarkMode
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-slate-100 shadow-lg shadow-emerald-950/20'
                    : 'border-emerald-200 bg-emerald-50/70 text-slate-900 shadow-sm'
                  : panelClass
              }`}
            >
              {pack.featured && (
                <div className="absolute right-4 top-4 rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                  Best value
                </div>
              )}
              <div className="pr-20">
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-500">{pack.modelKey} model</div>
                <h3 className={`mt-3 text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{pack.label}</h3>
              </div>
              <div className={`mt-5 text-4xl font-semibold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-950'}`}>
                {formatNumber(pack.tokens)}
              </div>
              <div className={`mt-1 text-sm font-semibold ${mutedText}`}>{pack.priceLabel}</div>
              <p className={`mt-4 min-h-12 text-sm leading-6 ${mutedText}`}>{pack.description}</p>

              <button
                type="button"
                onClick={() => handleCheckoutClick(pack)}
                disabled={Boolean(checkoutBusyPackId)}
                aria-label={`Buy ${pack.label} with Stripe`}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60 dark:bg-emerald-500 dark:hover:bg-emerald-600"
              >
                {checkoutBusyPackId === pack.id ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={15} />}
                Buy with Stripe
              </button>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
};

const BillingRuleCard: React.FC<{ isDarkMode: boolean; title: string; value: string; body: string }> = ({
  isDarkMode,
  title,
  value,
  body,
}) => (
  <div className={`rounded-2xl border p-4 ${isDarkMode ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-slate-50'}`}>
    <div className={`text-[10px] font-semibold uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>{title}</div>
    <div className={`mt-2 text-2xl font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{value}</div>
    <p className={`mt-2 text-xs leading-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{body}</p>
  </div>
);

const MetricCard: React.FC<{ isDarkMode: boolean; label: string; value: string }> = ({ isDarkMode, label, value }) => (
  <div className={`rounded-2xl border p-4 ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
    <div className={`text-[10px] font-semibold uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>{label}</div>
    <div className={`mt-2 text-2xl font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{value}</div>
  </div>
);

export default BotBotBuyTokensPage;
