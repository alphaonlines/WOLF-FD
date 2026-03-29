import React, { useEffect, useMemo, useState } from "react";
import { RefreshCcw, Save, ShieldCheck } from "lucide-react";
import type { AuthConfig } from "../../types";
import { fetchAuthWorkspaceSettings, updateAuthWorkspaceSettings } from "../../services/authApi";

const EMPTY_SETTINGS: AuthConfig = {
  googleWorkspaceEnabled: false,
  googleClientId: "",
  googleHostedDomain: "furnituredistributors.net",
  updatedAt: null,
  source: "environment",
};

const AuthWorkspaceSettings: React.FC = () => {
  const [settings, setSettings] = useState<AuthConfig>(EMPTY_SETTINGS);
  const [draft, setDraft] = useState<AuthConfig>(EMPTY_SETTINGS);
  const [busyKey, setBusyKey] = useState<"refresh" | "save" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = async () => {
    setBusyKey("refresh");
    setError(null);
    try {
      const next = await fetchAuthWorkspaceSettings();
      setSettings(next);
      setDraft(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load auth settings.");
    } finally {
      setBusyKey(null);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const hasChanges = useMemo(() => {
    return (
      settings.googleWorkspaceEnabled !== draft.googleWorkspaceEnabled ||
      settings.googleClientId !== draft.googleClientId ||
      settings.googleHostedDomain !== draft.googleHostedDomain
    );
  }, [draft, settings]);

  const saveSettings = async () => {
    setBusyKey("save");
    setError(null);
    setMessage(null);
    try {
      const next = await updateAuthWorkspaceSettings({
        ...draft,
        googleClientId: draft.googleClientId.trim(),
        googleHostedDomain: draft.googleHostedDomain.trim().toLowerCase(),
      });
      setSettings(next);
      setDraft(next);
      setMessage("Google Workspace sign-in settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save auth settings.");
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
              <ShieldCheck size={14} />
              Auth Settings
            </div>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">Google Workspace sign-in</h3>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Configure the Google client ID and hosted domain used by the FD dashboard login flow and employee
              access-request screens.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadSettings()}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            <RefreshCcw size={15} />
            {busyKey === "refresh" ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Current Source</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">
              {settings.source === "database" ? "FD Settings" : "Server Env"}
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-xs uppercase tracking-wide text-emerald-700">Status</div>
            <div className="mt-2 text-2xl font-semibold text-emerald-950">
              {settings.googleWorkspaceEnabled ? "Enabled" : "Disabled"}
            </div>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="text-xs uppercase tracking-wide text-blue-700">Last Updated</div>
            <div className="mt-2 text-sm font-semibold text-blue-950">
              {settings.updatedAt ? new Date(settings.updatedAt).toLocaleString() : "Using server defaults"}
            </div>
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

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <input
              type="checkbox"
              checked={draft.googleWorkspaceEnabled}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  googleWorkspaceEnabled: event.target.checked,
                }))
              }
              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">Enable Google Workspace sign-in</span>
              <span className="mt-1 block text-sm text-slate-500">
                When enabled, the FD dashboard login screen offers Google sign-in and access requests for your hosted
                domain.
              </span>
            </span>
          </label>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            This controls the FD dashboard auth flow. The separate WOLF admin page under <span className="font-semibold">/home/alphahs/web</span>
            still has its own server-side config.
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Google Web Client ID</span>
            <input
              type="text"
              value={draft.googleClientId}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  googleClientId: event.target.value,
                }))
              }
              placeholder="1234567890-abc123.apps.googleusercontent.com"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Hosted Domain</span>
            <input
              type="text"
              value={draft.googleHostedDomain}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  googleHostedDomain: event.target.value,
                }))
              }
              placeholder="furnituredistributors.net"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void saveSettings()}
            disabled={busyKey === "save" || !hasChanges}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={15} />
            {busyKey === "save" ? "Saving..." : "Save Auth Settings"}
          </button>
          <span className="text-sm text-slate-500">
            Changes apply to the FD dashboard auth endpoints immediately after save.
          </span>
        </div>
      </section>
    </div>
  );
};

export default AuthWorkspaceSettings;
