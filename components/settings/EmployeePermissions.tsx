import React, { useEffect, useMemo, useState } from "react";
import type { ManagedUser, PermissionCatalogEntry, PermissionMode } from "../../types";
import { fetchAdminUsers } from "../../services/adminUsersApi";
import {
  fetchEmployeePermissions,
  saveEmployeePermissions,
} from "../../services/employeePermissionsApi";
import { MODULE_TO_DASHBOARD_CARD_KEYS } from "../app/permissions";

const EmployeePermissions: React.FC = () => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [catalog, setCatalog] = useState<PermissionCatalogEntry[]>([]);
  const [mode, setMode] = useState<PermissionMode>("role");
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [rolePermissions, setRolePermissions] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoadingUsers(true);
    setError(null);
    try {
      const rows = await fetchAdminUsers();
      setUsers(rows);
      if (!selectedUserId && rows[0]?.id) setSelectedUserId(rows[0].id);
      if (selectedUserId && !rows.find((row) => row.id === selectedUserId)) {
        setSelectedUserId(rows[0]?.id || "");
      }
    } catch (err: any) {
      setError(String(err?.message || err || "Failed to load employees"));
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadPermissions = async (userId: string) => {
    if (!userId) return;
    setLoadingPermissions(true);
    setError(null);
    try {
      const { catalog: nextCatalog, row } = await fetchEmployeePermissions(userId);
      setCatalog(nextCatalog);
      if (!row) return;
      setMode(row.permissionMode);
      setDraft({ ...(row.permissionMode === "explicit" ? row.explicitPermissions : row.rolePermissions) });
      setRolePermissions({ ...row.rolePermissions });
    } catch (err: any) {
      setError(String(err?.message || err || "Failed to load employee permissions"));
    } finally {
      setLoadingPermissions(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  useEffect(() => {
    if (!selectedUserId) return;
    void loadPermissions(selectedUserId);
  }, [selectedUserId]);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [users, selectedUserId]
  );

  const groupedCatalog = useMemo(() => {
    const groups: Record<"module" | "dashboard_card" | "feature", PermissionCatalogEntry[]> = {
      module: [],
      dashboard_card: [],
      feature: [],
    };
    const queryLower = query.trim().toLowerCase();
    const matches = (entry: PermissionCatalogEntry) =>
      !queryLower ||
      entry.label.toLowerCase().includes(queryLower) ||
      entry.description.toLowerCase().includes(queryLower) ||
      entry.key.toLowerCase().includes(queryLower);
    for (const entry of catalog) {
      if (!matches(entry)) continue;
      groups[entry.scope].push(entry);
    }
    return groups;
  }, [catalog, query]);

  const dashboardByKey = useMemo(() => {
    const out = new Map<string, PermissionCatalogEntry>();
    for (const entry of catalog) {
      if (entry.scope === "dashboard_card") out.set(entry.key, entry);
    }
    return out;
  }, [catalog]);

  const moduleRows = useMemo(
    () =>
      groupedCatalog.module.map((moduleEntry) => ({
        moduleEntry,
        linkedCards: (MODULE_TO_DASHBOARD_CARD_KEYS[moduleEntry.key] || [])
          .map((key) => dashboardByKey.get(key))
          .filter(Boolean) as PermissionCatalogEntry[],
      })),
    [dashboardByKey, groupedCatalog.module]
  );

  const orphanDashboardCards = useMemo(() => {
    const linked = new Set<string>();
    for (const values of Object.values(MODULE_TO_DASHBOARD_CARD_KEYS)) {
      for (const key of values) linked.add(key);
    }
    return groupedCatalog.dashboard_card.filter((entry) => !linked.has(entry.key));
  }, [groupedCatalog.dashboard_card]);

  const activeMap = mode === "explicit" ? draft : rolePermissions;
  const editable = mode === "explicit";

  const totals = useMemo(() => {
    const enabled = catalog.filter((entry) => Boolean(activeMap[entry.key])).length;
    const changed = catalog.filter((entry) => Boolean(draft[entry.key]) !== Boolean(rolePermissions[entry.key])).length;
    return { enabled, total: catalog.length, changed };
  }, [activeMap, catalog, draft, rolePermissions]);

  const toggle = (key: string) => {
    if (!editable) return;
    setMessage(null);
    setDraft((curr) => ({ ...curr, [key]: !curr[key] }));
  };

  const applyPreset = (preset: "recommended" | "all_on" | "all_off") => {
    if (!editable) return;
    const next: Record<string, boolean> = {};
    for (const entry of catalog) next[entry.key] = false;
    if (preset === "all_on") {
      for (const entry of catalog) next[entry.key] = true;
    } else if (preset === "recommended") {
      for (const [key, value] of Object.entries(rolePermissions)) next[key] = Boolean(value);
    }
    setDraft(next);
    setMessage(null);
  };

  const setScopeAll = (scope: "module" | "dashboard_card" | "feature", value: boolean) => {
    if (!editable) return;
    setDraft((curr) => {
      const next = { ...curr };
      for (const entry of groupedCatalog[scope]) next[entry.key] = value;
      return next;
    });
  };

  const handleSave = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await saveEmployeePermissions(selectedUserId, mode, draft);
      setMessage(
        mode === "explicit"
          ? `Saved custom access for ${selectedUser?.email || "employee"}.`
          : `Reset ${selectedUser?.email || "employee"} to role-based access.`
      );
      await loadPermissions(selectedUserId);
      await loadUsers();
    } catch (err: any) {
      setError(String(err?.message || err || "Failed to save employee permissions"));
    } finally {
      setSaving(false);
    }
  };

  const statusTone =
    selectedUser?.accessStatus === "approved"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : "bg-amber-50 text-amber-700 border-amber-200";

  return (
    <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Employee Permissions</h3>
          <p className="text-sm text-slate-500">
            Choose module access per employee, or let them inherit their role defaults.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadUsers()}
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!selectedUserId || saving || loadingPermissions}
            className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Employee Access"}
          </button>
        </div>
      </div>

      {message && <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>}
      {error && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Employees</div>
          {loadingUsers ? (
            <div className="text-sm text-slate-500">Loading employees...</div>
          ) : (
            <div className="space-y-2">
              {users.map((user) => {
                const active = user.id === selectedUserId;
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setSelectedUserId(user.id)}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                      active
                        ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <div className="text-sm font-semibold">{user.name}</div>
                    <div className={`text-xs ${active ? "text-slate-200" : "text-slate-500"}`}>{user.email}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {user.roles.map((role) => (
                        <span
                          key={`${user.id}-${role}`}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            active ? "bg-white/10 text-slate-100" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {!selectedUser ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-slate-500">
              Select an employee to edit their access.
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-slate-900">{selectedUser.name}</div>
                    <div className="text-sm text-slate-600">{selectedUser.email}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedUser.roles.map((role) => (
                        <span key={role} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2 text-right">
                    <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusTone}`}>
                      {selectedUser.accessStatus === "approved" ? "Approved access" : "Pending approval"}
                    </div>
                    <div className="text-xs text-slate-500">
                      Mode: <span className="font-semibold text-slate-700">{mode === "explicit" ? "Employee override" : "Role defaults"}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      Enabled: <span className="font-semibold text-slate-700">{totals.enabled}/{totals.total}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("role");
                      setMessage(null);
                    }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      mode === "role" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    Use Role Defaults
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("explicit");
                      setDraft({ ...activeMap });
                      setMessage(null);
                    }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      mode === "explicit" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    Customize Employee Access
                  </button>
                  {mode === "explicit" && (
                    <span className="text-xs text-slate-500">
                      {totals.changed ? `${totals.changed} custom changes compared to role defaults` : "Matches current access"}
                    </span>
                  )}
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
                    disabled={!editable}
                    onClick={() => applyPreset("recommended")}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                  >
                    Match Role Template
                  </button>
                  <button
                    type="button"
                    disabled={!editable}
                    onClick={() => applyPreset("all_on")}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 disabled:opacity-50"
                  >
                    Enable All
                  </button>
                  <button
                    type="button"
                    disabled={!editable}
                    onClick={() => applyPreset("all_off")}
                    className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-50"
                  >
                    Disable All
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Modules + Linked Cards</div>
                    <div className="flex items-center gap-2 text-[11px] font-semibold">
                      <button
                        type="button"
                        disabled={!editable}
                        onClick={() => setScopeAll("module", true)}
                        className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600 disabled:opacity-50"
                      >
                        Enable Modules
                      </button>
                      <button
                        type="button"
                        disabled={!editable}
                        onClick={() => setScopeAll("module", false)}
                        className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600 disabled:opacity-50"
                      >
                        Disable Modules
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {moduleRows.map(({ moduleEntry, linkedCards }) => {
                      const moduleEnabled = Boolean(activeMap[moduleEntry.key]);
                      const linkedEnabled = linkedCards.filter((entry) => Boolean(activeMap[entry.key])).length;
                      return (
                        <div key={moduleEntry.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <label className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={moduleEnabled}
                              onChange={() => toggle(moduleEntry.key)}
                              disabled={!editable}
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
                                  <label key={entry.key} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(activeMap[entry.key])}
                                      onChange={() => toggle(entry.key)}
                                      disabled={!editable}
                                      className="mt-0.5"
                                    />
                                    <span className="text-xs text-slate-700">
                                      <span className="block font-semibold">{entry.label.replace("Dashboard Card: ", "")}</span>
                                      <span className="block text-slate-500">{entry.description}</span>
                                    </span>
                                  </label>
                                ))}
                              </div>
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
                          disabled={!editable}
                          onClick={() => setScopeAll("dashboard_card", true)}
                          className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600 disabled:opacity-50"
                        >
                          Enable Cards
                        </button>
                        <button
                          type="button"
                          disabled={!editable}
                          onClick={() => setScopeAll("dashboard_card", false)}
                          className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600 disabled:opacity-50"
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
                            checked={Boolean(activeMap[entry.key])}
                            onChange={() => toggle(entry.key)}
                            disabled={!editable}
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
                        disabled={!editable}
                        onClick={() => setScopeAll("feature", true)}
                        className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600 disabled:opacity-50"
                      >
                        Enable Features
                      </button>
                      <button
                        type="button"
                        disabled={!editable}
                        onClick={() => setScopeAll("feature", false)}
                        className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600 disabled:opacity-50"
                      >
                        Disable Features
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {groupedCatalog.feature.map((entry) => (
                      <label key={entry.key} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <input
                          type="checkbox"
                          checked={Boolean(activeMap[entry.key])}
                          onChange={() => toggle(entry.key)}
                          disabled={!editable}
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
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default EmployeePermissions;
