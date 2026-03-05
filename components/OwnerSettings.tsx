import React, { useState } from "react";
import AdminUsers from "./AdminUsers";
import AccessPermissions from "./settings/AccessPermissions";

type SettingsPanel = "users" | "permissions";

const OwnerSettings: React.FC = () => {
  const [panel, setPanel] = useState<SettingsPanel>("users");

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
        <h2 className="text-xl font-semibold text-slate-900">Owner Settings</h2>
        <p className="mt-1 text-sm text-slate-500">
          Manage employee accounts and role-based access to modules and dashboard cards.
        </p>
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
            onClick={() => setPanel("permissions")}
            className={`px-3 py-1.5 text-sm font-semibold rounded-lg ${
              panel === "permissions" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            Access Permissions
          </button>
        </div>
      </section>

      {panel === "users" ? <AdminUsers /> : <AccessPermissions />}
    </div>
  );
};

export default OwnerSettings;
