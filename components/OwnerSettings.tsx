import React, { useState } from "react";
import AdminUsers from "./AdminUsers";
import AccessPermissions from "./settings/AccessPermissions";
import EmployeePermissions from "./settings/EmployeePermissions";
import SocialIntegrationsSettings from "./settings/SocialIntegrationsSettings";

type SettingsPanel = "users" | "employees" | "permissions" | "social";

type OwnerSettingsProps = {
  onOpenChangePassword: () => void;
  requestedPanel?: SettingsPanel | null;
  onConsumeRequestedPanel?: () => void;
};

const OwnerSettings: React.FC<OwnerSettingsProps> = ({
  onOpenChangePassword,
  requestedPanel = null,
  onConsumeRequestedPanel,
}) => {
  const [panel, setPanel] = useState<SettingsPanel>("users");

  React.useEffect(() => {
    if (!requestedPanel) return;
    setPanel(requestedPanel);
    onConsumeRequestedPanel?.();
  }, [requestedPanel, onConsumeRequestedPanel]);

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Owner Settings</h2>
            <p className="mt-1 text-sm text-slate-500">
              Manage employee accounts and role-based access to modules and dashboard cards.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenChangePassword}
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Change Password
          </button>
        </div>
        <div className="mt-4 inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setPanel("users")}
            className={`px-3 py-1.5 text-sm font-semibold rounded-lg ${
              panel === "users" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            Users
          </button>
          <button
            type="button"
            onClick={() => setPanel("employees")}
            className={`px-3 py-1.5 text-sm font-semibold rounded-lg ${
              panel === "employees" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            Employee Permissions
          </button>
          <button
            type="button"
            onClick={() => setPanel("permissions")}
            className={`px-3 py-1.5 text-sm font-semibold rounded-lg ${
              panel === "permissions" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            Access Permissions
          </button>
          <button
            type="button"
            onClick={() => setPanel("social")}
            className={`px-3 py-1.5 text-sm font-semibold rounded-lg ${
              panel === "social" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            Social Integrations
          </button>
        </div>
      </section>

      {panel === "users" ? (
        <AdminUsers />
      ) : panel === "employees" ? (
        <EmployeePermissions />
      ) : panel === "permissions" ? (
        <AccessPermissions />
      ) : (
        <SocialIntegrationsSettings />
      )}
    </div>
  );
};

export default OwnerSettings;
