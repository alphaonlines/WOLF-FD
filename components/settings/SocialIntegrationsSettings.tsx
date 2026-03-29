import React, { useEffect, useMemo, useState } from "react";
import { RefreshCcw, Save, Settings2 } from "lucide-react";
import type { SocialAccount, SocialPlatform } from "../../services/socialApi";
import { fetchSocialAccounts, upsertSocialAccount } from "../../services/socialApi";
import {
  getSocialAccountReadiness,
  SOCIAL_PLATFORM_META_BY_ID,
  SOCIAL_PLATFORM_OPTIONS,
} from "../workAdvertising/socialPlatformGuidance";

type AccountDraft = {
  draftKey: string;
  id: string | null;
  platform: SocialPlatform;
  label: string;
  externalId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: string;
  active: boolean;
  configJsonText: string;
};

const toLocalInputValue = (iso: string | null | undefined) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
};

const fromLocalInputValue = (localValue: string) => {
  if (!localValue) return null;
  const date = new Date(localValue);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const makeAccountDrafts = (accounts: SocialAccount[]): AccountDraft[] => {
  const drafts = accounts.map((account) => ({
    draftKey: account.id,
    id: account.id,
    platform: account.platform,
    label: account.label || "",
    externalId: account.externalId || "",
    accessToken: "",
    refreshToken: "",
    tokenExpiresAt: toLocalInputValue(account.tokenExpiresAt || null),
    active: Boolean(account.active),
    configJsonText: JSON.stringify(account.configJson || {}, null, 2),
  }));

  for (const platform of SOCIAL_PLATFORM_OPTIONS.map((item) => item.id)) {
    if (!drafts.some((draft) => draft.platform === platform)) {
      drafts.push({
        draftKey: `new-${platform}`,
        id: null,
        platform,
        label: "",
        externalId: "",
        accessToken: "",
        refreshToken: "",
        tokenExpiresAt: "",
        active: false,
        configJsonText: "{}",
      });
    }
  }

  return drafts;
};

const SocialIntegrationsSettings: React.FC = () => {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [accountDrafts, setAccountDrafts] = useState<AccountDraft[]>(() => makeAccountDrafts([]));
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAccounts = async () => {
    setBusyKey("refresh");
    setError(null);
    try {
      const nextAccounts = await fetchSocialAccounts();
      setAccounts(nextAccounts);
      setAccountDrafts(makeAccountDrafts(nextAccounts));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load social integrations.");
    } finally {
      setBusyKey(null);
    }
  };

  useEffect(() => {
    void loadAccounts();
  }, []);

  const accountCounts = useMemo(
    () => ({
      total: accounts.length,
      active: accounts.filter((account) => account.active).length,
      configured: accounts.filter((account) => account.accessTokenConfigured && account.externalId).length,
    }),
    [accounts]
  );

  const updateAccountDraft = (draftKey: string, patch: Partial<AccountDraft>) => {
    setAccountDrafts((current) =>
      current.map((draft) => (draft.draftKey === draftKey ? { ...draft, ...patch } : draft))
    );
  };

  const addAccountDraft = (platform: SocialPlatform) => {
    setAccountDrafts((current) => [
      ...current,
      {
        draftKey: `new-${platform}-${Date.now()}`,
        id: null,
        platform,
        label: "",
        externalId: "",
        accessToken: "",
        refreshToken: "",
        tokenExpiresAt: "",
        active: false,
        configJsonText: "{}",
      },
    ]);
  };

  const saveAccount = async (draftKey: string) => {
    const draft = accountDrafts.find((item) => item.draftKey === draftKey);
    if (!draft) return;
    setBusyKey(`account-${draftKey}`);
    setError(null);
    setMessage(null);
    try {
      let configJson: Record<string, any> = {};
      try {
        configJson = draft.configJsonText.trim() ? JSON.parse(draft.configJsonText) : {};
      } catch {
        throw new Error("Extra config must be valid JSON before you can save this integration.");
      }
      const next = await upsertSocialAccount({
        id: draft.id,
        platform: draft.platform,
        label: draft.label,
        externalId: draft.externalId,
        accessToken: draft.accessToken,
        refreshToken: draft.refreshToken,
        tokenExpiresAt: fromLocalInputValue(draft.tokenExpiresAt),
        active: draft.active,
        configJson,
      });
      if (!next) throw new Error(`Unable to save ${draft.platform} integration.`);
      const updatedAccounts = (() => {
        const exists = accounts.some((item) => item.id === next.id);
        const rows = exists ? accounts.map((item) => (item.id === next.id ? next : item)) : [...accounts, next];
        return [...rows].sort((a, b) => a.platform.localeCompare(b.platform) || a.label.localeCompare(b.label));
      })();
      setAccounts(updatedAccounts);
      setAccountDrafts(makeAccountDrafts(updatedAccounts));
      setMessage(`${draft.platform[0].toUpperCase()}${draft.platform.slice(1)} integration saved.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to save ${draft.platform} integration.`);
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              <Settings2 size={14} />
              Social Integrations
            </div>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">Provider credentials and destinations</h3>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Manage API keys, tokens, refresh tokens, page/account IDs, and location paths here so the Social Posts
              module stays focused on composing and scheduling.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadAccounts()}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            <RefreshCcw size={15} />
            {busyKey === "refresh" ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Saved Accounts</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{accountCounts.total}</div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-xs uppercase tracking-wide text-emerald-700">Active</div>
            <div className="mt-2 text-3xl font-semibold text-emerald-950">{accountCounts.active}</div>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="text-xs uppercase tracking-wide text-blue-700">Configured</div>
            <div className="mt-2 text-3xl font-semibold text-blue-950">{accountCounts.configured}</div>
          </div>
        </div>
      </section>

      {(message || error) && (
        <section
          className={`rounded-3xl border p-4 text-sm shadow-sm ${
            error ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {error || message}
        </section>
      )}

      <section className="space-y-5">
        {SOCIAL_PLATFORM_OPTIONS.map((platform) => {
          const drafts = accountDrafts.filter((item) => item.platform === platform.id);
          const platformMeta = SOCIAL_PLATFORM_META_BY_ID[platform.id];
          return (
            <div key={platform.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-lg font-semibold text-slate-900">{platform.label}</h4>
                  <p className="mt-1 text-sm text-slate-500">{platformMeta.helpText}</p>
                  <a
                    href={platformMeta.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex text-xs font-semibold text-blue-700 underline-offset-2 hover:underline"
                  >
                    Open official setup docs
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => addAccountDraft(platform.id)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  Add {platform.label}
                </button>
              </div>

              <div className="mt-5 space-y-4">
                {drafts.map((draft, index) => {
                  const saved = draft.id ? accounts.find((item) => item.id === draft.id) || null : null;
                  const readiness = getSocialAccountReadiness(platform.id, saved);
                  return (
                    <div key={draft.draftKey} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                            {platform.label} {index + 1}
                          </div>
                          <div className="mt-2 inline-flex items-center gap-2">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                readiness.severity === "ready"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : readiness.severity === "warning"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {readiness.headline}
                            </span>
                            <span className="text-xs text-slate-500">{readiness.tokenExpiryLabel}</span>
                          </div>
                          {(readiness.issues.length > 0 || readiness.warnings.length > 0) && (
                            <div className="mt-2 space-y-1 text-xs">
                              {readiness.issues.map((issue) => (
                                <div key={`${draft.draftKey}-issue-${issue}`} className="text-rose-700">
                                  {issue}
                                </div>
                              ))}
                              {readiness.warnings.map((warning) => (
                                <div key={`${draft.draftKey}-warning-${warning}`} className="text-amber-700">
                                  {warning}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                          <input
                            type="checkbox"
                            checked={draft.active}
                            onChange={(event) => updateAccountDraft(draft.draftKey, { active: event.target.checked })}
                          />
                          Active
                        </label>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
                        <input
                          type="text"
                          value={draft.label}
                          onChange={(event) => updateAccountDraft(draft.draftKey, { label: event.target.value })}
                          placeholder={`${platform.label} label`}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                        />
                        <input
                          type="text"
                          value={draft.externalId}
                          onChange={(event) => updateAccountDraft(draft.draftKey, { externalId: event.target.value })}
                          placeholder={platformMeta.externalIdPlaceholder}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                        />
                        <input
                          type="password"
                          value={draft.accessToken}
                          onChange={(event) => updateAccountDraft(draft.draftKey, { accessToken: event.target.value })}
                          placeholder={
                            saved?.accessTokenConfigured ? `Token saved: ${saved.tokenPreview}` : platformMeta.accessTokenLabel
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                        />
                        <input
                          type="password"
                          value={draft.refreshToken}
                          onChange={(event) => updateAccountDraft(draft.draftKey, { refreshToken: event.target.value })}
                          placeholder={
                            saved?.refreshTokenConfigured ? "Refresh token saved" : `${platformMeta.refreshTokenLabel} (optional)`
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                        />
                        <input
                          type="datetime-local"
                          value={draft.tokenExpiresAt}
                          onChange={(event) => updateAccountDraft(draft.draftKey, { tokenExpiresAt: event.target.value })}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                        />
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
                        <label className="block">
                          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {platformMeta.externalIdLabel}
                          </div>
                          <div className="text-xs text-slate-500">
                            {platformMeta.helpText}
                          </div>
                        </label>
                        <label className="block">
                          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Extra Config JSON
                          </div>
                          <textarea
                            value={draft.configJsonText}
                            onChange={(event) => updateAccountDraft(draft.draftKey, { configJsonText: event.target.value })}
                            rows={6}
                            spellCheck={false}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-mono text-xs outline-none focus:border-slate-400"
                            placeholder={platformMeta.configExample}
                          />
                        </label>
                      </div>

                      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
                        {platformMeta.requirements.map((line) => (
                          <div key={`${draft.draftKey}-requirement-${line}`} className="mt-1 first:mt-0">
                            {line}
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => void saveAccount(draft.draftKey)}
                        disabled={busyKey !== null}
                        className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        <Save size={14} />
                        {busyKey === `account-${draft.draftKey}` ? "Saving..." : draft.id ? "Save Changes" : "Save Integration"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
};

export default SocialIntegrationsSettings;
