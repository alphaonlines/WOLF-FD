import React, { useState } from "react";
import {
  BadgeCheck,
  ChevronRight,
  GraduationCap,
  KeyRound,
  LockKeyhole,
  PlayCircle,
  Share2,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import AdminUsers from "./AdminUsers";
import AccessPermissions from "./settings/AccessPermissions";
import AuthWorkspaceSettings from "./settings/AuthWorkspaceSettings";
import EmployeePermissions from "./settings/EmployeePermissions";
import SocialIntegrationsSettings from "./settings/SocialIntegrationsSettings";
import ObjectionsSettings from "./settings/ObjectionsSettings";

type SettingsPanel = "users" | "employees" | "permissions" | "auth" | "social" | "objections";

type SettingsPanelMeta = {
  title: string;
  navLabel: string;
  group: "people" | "access" | "integrations" | "training";
  description: string;
  helper: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

const PANEL_META: Record<SettingsPanel, SettingsPanelMeta> = {
  users: {
    title: "User Accounts",
    navLabel: "User Accounts",
    group: "people",
    description: "Approve access, manage roles, reset passwords, and connect dashboard users to salespeople.",
    helper: "Best for daily account cleanup and onboarding.",
    icon: Users,
  },
  employees: {
    title: "Employee Access",
    navLabel: "Employee Access",
    group: "people",
    description: "Tune module access for a specific employee or return them to role-based defaults.",
    helper: "Use when one person needs an exception.",
    icon: UserCog,
  },
  permissions: {
    title: "Role Defaults",
    navLabel: "Role Defaults",
    group: "access",
    description: "Control the default modules, dashboard cards, and features granted to each role.",
    helper: "Use this before making one-off employee overrides.",
    icon: ShieldCheck,
  },
  auth: {
    title: "Login Rules",
    navLabel: "Login Rules",
    group: "access",
    description: "Manage approved workspace domains and sign-in behavior for employee access.",
    helper: "Keeps the front door clean and predictable.",
    icon: LockKeyhole,
  },
  social: {
    title: "Social Connections",
    navLabel: "Social Connections",
    group: "integrations",
    description: "Configure the social platform connections that power marketing and publishing tools.",
    helper: "Start here when posts or Pages need attention.",
    icon: Share2,
  },
  objections: {
    title: "Sales Training",
    navLabel: "Sales Training",
    group: "training",
    description: "Manage objection handlers and coaching prompts for the sales floor.",
    helper: "Keeps practical sales guidance close to the team.",
    icon: GraduationCap,
  },
};

const SETTINGS_GROUPS: Array<{
  id: SettingsPanelMeta["group"];
  label: string;
  description: string;
}> = [
  { id: "people", label: "People", description: "Accounts and individual access" },
  { id: "access", label: "Access", description: "Roles, permissions, and login rules" },
  { id: "integrations", label: "Integrations", description: "Connected services" },
  { id: "training", label: "Training", description: "Tutorials and sales coaching" },
];

type OwnerSettingsProps = {
  onOpenChangePassword: () => void;
  requestedPanel?: SettingsPanel | null;
  onConsumeRequestedPanel?: () => void;
  onStartTutorial: () => void; // Added prop to start tutorial
};

const OwnerSettings: React.FC<OwnerSettingsProps> = ({
  onOpenChangePassword,
  requestedPanel = null,
  onConsumeRequestedPanel,
  onStartTutorial, // Destructure the new prop
}) => {
  const [panel, setPanel] = useState<SettingsPanel>("users");
  const activePanel = PANEL_META[panel];
  const ActiveIcon = activePanel.icon;

  React.useEffect(() => {
    if (!requestedPanel) return;
    setPanel(requestedPanel);
    onConsumeRequestedPanel?.();
  }, [requestedPanel, onConsumeRequestedPanel]);

  const renderPanel = () => {
    if (panel === "users") return <AdminUsers />;
    if (panel === "employees") return <EmployeePermissions />;
    if (panel === "permissions") return <AccessPermissions />;
    if (panel === "auth") return <AuthWorkspaceSettings />;
    if (panel === "objections") return <ObjectionsSettings />;
    return <SocialIntegrationsSettings />;
  };

  const quickActions: Array<{
    title: string;
    description: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    onClick: () => void;
  }> = [
    {
      title: "Manage users",
      description: "Approve accounts, reset passwords, and assign roles.",
      icon: Users,
      onClick: () => setPanel("users"),
    },
    {
      title: "Adjust access",
      description: "Set role defaults before making employee exceptions.",
      icon: ShieldCheck,
      onClick: () => setPanel("permissions"),
    },
    {
      title: "Connect social",
      description: "Review marketing integrations and publishing keys.",
      icon: Share2,
      onClick: () => setPanel("social"),
    },
    {
      title: "Restart tutorial",
      description: "Replay BotBot onboarding for this dashboard.",
      icon: PlayCircle,
      onClick: onStartTutorial,
    },
  ];

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-gradient-to-br from-white via-sky-50/70 to-slate-100 p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-sky-700 shadow-sm">
              <BadgeCheck size={14} />
              Admin controls
            </div>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Settings</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
              A cleaner control room for people, permissions, integrations, and training. Pick one focused area on the left, make the change, and keep moving.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onStartTutorial}
              className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-sky-700 shadow-sm transition hover:bg-sky-50"
            >
              <PlayCircle size={16} />
              Start Tutorial
            </button>
            <button
              type="button"
              onClick={onOpenChangePassword}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <KeyRound size={16} />
              Change Password
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.title}
                type="button"
                onClick={action.onClick}
                className="group rounded-3xl border border-white/80 bg-white/80 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:bg-white hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-2xl bg-sky-50 p-2.5 text-sky-700 transition group-hover:bg-sky-100">
                    <Icon size={19} />
                  </span>
                  <ChevronRight size={17} className="mt-1 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-sky-500" />
                </div>
                <div className="mt-3 text-sm font-bold text-slate-950">{action.title}</div>
                <div className="mt-1 text-xs leading-5 text-slate-500">{action.description}</div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-[1.75rem] border border-slate-200 bg-white p-3 shadow-sm xl:sticky xl:top-24 xl:self-start">
          <div className="px-3 pb-3 pt-2">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Settings menu</div>
            <div className="mt-1 text-sm text-slate-500">Choose one area to work on.</div>
          </div>
          <div className="space-y-3">
            {SETTINGS_GROUPS.map((group) => {
              const items = (Object.entries(PANEL_META) as Array<[SettingsPanel, SettingsPanelMeta]>).filter(
                ([, meta]) => meta.group === group.id
              );
              return (
                <div key={group.id} className="rounded-3xl border border-slate-100 bg-slate-50/80 p-2">
                  <div className="px-2 pb-2">
                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{group.label}</div>
                    <div className="mt-0.5 text-[11px] leading-4 text-slate-400">{group.description}</div>
                  </div>
                  <div className="space-y-1">
                    {items.map(([id, meta]) => {
                      const Icon = meta.icon;
                      const active = panel === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setPanel(id)}
                          className={`flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition ${
                            active
                              ? "bg-white text-slate-950 shadow-sm ring-1 ring-sky-100"
                              : "text-slate-600 hover:bg-white/80 hover:text-slate-950"
                          }`}
                        >
                          <span className={`mt-0.5 rounded-xl p-2 ${active ? "bg-sky-50 text-sky-700" : "bg-white text-slate-400"}`}>
                            <Icon size={17} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-bold">{meta.navLabel}</span>
                            <span className="mt-0.5 block text-xs leading-4 text-slate-500">{meta.helper}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <main className="min-w-0 space-y-4">
          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-sky-50 p-3 text-sky-700">
                  <ActiveIcon size={22} />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-sky-600">{activePanel.navLabel}</div>
                  <h3 className="mt-1 text-xl font-bold text-slate-950">{activePanel.title}</h3>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{activePanel.description}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
                {activePanel.helper}
              </div>
            </div>
          </section>

          {renderPanel()}
        </main>
      </div>
    </div>
  );
};

export default OwnerSettings;
