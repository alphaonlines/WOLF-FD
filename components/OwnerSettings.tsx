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
  isDarkMode?: boolean;
};

const OwnerSettings: React.FC<OwnerSettingsProps> = ({
  onOpenChangePassword,
  requestedPanel = null,
  onConsumeRequestedPanel,
  onStartTutorial, // Destructure the new prop
  isDarkMode = false,
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

  const theme = {
    hero: isDarkMode
      ? "border-slate-700/70 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 shadow-2xl shadow-black/20"
      : "border-slate-200/80 bg-gradient-to-br from-white via-sky-50/70 to-slate-100 shadow-sm",
    eyebrow: isDarkMode
      ? "border-sky-400/30 bg-sky-500/10 text-sky-100 shadow-black/20"
      : "border-sky-200 bg-white/80 text-sky-700 shadow-sm",
    heading: isDarkMode ? "text-white" : "text-slate-950",
    body: isDarkMode ? "text-slate-300" : "text-slate-600",
    tutorialButton: isDarkMode
      ? "border-sky-400/40 bg-sky-500/15 text-sky-100 shadow-black/20 hover:bg-sky-500/25"
      : "border-sky-200 bg-white text-sky-700 shadow-sm hover:bg-sky-50",
    passwordButton: isDarkMode
      ? "border-slate-600 bg-slate-900/80 text-slate-200 shadow-black/20 hover:bg-slate-800"
      : "border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50",
    quickCard: isDarkMode
      ? "border-slate-700/70 bg-slate-900/70 shadow-black/20 hover:border-sky-400/50 hover:bg-slate-800/90 hover:shadow-xl"
      : "border-white/80 bg-white/80 shadow-sm hover:border-sky-200 hover:bg-white hover:shadow-md",
    quickIcon: isDarkMode ? "bg-sky-500/15 text-sky-200 group-hover:bg-sky-500/25" : "bg-sky-50 text-sky-700 group-hover:bg-sky-100",
    chevron: isDarkMode ? "text-slate-500 group-hover:text-sky-300" : "text-slate-300 group-hover:text-sky-500",
    cardTitle: isDarkMode ? "text-slate-100" : "text-slate-950",
    cardText: isDarkMode ? "text-slate-400" : "text-slate-500",
    aside: isDarkMode ? "border-slate-700/70 bg-slate-950/85 shadow-2xl shadow-black/20" : "border-slate-200 bg-white shadow-sm",
    asideTitle: isDarkMode ? "text-slate-500" : "text-slate-400",
    asideText: isDarkMode ? "text-slate-400" : "text-slate-500",
    group: isDarkMode ? "border-slate-800 bg-slate-900/65" : "border-slate-100 bg-slate-50/80",
    groupTitle: isDarkMode ? "text-slate-300" : "text-slate-500",
    groupDescription: isDarkMode ? "text-slate-500" : "text-slate-400",
    navActive: isDarkMode ? "bg-sky-500/15 text-white shadow-sm ring-1 ring-sky-400/25" : "bg-white text-slate-950 shadow-sm ring-1 ring-sky-100",
    navInactive: isDarkMode ? "text-slate-300 hover:bg-slate-800/80 hover:text-white" : "text-slate-600 hover:bg-white/80 hover:text-slate-950",
    navIconActive: isDarkMode ? "bg-sky-500/15 text-sky-200" : "bg-sky-50 text-sky-700",
    navIconInactive: isDarkMode ? "bg-slate-950/80 text-slate-400" : "bg-white text-slate-400",
    navHelperActive: isDarkMode ? "text-sky-100/75" : "text-slate-500",
    navHelperInactive: isDarkMode ? "text-slate-500" : "text-slate-500",
    panelHeader: isDarkMode ? "border-slate-700/70 bg-slate-950/80 shadow-2xl shadow-black/20" : "border-slate-200 bg-white shadow-sm",
    panelIcon: isDarkMode ? "bg-sky-500/15 text-sky-200" : "bg-sky-50 text-sky-700",
    panelEyebrow: isDarkMode ? "text-sky-300" : "text-sky-600",
    panelTitle: isDarkMode ? "text-white" : "text-slate-950",
    panelDescription: isDarkMode ? "text-slate-300" : "text-slate-600",
    helperChip: isDarkMode ? "border-slate-700 bg-slate-900/80 text-slate-300" : "border-slate-100 bg-slate-50 text-slate-500",
  };

  return (
    <div className="space-y-5">
      <section className={`overflow-hidden rounded-[2rem] border p-5 sm:p-6 ${theme.hero}`}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${theme.eyebrow}`}>
              <BadgeCheck size={14} />
              Admin controls
            </div>
            <h2 className={`mt-4 text-2xl font-bold tracking-tight sm:text-3xl ${theme.heading}`}>Settings</h2>
            <p className={`mt-2 text-sm leading-6 sm:text-base ${theme.body}`}>
              A cleaner control room for people, permissions, integrations, and training. Pick one focused area on the left, make the change, and keep moving.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onStartTutorial}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${theme.tutorialButton}`}
            >
              <PlayCircle size={16} />
              Start Tutorial
            </button>
            <button
              type="button"
              onClick={onOpenChangePassword}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${theme.passwordButton}`}
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
                className={`group rounded-3xl border p-4 text-left transition hover:-translate-y-0.5 ${theme.quickCard}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className={`rounded-2xl p-2.5 transition ${theme.quickIcon}`}>
                    <Icon size={19} />
                  </span>
                  <ChevronRight size={17} className={`mt-1 transition group-hover:translate-x-0.5 ${theme.chevron}`} />
                </div>
                <div className={`mt-3 text-sm font-bold ${theme.cardTitle}`}>{action.title}</div>
                <div className={`mt-1 text-xs leading-5 ${theme.cardText}`}>{action.description}</div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className={`rounded-[1.75rem] border p-3 xl:sticky xl:top-24 xl:self-start ${theme.aside}`}>
          <div className="px-3 pb-3 pt-2">
            <div className={`text-xs font-bold uppercase tracking-[0.18em] ${theme.asideTitle}`}>Settings menu</div>
            <div className={`mt-1 text-sm ${theme.asideText}`}>Choose one area to work on.</div>
          </div>
          <div className="space-y-3">
            {SETTINGS_GROUPS.map((group) => {
              const items = (Object.entries(PANEL_META) as Array<[SettingsPanel, SettingsPanelMeta]>).filter(
                ([, meta]) => meta.group === group.id
              );
              return (
                <div key={group.id} className={`rounded-3xl border p-2 ${theme.group}`}>
                  <div className="px-2 pb-2">
                    <div className={`text-xs font-bold uppercase tracking-[0.16em] ${theme.groupTitle}`}>{group.label}</div>
                    <div className={`mt-0.5 text-[11px] leading-4 ${theme.groupDescription}`}>{group.description}</div>
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
                            active ? theme.navActive : theme.navInactive
                          }`}
                        >
                          <span className={`mt-0.5 rounded-xl p-2 ${active ? theme.navIconActive : theme.navIconInactive}`}>
                            <Icon size={17} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-bold">{meta.navLabel}</span>
                            <span className={`mt-0.5 block text-xs leading-4 ${active ? theme.navHelperActive : theme.navHelperInactive}`}>{meta.helper}</span>
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
          <section className={`rounded-[1.75rem] border p-5 sm:p-6 ${theme.panelHeader}`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className={`rounded-2xl p-3 ${theme.panelIcon}`}>
                  <ActiveIcon size={22} />
                </div>
                <div>
                  <div className={`text-xs font-bold uppercase tracking-[0.18em] ${theme.panelEyebrow}`}>{activePanel.navLabel}</div>
                  <h3 className={`mt-1 text-xl font-bold ${theme.panelTitle}`}>{activePanel.title}</h3>
                  <p className={`mt-1 max-w-3xl text-sm leading-6 ${theme.panelDescription}`}>{activePanel.description}</p>
                </div>
              </div>
              <div className={`rounded-2xl border px-4 py-3 text-xs leading-5 ${theme.helperChip}`}>
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
