import React, { useEffect, useMemo, useState } from "react";
import type { PermissionCatalogEntry, UserRole } from "../../types";
import { fetchRolePermissions, saveRolePermissions } from "../../services/accessPermissionsApi";

const ROLE_ORDER: UserRole[] = ["Owner", "Manager", "Sales", "Marketing"];

const AccessPermissions: React.FC = () => {
  const [catalog, setCatalog] = useState<PermissionCatalogEntry[]>([]);
  const [roleRows, setRoleRows] = useState<Array<{ roleKey: UserRole; label: string; permissions: Record<string, boolean> }>>([]);
  const [selectedRole, setSelectedRole] = useState<UserRole>("Owner");
  const [draft, setDraft] = useState<Record<string, boolean>>({});
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
      setRoleRows(safeRows);
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

  const toggle = (key: string) => {
    setDraft((curr) => ({ ...curr, [key]: !curr[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await saveRolePermissions(selectedRole, draft);
      setMessage(`Saved permissions for ${selectedRole}.`);
      await load();
    } catch (err: any) {
      setError(String(err?.message || err || "Failed to save access permissions"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Role Access Permissions</h3>
          <p className="text-sm text-slate-500">
            Owner can control module visibility and dashboard-card access per role.
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

      <div className="flex flex-wrap gap-2">
        {ROLE_ORDER.map((role) => {
          const active = selectedRole === role;
          return (
            <button
              key={role}
              type="button"
              onClick={() => setSelectedRole(role)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                active ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              {role}
            </button>
          );
        })}
      </div>

      {message && <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>}
      {error && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {loading ? (
        <p className="text-sm text-slate-500">Loading permissions...</p>
      ) : (
        <div className="space-y-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Modules</div>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              {groupedCatalog.module.map((entry) => (
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

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Dashboard Cards</div>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              {groupedCatalog.dashboard_card.map((entry) => (
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

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Feature Toggles</div>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              {groupedCatalog.feature.map((entry) => (
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
        </div>
      )}
    </section>
  );
};

export default AccessPermissions;
