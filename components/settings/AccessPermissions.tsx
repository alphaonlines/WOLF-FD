import React, { useEffect, useMemo, useState } from "react";
import type { PermissionCatalogEntry, UserRole } from "../../types";
import { fetchRolePermissions, saveRolePermissions } from "../../services/accessPermissionsApi";
import {
  buildRoleFallbackPermissionMap,
  MODULE_TO_DASHBOARD_CARD_KEYS,
} from "../app/permissions";

const ROLE_ORDER: UserRole[] = ["Owner", "Manager", "Sales", "Marketing"];

const AccessPermissions: React.FC = () => {
  const [catalog, setCatalog] = useState<PermissionCatalogEntry[]>([]);
  const [roleRows, setRoleRows] = useState<Array<{ roleKey: UserRole; label: string; permissions: Record<string, boolean> }>>([]);
  const [selectedRole, setSelectedRole] = useState<UserRole>("Owner");
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { catalog: nextCatalog, rows } = await fetchRolePermissions();
      const safeRows = rows.filter((row) => ROLE_ORDER.includes(row.roleKey));
      setCatalog(nextCatalog);
      setRoleRows(
        [...safeRows].sort((a, b) => ROLE_ORDER.indexOf(a.roleKey) - ROLE_ORDER.indexOf(b.roleKey))
      );
      if (!safeRows.find((row) => row.roleKey === selectedRole) && safeRows[0]) {
        setSelectedRole(safeRows[0].roleKey);
      }
    } catch (err: any) {
      setError(String(err?.message || err || "Failed to load access permissions"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const row = roleRows.find((item) => item.roleKey === selectedRole);
    if (!row) {
      setDraft({});
      return;
    }
    setDraft({ ...row.permissions });
  }, [roleRows, selectedRole]);

  const groupedCatalog = useMemo(() => {
    const groups: Record<string, PermissionCatalogEntry[]> = {
      module: [],
      dashboard_card: [],
      feature: [],
    };
    for (const entry of catalog) {
      if (entry.scope === "dashboard_card") groups.dashboard_card.push(entry);
      else if (entry.scope === "feature") groups.feature.push(entry);
      else groups.module.push(entry);
    }
    return groups;
  }, [catalog]);

  const selectedRow = useMemo(
    () => roleRows.find((row) => row.roleKey === selectedRole) ?? null,
    [roleRows, selectedRole]
  );

  const queryLower = query.trim().toLowerCase();

  const filteredCatalog = useMemo(() => {
    if (!queryLower) return groupedCatalog;
    const match = (entry: PermissionCatalogEntry) =>
      entry.label.toLowerCase().includes(queryLower) ||
      entry.description.toLowerCase().includes(queryLower) ||
      entry.key.toLowerCase().includes(queryLower);
    return {
      module: groupedCatalog.module.filter(match),
      dashboard_card: groupedCatalog.dashboard_card.filter(match),
      feature: groupedCatalog.feature.filter(match),
    };
  }, [groupedCatalog, queryLower]);

  const dashboardByKey = useMemo(() => {
    const out = new Map<string, PermissionCatalogEntry>();
    for (const entry of groupedCatalog.dashboard_card) out.set(entry.key, entry);
    return out;
  }, [groupedCatalog.dashboard_card]);

  const moduleRows = useMemo(() => {
    return filteredCatalog.module.map((moduleEntry) => {
      const linkedKeys = MODULE_TO_DASHBOARD_CARD_KEYS[moduleEntry.key] || [];
      const linkedCards = linkedKeys.map((key) => dashboardByKey.get(key)).filter(Boolean) as PermissionCatalogEntry[];
      return { moduleEntry, linkedCards };
    });
  }, [filteredCatalog.module, dashboardByKey]);

  const orphanDashboardCards = useMemo(() => {
    const linked = new Set<string>();
    for (const keyList of Object.values(MODULE_TO_DASHBOARD_CARD_KEYS)) {
      for (const key of keyList) linked.add(key);
    }
    return filteredCatalog.dashboard_card.filter((entry) => !linked.has(entry.key));
  }, [filteredCatalog.dashboard_card]);

  const totals = useMemo(() => {
    const allKeys = catalog.map((entry) => entry.key);
    const enabled = allKeys.filter((key) => Boolean(draft[key])).length;
    const modulesEnabled = groupedCatalog.module.filter((entry) => Boolean(draft[entry.key])).length;
    const cardsEnabled = groupedCatalog.dashboard_card.filter((entry) => Boolean(draft[entry.key])).length;
    const featuresEnabled = groupedCatalog.feature.filter((entry) => Boolean(draft[entry.key])).length;
    const changed = allKeys.filter((key) => Boolean(draft[key]) !== Boolean(selectedRow?.permissions?.[key])).length;
    return {
      enabled,
      all: allKeys.length,
      modulesEnabled,
      modulesAll: groupedCatalog.module.length,
      cardsEnabled,
      cardsAll: groupedCatalog.dashboard_card.length,
      featuresEnabled,
      featuresAll: groupedCatalog.feature.length,
      changed,
    };
  }, [catalog, draft, groupedCatalog, selectedRow]);

  const toggle = (key: string) => {
    setMessage(null);
    setDraft((curr) => ({ ...curr, [key]: !curr[key] }));
  };

  const applyRolePreset = (preset: "recommended" | "all_on" | "all_off") => {
    setMessage(null);
    setError(null);
    if (!catalog.length) return;

    if (preset === "all_on") {
      const next: Record<string, boolean> = {};
      for (const entry of catalog) next[entry.key] = true;
      setDraft(next);
      return;
    }

    if (preset === "all_off") {
      const next: Record<string, boolean> = {};
      for (const entry of catalog) next[entry.key] = false;
      setDraft(next);
      return;
    }

    const defaults = buildRoleFallbackPermissionMap(selectedRole);
    const next: Record<string, boolean> = {};
    for (const entry of catalog) next[entry.key] = Boolean(defaults[entry.key]);
    setDraft(next);
  };

  const setScopeAll = (scope: "module" | "dashboard_card" | "feature", value: boolean) => {
    setMessage(null);
    const next = { ...draft };
    const entries =
      scope === "module"
        ? groupedCatalog.module
        : scope === "dashboard_card"
          ? groupedCatalog.dashboard_card
          : groupedCatalog.feature;
    for (const entry of entries) next[entry.key] = value;
    setDraft(next);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const next: Record<string, boolean> = {};
      for (const entry of catalog) next[entry.key] = Boolean(draft[entry.key]);
      await saveRolePermissions(selectedRole, next);
      setMessage(`Saved permissions for ${selectedRole}.`);
      await load();
    } catch (err: any) {
      setError(String(err?.message || err || "Failed to save access permissions"));
    } finally {
      setSaving(false);
    }
  };

  const rolePill = (role: UserRole, active: boolean) => {
    if (active) return "border-blue-200 bg-blue-50 text-blue-700";
    if (role === "Owner") return "border-violet-200 bg-violet-50 text-violet-700";
    if (role === "Manager") return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if (role === "Sales") return "border-amber-200 bg-amber-50 text-amber-700";
    return "border-rose-200 bg-rose-50 text-rose-700";
  };

  const shortCardLabel = (label: string) =>
    label.startsWith("Dashboard Card: ") ? label.slice("Dashboard Card: ".length) : label;

  return (
    <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Role Access Permissions</h3>
          <p className="text-sm text-slate-500">
            Manage module and card access per role with module-linked dashboard shortcuts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || loading}
            className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Access"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {ROLE_ORDER.map((role) => {
          const active = selectedRole === role;
          return (
            <button
              key={role}
              type="button"
              onClick={() => {
                setSelectedRole(role);
                setMessage(null);
              }}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                rolePill(role, active)
              }`}
            >
              {role}
            </button>
          );
        })}
        <span className="ml-1 text-xs text-slate-500">
          {totals.changed ? `${totals.changed} unsaved change${totals.changed === 1 ? "" : "s"}` : "No unsaved changes"}
        </span>
      </div>

      {message && <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>}
      {error && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {loading ? (
        <p className="text-sm text-slate-500">Loading permissions...</p>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Enabled Total</div>
              <div className="text-lg font-semibold text-slate-900">
                {totals.enabled}/{totals.all}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Modules</div>
              <div className="text-lg font-semibold text-slate-900">
                {totals.modulesEnabled}/{totals.modulesAll}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Dashboard Cards</div>
              <div className="text-lg font-semibold text-slate-900">
                {totals.cardsEnabled}/{totals.cardsAll}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Features</div>
              <div className="text-lg font-semibold text-slate-900">
                {totals.featuresEnabled}/{totals.featuresAll}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter permissions..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 md:w-64"
              />
              <button
                type="button"
                onClick={() => applyRolePreset("recommended")}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                Recommended
              </button>
              <button
                type="button"
                onClick={() => applyRolePreset("all_on")}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
              >
                Enable All
              </button>
              <button
                type="button"
                onClick={() => applyRolePreset("all_off")}
                className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700"
              >
                Disable All
              </button>
            </div>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Modules + Linked Cards</div>
              <div className="flex items-center gap-2 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setScopeAll("module", true)}
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600"
                >
                  Enable Modules
                </button>
                <button
                  type="button"
                  onClick={() => setScopeAll("module", false)}
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600"
                >
                  Disable Modules
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {moduleRows.map(({ moduleEntry, linkedCards }) => {
                const moduleEnabled = Boolean(draft[moduleEntry.key]);
                const linkedEnabled = linkedCards.filter((entry) => Boolean(draft[entry.key])).length;
                return (
                  <div key={moduleEntry.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={moduleEnabled}
                        onChange={() => toggle(moduleEntry.key)}
                        className="mt-1"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-slate-800">{moduleEntry.label}</span>
                        <span className="block text-xs text-slate-500">{moduleEntry.description}</span>
                      </span>
                    </label>
                    {!!linkedCards.length && (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Dashboard Cards ({linkedEnabled}/{linkedCards.length} enabled)
                        </div>
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                          {linkedCards.map((entry) => (
                            <label
                              key={entry.key}
                              className={`flex items-start gap-2 rounded-lg border p-2 ${
                                moduleEnabled
                                  ? "border-slate-200 bg-slate-50"
                                  : "border-amber-200 bg-amber-50/60"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={Boolean(draft[entry.key])}
                                onChange={() => toggle(entry.key)}
                                className="mt-0.5"
                              />
                              <span className="text-xs text-slate-700">
                                <span className="block font-semibold">{shortCardLabel(entry.label)}</span>
                                <span className="block text-slate-500">{entry.description}</span>
                              </span>
                            </label>
                          ))}
                        </div>
                        {!moduleEnabled && linkedEnabled > 0 && (
                          <div className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700">
                            Cards are enabled, but users still need this module enabled to access them.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {!!orphanDashboardCards.length && (
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Additional Dashboard Cards</div>
                <div className="flex items-center gap-2 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setScopeAll("dashboard_card", true)}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600"
                  >
                    Enable Cards
                  </button>
                  <button
                    type="button"
                    onClick={() => setScopeAll("dashboard_card", false)}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600"
                  >
                    Disable Cards
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {orphanDashboardCards.map((entry) => (
                  <label key={entry.key} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <input
                      type="checkbox"
                      checked={Boolean(draft[entry.key])}
                      onChange={() => toggle(entry.key)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">{entry.label}</span>
                      <span className="block text-xs text-slate-500">{entry.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Feature Toggles</div>
              <div className="flex items-center gap-2 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setScopeAll("feature", true)}
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600"
                >
                  Enable Features
                </button>
                <button
                  type="button"
                  onClick={() => setScopeAll("feature", false)}
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600"
                >
                  Disable Features
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {filteredCatalog.feature.map((entry) => (
                <label key={entry.key} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <input
                    type="checkbox"
                    checked={Boolean(draft[entry.key])}
                    onChange={() => toggle(entry.key)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">{entry.label}</span>
                    <span className="block text-xs text-slate-500">{entry.description}</span>
                  </span>
                </label>
              ))}
              {!filteredCatalog.feature.length && (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                  No feature toggles match your filter.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default AccessPermissions;
