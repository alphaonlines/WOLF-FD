import React, { useEffect, useState } from "react";
import { CheckSquare, CalendarClock, Link2, MapPin, MessageSquare, UserCheck, Users } from "lucide-react";
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
  hideTabBar?: boolean;
};

export type WolfdenSubTab = "ups" | "crm" | "board" | "meeting" | "tasks" | "quicklinks";

const QUICKLINKS_URL = "https://sites.google.com/view/fdserver/home";

const STORE_OPTIONS = ["ALL", "Camp", "Base", "G1", "FD7", "FD5"];

const WolfdenWorkspace: React.FC<WolfdenWorkspaceProps> = ({
  authUser,
  isDarkMode,
  requestedSubTab = "ups",
  requestedSubTabToken,
  hideTabBar = false,
}) => {
  const [subTab, setSubTab] = useState<WolfdenSubTab>(requestedSubTab);
  const [selectedStore, setSelectedStore] = useState("FD7");

  useEffect(() => {
    setSubTab(requestedSubTab);
  }, [requestedSubTab, requestedSubTabToken]);

  const divider = isDarkMode ? "border-slate-800" : "border-slate-200";
  const stickyBarClass = isDarkMode
    ? "sticky top-20 z-20 border-b border-slate-800 bg-[#121b27]/94 backdrop-blur-xl"
    : "sticky top-20 z-20 border-b border-slate-200 bg-white/92 backdrop-blur-xl";
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
      {/* Sub-tab bar - hidden when shown in header */}
      {!hideTabBar && (
      <div className={`flex items-center gap-2 px-6 py-3 ${divider} ${stickyBarClass} flex-wrap`}>
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
        <a
          href={QUICKLINKS_URL}
          target="_blank"
          rel="noreferrer"
          className={tabBtn(false)}
        >
          <Link2 size={15} /> QuickLinks
        </a>

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
      )}

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
      </div>
    </div>
  );
};

export default WolfdenWorkspace;
