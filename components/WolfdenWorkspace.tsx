import React, { useEffect, useState } from "react";
import { CheckSquare, CalendarClock, ExternalLink, Link2, MapPin, MessageSquare, UserCheck, Users } from "lucide-react";
import type { AuthUser } from "../types";
import { TaskStatus } from "../types";
import CRMWorkspace from "./CRMWorkspace";
import MessageBoard from "./MessageBoard";
import TaskManager from "./TaskManager";
import { createTask } from "../services/tasksService";
import MeetingRoom from "./MeetingRoom";

type WolfdenWorkspaceProps = {
  authUser: AuthUser;
  isDarkMode: boolean;
  requestedSubTab?: WolfdenSubTab;
  requestedSubTabToken?: number;
};

export type WolfdenSubTab = "ups" | "crm" | "board" | "meeting" | "tasks" | "quicklinks";

const QUICKLINKS_URL = "https://sites.google.com/view/fdserver/home";

const STORE_OPTIONS = ["ALL", "Camp", "Base", "G1", "FD7", "FD5"];

const WolfdenWorkspace: React.FC<WolfdenWorkspaceProps> = ({
  authUser,
  isDarkMode,
  requestedSubTab = "ups",
  requestedSubTabToken,
}) => {
  const [subTab, setSubTab] = useState<WolfdenSubTab>(requestedSubTab);
  const [selectedStore, setSelectedStore] = useState("FD7");

  useEffect(() => {
    setSubTab(requestedSubTab);
  }, [requestedSubTab, requestedSubTabToken]);

  const divider = isDarkMode ? "border-slate-800" : "border-slate-200";
  const selectCls = isDarkMode
    ? "rounded-lg border border-slate-700 bg-slate-900 pl-7 pr-3 py-1.5 text-xs font-semibold text-slate-100 outline-none focus:border-amber-500"
    : "rounded-lg border border-slate-200 bg-white pl-7 pr-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-amber-400";

  const tabBtn = (active: boolean) =>
    `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
      active
        ? isDarkMode
          ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
          : "bg-amber-50 text-amber-600 border border-amber-200"
        : isDarkMode
        ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
        : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
    }`;

  const handleMessageSent = async (info: { author: string; body: string; channel: string | null }) => {
    try {
      const label = info.channel ? `#${info.channel}` : "DM";
      const title = `[${label}] ${info.body.slice(0, 70)}${info.body.length > 70 ? "…" : ""}`;
      await createTask({
        title,
        assignee: info.author,
        deadline: "",
        status: TaskStatus.TODO,
        priority: "low",
      });
    } catch {
      // silently fail — task creation shouldn't block message send
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tab bar */}
      <div className={`flex items-center gap-2 px-6 py-3 border-b ${divider} flex-wrap`}>
        <button className={tabBtn(subTab === "ups")} onClick={() => setSubTab("ups")}>
          <UserCheck size={15} /> UPS List
        </button>
        <button className={tabBtn(subTab === "crm")} onClick={() => setSubTab("crm")}>
          <Users size={15} /> CRM
        </button>
        <button className={tabBtn(subTab === "board")} onClick={() => setSubTab("board")}>
          <MessageSquare size={15} /> Message Board
        </button>
        <button className={tabBtn(subTab === "meeting")} onClick={() => setSubTab("meeting")}>
          <CalendarClock size={15} /> Meeting Room
        </button>
        <button className={tabBtn(subTab === "tasks")} onClick={() => setSubTab("tasks")}>
          <CheckSquare size={15} /> Tasks
        </button>
        <button className={tabBtn(subTab === "quicklinks")} onClick={() => setSubTab("quicklinks")}>
          <Link2 size={15} /> QuickLinks
        </button>

        {/* Store selector — lives in the header so it's visible everywhere */}
        <div className="ml-auto relative flex items-center">
          <MapPin size={13} className={`absolute left-2 pointer-events-none ${isDarkMode ? "text-amber-400" : "text-amber-500"}`} />
          <select
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
            className={selectCls}
          >
            {STORE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s === "ALL" ? "All Stores" : s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {subTab === "ups" && <CRMWorkspace authUser={authUser} isDarkMode={isDarkMode} view="queue" selectedStore={selectedStore} onStoreChange={setSelectedStore} />}
        {subTab === "crm" && <CRMWorkspace authUser={authUser} isDarkMode={isDarkMode} view="customers" selectedStore={selectedStore} onStoreChange={setSelectedStore} />}
        {subTab === "board" && <MessageBoard authUser={authUser} onMessageSent={handleMessageSent} />}
        {subTab === "meeting" && <MeetingRoom isDarkMode={isDarkMode} />}
        {subTab === "tasks" && (
          <div className="h-full overflow-auto px-5 py-5 lg:px-7 lg:py-7">
            <TaskManager />
          </div>
        )}
        {subTab === "quicklinks" && <QuickLinksPage isDarkMode={isDarkMode} />}
      </div>
    </div>
  );
};

const QuickLinksPage: React.FC<{ isDarkMode: boolean }> = ({ isDarkMode }) => (
  <div className="h-full overflow-auto px-5 py-5 lg:px-7 lg:py-7">
    <div className={`rounded-3xl border p-5 md:p-6 ${
      isDarkMode ? "border-slate-800 bg-slate-950" : "border-slate-200/80 bg-slate-50/90"
    }`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-500">Den QuickLinks</div>
          <h2 className={`mt-2 text-2xl font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
            Shared team shortcuts live here
          </h2>
          <p className={`mt-2 max-w-3xl text-sm leading-6 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
            This page keeps the current QuickLinks hub inside Den while still giving you an escape hatch to open the full site in a new tab.
          </p>
        </div>
        <a
          href={QUICKLINKS_URL}
          target="_blank"
          rel="noreferrer"
          className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
            isDarkMode
              ? "border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/16"
              : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
          }`}
        >
          <ExternalLink size={16} />
          Open QuickLinks
        </a>
      </div>

      <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200/70 bg-white dark:border-slate-800 dark:bg-slate-900">
        <iframe
          src={QUICKLINKS_URL}
          title="FD QuickLinks"
          className="h-[72vh] w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    </div>
  </div>
);

export default WolfdenWorkspace;
